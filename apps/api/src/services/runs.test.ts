import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { DomainEventSchema, RunSchema } from '@redhunter/shared';
import {
  delayFirstWrite,
  SYSTEM_ACTOR,
  seedTask,
  startWorkContext,
  storedEventTypes,
  type WorkContext,
} from '../test-support/work';
import { ConflictError, InvalidTransitionError, NotFoundError } from './errors';
import { createRun, getRun, listRunEvents, transitionRun } from './runs';

let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([
    ctx.db.models.Directive.deleteMany({}),
    ctx.db.models.Task.deleteMany({}),
    ctx.db.models.Run.deleteMany({}),
    ctx.db.models.Event.deleteMany({}),
  ]);
});

async function seedRun(): Promise<string> {
  const taskId = await seedTask(ctx.deps, 'assigned');
  const run = await createRun(ctx.deps, { taskId, adapterId: 'opencode', actor: SYSTEM_ACTOR });
  return run.id;
}

async function advance(runId: string, ...steps: ('composing' | 'executing' | 'verifying')[]) {
  for (const to of steps) {
    await transitionRun(ctx.deps, { runId, to, actor: SYSTEM_ACTOR });
  }
}

describe('createRun', () => {
  test('creates a queued run for the task assignee and emits run.started', async () => {
    const taskId = await seedTask(ctx.deps, 'assigned');
    const run = await createRun(ctx.deps, { taskId, adapterId: 'codex', actor: SYSTEM_ACTOR });

    expect(run).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      taskId,
      agentId: 'programming',
      adapterId: 'codex',
      status: 'queued',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const row = await ctx.db.models.Event.findOne({ type: 'run.started' }).lean();
    expect(row).toMatchObject({
      aggregate: { kind: 'run', id: run.id },
      payload: { runId: run.id, taskId, agentId: 'programming', adapterId: 'codex' },
    });
  });

  test('task without assignee -> ConflictError; unknown task -> NotFoundError', async () => {
    const planned = await seedTask(ctx.deps, 'planned');
    await expect(
      createRun(ctx.deps, { taskId: planned, adapterId: 'opencode', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      createRun(ctx.deps, { taskId: 'missing', adapterId: 'opencode', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await ctx.db.models.Run.countDocuments()).toBe(0);
  });
});

describe('transitionRun', () => {
  test('happy path to succeeded stamps startedAt/endedAt and emits run.completed', async () => {
    const runId = await seedRun();
    await advance(runId, 'composing', 'executing', 'verifying');
    const done = await transitionRun(ctx.deps, { runId, to: 'succeeded', actor: SYSTEM_ACTOR });

    expect(done.status).toBe('succeeded');
    expect(done.startedAt).toEqual(expect.any(String));
    expect(done.endedAt).toEqual(expect.any(String));
    expect(() => RunSchema.parse(done)).not.toThrow();
    expect(await storedEventTypes(ctx.db, runId)).toEqual(['run.started', 'run.completed']);
  });

  test('succeeded -> queued is rejected with InvalidTransitionError and emits nothing', async () => {
    const runId = await seedRun();
    await advance(runId, 'composing', 'executing', 'verifying');
    await transitionRun(ctx.deps, { runId, to: 'succeeded', actor: SYSTEM_ACTOR });

    await expect(
      transitionRun(ctx.deps, { runId, to: 'queued', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect((await getRun(ctx.deps, runId)).status).toBe('succeeded');
    expect(await storedEventTypes(ctx.db, runId)).toEqual(['run.started', 'run.completed']);
  });

  test('failed records the error and emits run.failed', async () => {
    const runId = await seedRun();
    await advance(runId, 'composing', 'executing');
    const failed = await transitionRun(ctx.deps, {
      runId,
      to: 'failed',
      error: 'adapter crashed',
      actor: SYSTEM_ACTOR,
    });
    expect(failed).toMatchObject({ status: 'failed', error: 'adapter crashed' });
    const row = await ctx.db.models.Event.findOne({ type: 'run.failed' }).lean();
    expect(row?.payload).toEqual({ runId, error: 'adapter crashed' });
  });

  test('escalated emits run.escalated with the target', async () => {
    const runId = await seedRun();
    await advance(runId, 'composing', 'executing');
    await transitionRun(ctx.deps, {
      runId,
      to: 'escalated',
      escalatedTo: 'cto',
      actor: SYSTEM_ACTOR,
    });
    const row = await ctx.db.models.Event.findOne({ type: 'run.escalated' }).lean();
    expect(row?.payload).toEqual({ runId, escalatedTo: 'cto' });
  });

  test('startedAt: absent while queued/composing, set once at first executing, never moved', async () => {
    const runId = await seedRun();
    expect((await getRun(ctx.deps, runId)).startedAt).toBeUndefined();
    const composing = await transitionRun(ctx.deps, {
      runId,
      to: 'composing',
      actor: SYSTEM_ACTOR,
    });
    expect(composing.startedAt).toBeUndefined();
    expect(composing.endedAt).toBeUndefined();

    const executing = await transitionRun(ctx.deps, {
      runId,
      to: 'executing',
      actor: SYSTEM_ACTOR,
    });
    const startedAt = executing.startedAt;
    expect(startedAt).toEqual(expect.any(String));
    expect(executing.endedAt).toBeUndefined();

    for (const to of ['verifying', 'paused', 'executing', 'verifying'] as const) {
      await Bun.sleep(5);
      const run = await transitionRun(ctx.deps, { runId, to, actor: SYSTEM_ACTOR });
      expect(run.startedAt).toBe(startedAt);
      expect(run.endedAt).toBeUndefined();
    }
    const done = await transitionRun(ctx.deps, { runId, to: 'succeeded', actor: SYSTEM_ACTOR });
    expect(done.startedAt).toBe(startedAt);
  });

  test('endedAt is stamped on succeeded, failed and escalated', async () => {
    for (const to of ['succeeded', 'failed', 'escalated'] as const) {
      const runId = await seedRun();
      await advance(runId, 'composing', 'executing', 'verifying');
      const before = await getRun(ctx.deps, runId);
      expect(before.endedAt).toBeUndefined();
      const run = await transitionRun(ctx.deps, { runId, to, actor: SYSTEM_ACTOR });
      expect(run.status).toBe(to);
      expect(run.endedAt).toEqual(expect.any(String));
      expect(Date.parse(run.endedAt ?? '')).toBeGreaterThanOrEqual(Date.parse(run.startedAt ?? ''));
    }
  });

  test('unknown run -> NotFoundError', async () => {
    await expect(
      transitionRun(ctx.deps, { runId: 'missing', to: 'composing', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(getRun(ctx.deps, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('two concurrent transitions from the same status: exactly one wins', async () => {
    const runId = await seedRun();
    await advance(runId, 'composing', 'executing');
    const restore = delayFirstWrite(ctx.db.models.Run);
    try {
      const outcomes = await Promise.allSettled([
        transitionRun(ctx.deps, { runId, to: 'verifying', actor: SYSTEM_ACTOR }),
        transitionRun(ctx.deps, { runId, to: 'failed', error: 'boom', actor: SYSTEM_ACTOR }),
      ]);
      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.status === 'rejected' && rejected[0].reason).toBeInstanceOf(
        ConflictError,
      );
    } finally {
      restore();
    }
  });
});

describe('listRunEvents', () => {
  test('returns only this run’s events in createdAt order, re-validated', async () => {
    const runId = await seedRun();
    const otherRunId = await seedRun();
    await advance(runId, 'composing', 'executing');
    await transitionRun(ctx.deps, { runId, to: 'failed', error: 'x', actor: SYSTEM_ACTOR });

    const events = await listRunEvents(ctx.deps, runId);
    expect(events.map((event) => event.type)).toEqual(['run.started', 'run.failed']);
    for (const event of events) {
      expect(() => DomainEventSchema.parse(event)).not.toThrow();
      expect(event.aggregate.id).toBe(runId);
    }
    expect((await listRunEvents(ctx.deps, otherRunId)).map((event) => event.type)).toEqual([
      'run.started',
    ]);
  });

  test('unknown run -> NotFoundError', async () => {
    await expect(listRunEvents(ctx.deps, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
