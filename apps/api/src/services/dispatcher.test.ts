import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AgentAdapter } from '@redhunter/shared';
import {
  SYSTEM_ACTOR,
  seedTask,
  startWorkContext,
  type WorkContext,
} from '../test-support/work';
import { createRun } from './runs';
import { createRunDispatcher } from './dispatcher';

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

function createMockAdapter(shouldSucceed = true): AgentAdapter {
  return {
    id: 'opencode',
    start: async function* () {
      if (!shouldSucceed) {
        throw new Error('Adapter failed');
      }
      yield { type: 'text', text: 'done' };
    },
    answerPermission: async () => {
      throw new Error('Not implemented');
    },
    cancel: async () => {
      throw new Error('Not implemented');
    },
  };
}

describe('createRunDispatcher', () => {
  test('processes pending runs sequentially', async () => {
    const adapter = createMockAdapter(true);
    const deps = { ...ctx.deps, adapters: [adapter] };

    const taskId1 = await seedTask(deps, 'assigned');
    const taskId2 = await seedTask(deps, 'assigned');

    const run1 = await createRun(deps, {
      taskId: taskId1,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });
    const run2 = await createRun(deps, {
      taskId: taskId2,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });

    const dispatcher = createRunDispatcher(deps);
    await dispatcher.start();

    let attempts = 0;
    while (attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const processed1 = await ctx.db.models.Run.findById(run1.id).lean();
      const processed2 = await ctx.db.models.Run.findById(run2.id).lean();
      if (processed1?.status === 'succeeded' && processed2?.status === 'succeeded') {
        break;
      }
      attempts++;
    }

    const processed1 = await ctx.db.models.Run.findById(run1.id).lean();
    const processed2 = await ctx.db.models.Run.findById(run2.id).lean();

    expect(processed1?.status).toBe('succeeded');
    expect(processed2?.status).toBe('succeeded');

    await dispatcher.stop();
  });

  test('retries failed runs up to maxRetries', async () => {
    let attemptCount = 0;
    const adapter: AgentAdapter = {
      id: 'opencode',
      start: async function* () {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        yield { type: 'text', text: 'done' };
      },
      answerPermission: async () => {
        throw new Error('Not implemented');
      },
      cancel: async () => {
        throw new Error('Not implemented');
      },
    };
    const deps = { ...ctx.deps, adapters: [adapter] };

    const taskId = await seedTask(deps, 'assigned');
    const run = await createRun(deps, {
      taskId,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });

    const dispatcher = createRunDispatcher(deps, { maxRetries: 3 });
    dispatcher.enqueue(run.id);

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(attemptCount).toBe(3);

    await dispatcher.stop();
  });

  test('stops processing when stop() called', async () => {
    let executeStarted = false;
    const slowAdapter: AgentAdapter = {
      id: 'opencode',
      start: async function* () {
        executeStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
        yield { type: 'text', text: 'done' };
      },
      answerPermission: async () => {
        throw new Error('Not implemented');
      },
      cancel: async () => {
        throw new Error('Not implemented');
      },
    };
    const deps = { ...ctx.deps, adapters: [slowAdapter] };

    const taskId1 = await seedTask(deps, 'assigned');
    const taskId2 = await seedTask(deps, 'assigned');

    await createRun(deps, {
      taskId: taskId1,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });
    const run2 = await createRun(deps, {
      taskId: taskId2,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });

    const dispatcher = createRunDispatcher(deps);
    await dispatcher.start();

    while (!executeStarted) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    await dispatcher.stop();

    const secondRun = await ctx.db.models.Run.findById(run2.id).lean();
    expect(secondRun?.status).toBe('queued');
  });
});
