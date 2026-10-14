import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test';
import type { DomainEvent } from '@redhunter/shared';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { agentStatusInput, silentLogger, waitUntil } from '../test-support/events';
import { createEventDispatcher, type EventDispatcher, MAX_DISPATCH_ATTEMPTS } from './dispatcher';
import { createOutbox } from './outbox';

let db: TestDatabase;
const running: EventDispatcher[] = [];

function track(dispatcher: EventDispatcher): EventDispatcher {
  running.push(dispatcher);
  return dispatcher;
}

function recordingSink(delayMs = 0) {
  const delivered: DomainEvent[] = [];
  const sink = async (event: DomainEvent): Promise<void> => {
    if (delayMs > 0) {
      await Bun.sleep(delayMs);
    }
    delivered.push(event);
  };
  return { delivered, sink };
}

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all([db.models.Event.deleteMany({}), db.models.EventDead.deleteMany({})]);
});

afterEach(async () => {
  await Promise.all(running.splice(0).map((dispatcher) => dispatcher.stop()));
});

describe('EventDispatcher', () => {
  test('fast path delivers an emitted event and marks it dispatched well under the poll interval', async () => {
    const { delivered, sink } = recordingSink();
    const dispatcher = track(
      createEventDispatcher({ models: db.models, sinks: [sink], pollIntervalMs: 10_000 }),
    );
    const outbox = createOutbox({ models: db.models, onEmitted: dispatcher.notify });
    dispatcher.start();

    const started = Date.now();
    const event = await outbox.emit(agentStatusInput());
    await waitUntil(() => delivered.length === 1, 500);
    expect(Date.now() - started).toBeLessThan(500);
    expect(delivered[0]?.eventId).toBe(event.eventId);

    await waitUntil(async () => {
      const row = await db.models.Event.findOne({ eventId: event.eventId }).lean();
      return row?.dispatchedAt instanceof Date;
    });
  });

  test('poll picks up rows written without the fast path (e.g. by another process)', async () => {
    const { delivered, sink } = recordingSink();
    const dispatcher = track(
      createEventDispatcher({ models: db.models, sinks: [sink], pollIntervalMs: 50 }),
    );
    dispatcher.start();
    await createOutbox({ models: db.models }).emit(agentStatusInput());
    await waitUntil(() => delivered.length === 1, 1_000);
  });

  test('delivers in createdAt order', async () => {
    const outbox = createOutbox({ models: db.models });
    const first = await outbox.emit(agentStatusInput('ceo'));
    const second = await outbox.emit(agentStatusInput('coo'));
    const third = await outbox.emit(agentStatusInput('cto'));
    const { delivered, sink } = recordingSink();
    await createEventDispatcher({ models: db.models, sinks: [sink] }).tick();
    expect(delivered.map((event) => event.eventId)).toEqual([
      first.eventId,
      second.eventId,
      third.eventId,
    ]);
  });

  test('restart replays undispatched events exactly once', async () => {
    const outbox = createOutbox({ models: db.models });
    const emitted = await Promise.all([
      outbox.emit(agentStatusInput('game')),
      outbox.emit(agentStatusInput('iot')),
    ]);
    const { delivered, sink } = recordingSink();
    const fresh = track(createEventDispatcher({ models: db.models, sinks: [sink] }));
    fresh.start();
    await waitUntil(() => delivered.length === 2);
    await fresh.stop();

    const again = recordingSink();
    expect(await createEventDispatcher({ models: db.models, sinks: [again.sink] }).tick()).toBe(0);
    expect(again.delivered).toHaveLength(0);
    expect(delivered.map((event) => event.eventId).sort()).toEqual(
      emitted.map((event) => event.eventId).sort(),
    );
    expect(await db.models.Event.countDocuments({ dispatchedAt: null })).toBe(0);
  });

  test('concurrent ticks never deliver the same event twice', async () => {
    const outbox = createOutbox({ models: db.models });
    for (const agentId of ['ceo', 'coo', 'cto'] as const) {
      await outbox.emit(agentStatusInput(agentId));
    }
    const { delivered, sink } = recordingSink(20);
    const dispatcher = createEventDispatcher({ models: db.models, sinks: [sink] });
    await Promise.all([dispatcher.tick(), dispatcher.tick(), dispatcher.tick()]);
    dispatcher.notify();
    await dispatcher.tick();
    const ids = delivered.map((event) => event.eventId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  test('moves an event to events_dead after exactly 5 failed attempts, then unblocks the queue', async () => {
    expect(MAX_DISPATCH_ATTEMPTS).toBe(5);
    const outbox = createOutbox({ models: db.models });
    const poison = await outbox.emit(agentStatusInput('ceo'));
    const healthy = await outbox.emit(agentStatusInput('coo'));
    const delivered: string[] = [];
    const sink = (event: DomainEvent): void => {
      if (event.eventId === poison.eventId) {
        throw new Error('sink exploded');
      }
      delivered.push(event.eventId);
    };
    const dispatcher = createEventDispatcher({
      models: db.models,
      sinks: [sink],
      logger: silentLogger,
    });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await dispatcher.tick();
      const row = await db.models.Event.findOne({ eventId: poison.eventId }).lean();
      expect(row).toMatchObject({
        attempts: attempt,
        dispatchedAt: null,
        lastError: 'sink exploded',
      });
      expect(await db.models.EventDead.countDocuments({ eventId: poison.eventId })).toBe(0);
      expect(delivered).toEqual([]);
    }

    await dispatcher.tick();

    expect(await db.models.Event.countDocuments({ eventId: poison.eventId })).toBe(0);
    const dead = await db.models.EventDead.findOne({ eventId: poison.eventId }).lean();
    expect(dead).toMatchObject({
      attempts: 5,
      lastError: 'sink exploded',
      type: 'agent.status_changed',
    });
    expect(dead?.deadAt).toBeInstanceOf(Date);
    expect(delivered).toEqual([healthy.eventId]);
  });

  test('a DB failure while marking dispatched retries the mark without re-delivering', async () => {
    const outbox = createOutbox({ models: db.models });
    const event = await outbox.emit(agentStatusInput());
    const { delivered, sink } = recordingSink();
    const dispatcher = createEventDispatcher({
      models: db.models,
      sinks: [sink],
      logger: silentLogger,
    });
    const updateSpy = spyOn(db.models.Event, 'updateOne').mockImplementationOnce(() => {
      throw new Error('mongo down');
    });
    try {
      await dispatcher.tick();
      expect(delivered).toHaveLength(1);
      expect(await db.models.Event.countDocuments({ dispatchedAt: null })).toBe(1);
    } finally {
      updateSpy.mockRestore();
    }
    await dispatcher.tick();
    expect(delivered).toHaveLength(1);
    const row = await db.models.Event.findOne({ eventId: event.eventId }).lean();
    expect(row?.dispatchedAt).toBeInstanceOf(Date);
    expect(row?.attempts).toBe(0);
  });

  test('a DB failure while reading the queue is logged and does not reject the tick', async () => {
    const errors: unknown[] = [];
    const dispatcher = createEventDispatcher({
      models: db.models,
      sinks: [recordingSink().sink],
      logger: { error: (...args: unknown[]) => errors.push(args) },
    });
    const findSpy = spyOn(db.models.Event, 'find').mockImplementationOnce(() => {
      throw new Error('mongo down');
    });
    try {
      expect(await dispatcher.tick()).toBe(0);
    } finally {
      findSpy.mockRestore();
    }
    expect(errors).toHaveLength(1);
  });

  test('disabled dispatcher (EVENTS_DISPATCH=off) stores events but delivers nothing', async () => {
    const { delivered, sink } = recordingSink();
    const dispatcher = track(
      createEventDispatcher({
        models: db.models,
        sinks: [sink],
        enabled: false,
        pollIntervalMs: 20,
      }),
    );
    const outbox = createOutbox({ models: db.models, onEmitted: dispatcher.notify });
    dispatcher.start();
    await outbox.emit(agentStatusInput());
    expect(await dispatcher.tick()).toBe(0);
    await Bun.sleep(300);
    expect(delivered).toHaveLength(0);
    expect(await db.models.Event.countDocuments({ dispatchedAt: null })).toBe(1);
  });

  test('stop() waits for the in-flight tick and later notify() calls do nothing', async () => {
    const outbox = createOutbox({ models: db.models });
    await outbox.emit(agentStatusInput());
    const { delivered, sink } = recordingSink(50);
    const dispatcher = createEventDispatcher({ models: db.models, sinks: [sink] });
    dispatcher.start();
    await Bun.sleep(50);
    await dispatcher.stop();
    expect(delivered).toHaveLength(1);

    await outbox.emit(agentStatusInput('coo'));
    dispatcher.notify();
    await Bun.sleep(100);
    expect(delivered).toHaveLength(1);
  });
});
