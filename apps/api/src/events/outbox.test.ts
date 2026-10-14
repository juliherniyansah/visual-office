import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { DomainEventSchema } from '@redhunter/shared';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { agentStatusInput } from '../test-support/events';
import { createOutbox, type EventInput, InvalidEventError, toDomainEvent } from './outbox';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.models.Event.deleteMany({});
});

describe('outbox emit()', () => {
  test('stores a validated event as an undispatched row with a fresh uuid', async () => {
    const outbox = createOutbox({ models: db.models });
    const event = await outbox.emit(agentStatusInput('cto', 'run-1'));

    expect(() => DomainEventSchema.parse(event)).not.toThrow();
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.attempts).toBe(0);
    expect(event.dispatchedAt).toBeUndefined();

    const rows = await db.models.Event.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventId: event.eventId,
      type: 'agent.status_changed',
      payload: { agentId: 'cto', status: 'working', runId: 'run-1' },
      dispatchedAt: null,
      attempts: 0,
    });
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    expect(toDomainEvent(rows[0] ?? never())).toEqual(event);
  });

  test('rejects an invalid event shape and inserts nothing', async () => {
    const outbox = createOutbox({ models: db.models });
    const badInputs: unknown[] = [
      { ...agentStatusInput(), payload: { agentId: 'janitor', status: 'working' } },
      { ...agentStatusInput(), type: 'agent.exploded' },
      { ...agentStatusInput(), aggregate: { kind: 'run', id: 'ceo' } },
      { ...agentStatusInput(), actor: { kind: 'robot', id: 'x' } },
      null,
    ];
    for (const input of badInputs) {
      await expect(outbox.emit(input as EventInput)).rejects.toBeInstanceOf(InvalidEventError);
    }
    expect(await db.models.Event.countDocuments()).toBe(0);
  });

  test('ignores forged envelope fields so callers cannot pre-mark an event dispatched', async () => {
    const outbox = createOutbox({ models: db.models });
    const forged = {
      ...agentStatusInput(),
      eventId: '00000000-0000-4000-8000-000000000000',
      dispatchedAt: new Date().toISOString(),
      attempts: 99,
    } as unknown as EventInput;
    const event = await outbox.emit(forged);

    expect(event.eventId).not.toBe('00000000-0000-4000-8000-000000000000');
    const row = await db.models.Event.findOne({ eventId: event.eventId }).lean();
    expect(row).toMatchObject({ dispatchedAt: null, attempts: 0 });
  });

  test('notifies the fast-path listener after the row is stored', async () => {
    let storedWhenNotified = -1;
    const outbox = createOutbox({
      models: db.models,
      onEmitted: () => {
        void db.models.Event.countDocuments().then((count) => {
          storedWhenNotified = count;
        });
      },
    });
    await outbox.emit(agentStatusInput());
    await Bun.sleep(50);
    expect(storedWhenNotified).toBe(1);
  });
});

function never(): never {
  throw new Error('expected a stored row');
}
