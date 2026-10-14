import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AgentId } from '@redhunter/shared';
import {
  SYSTEM_ACTOR,
  seedDirectiveId,
  seedTask,
  startWorkContext,
  storedEventTypes,
  TEST_PROJECT_ID,
  type WorkContext,
} from '../test-support/work';
import { InvalidTransitionError, NotFoundError } from './errors';
import { assignTask, createTask, listTasks, transitionTask } from './tasks';

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
    ctx.db.models.Event.deleteMany({}),
  ]);
});

describe('createTask', () => {
  test('creates a planned task with the directive capabilityTags and emits task.created', async () => {
    const directiveId = await seedDirectiveId(ctx.deps);
    const task = await createTask(ctx.deps, {
      directiveId,
      projectId: TEST_PROJECT_ID,
      acceptance: ['tests pass'],
      actor: SYSTEM_ACTOR,
    });

    expect(task).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      directiveId,
      projectId: TEST_PROJECT_ID,
      status: 'planned',
      acceptance: ['tests pass'],
      capabilityTags: ['code'],
    });
    const row = await ctx.db.models.Event.findOne({ type: 'task.created' }).lean();
    expect(row).toMatchObject({ aggregate: { kind: 'task', id: task.id }, payload: { task } });
  });

  test('unknown directive -> NotFoundError, nothing stored', async () => {
    await expect(
      createTask(ctx.deps, {
        directiveId: 'missing-directive',
        projectId: TEST_PROJECT_ID,
        acceptance: [],
        actor: SYSTEM_ACTOR,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await ctx.db.models.Task.countDocuments()).toBe(0);
    expect(await ctx.db.models.Event.countDocuments({ type: 'task.created' })).toBe(0);
  });
});

describe('assignTask', () => {
  test('sets the assignee, moves planned -> assigned and emits task.assigned', async () => {
    const taskId = await seedTask(ctx.deps, 'planned');
    const task = await assignTask(ctx.deps, {
      taskId,
      agentId: 'programming',
      actor: SYSTEM_ACTOR,
    });
    expect(task).toMatchObject({ id: taskId, status: 'assigned', assigneeAgentId: 'programming' });
    const row = await ctx.db.models.Event.findOne({ type: 'task.assigned' }).lean();
    expect(row?.payload).toEqual({ taskId, assigneeAgentId: 'programming' });
  });

  test('rejects an agent outside AGENT_IDS', async () => {
    const taskId = await seedTask(ctx.deps, 'planned');
    await expect(
      assignTask(ctx.deps, { taskId, agentId: 'janitor' as AgentId, actor: SYSTEM_ACTOR }),
    ).rejects.toThrow();
    expect(await storedEventTypes(ctx.db, taskId)).toEqual(['task.created']);
  });

  test('done task cannot be re-assigned', async () => {
    const taskId = await seedTask(ctx.deps, 'done');
    await expect(
      assignTask(ctx.deps, { taskId, agentId: 'game', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});

describe('transitionTask', () => {
  test('emits task.status_changed for every allowed move', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');
    const paused = await transitionTask(ctx.deps, { taskId, to: 'paused', actor: SYSTEM_ACTOR });
    expect(paused.status).toBe('paused');
    expect(await storedEventTypes(ctx.db, taskId)).toEqual([
      'task.created',
      'task.assigned',
      'task.status_changed',
      'task.status_changed',
    ]);
    const last = await ctx.db.models.Event.findOne({ 'aggregate.id': taskId })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    expect(last?.payload).toEqual({ taskId, status: 'paused' });
  });

  test('done -> in_progress is rejected and emits nothing', async () => {
    const taskId = await seedTask(ctx.deps, 'done');
    const before = await storedEventTypes(ctx.db, taskId);
    await expect(
      transitionTask(ctx.deps, { taskId, to: 'in_progress', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(await storedEventTypes(ctx.db, taskId)).toEqual(before);
    expect((await ctx.db.models.Task.findById(taskId).lean())?.status).toBe('done');
  });

  test('unknown task -> NotFoundError', async () => {
    await expect(
      transitionTask(ctx.deps, { taskId: 'nope', to: 'paused', actor: SYSTEM_ACTOR }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('allowedFrom restricts the source state even when the table allows the move', async () => {
    const taskId = await seedTask(ctx.deps, 'assigned');
    const before = await storedEventTypes(ctx.db, taskId);
    await expect(
      transitionTask(ctx.deps, {
        taskId,
        to: 'in_progress',
        allowedFrom: ['paused'],
        actor: SYSTEM_ACTOR,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(await storedEventTypes(ctx.db, taskId)).toEqual(before);
    expect((await ctx.db.models.Task.findById(taskId).lean())?.status).toBe('assigned');
  });
});

describe('listTasks', () => {
  test('filters by status and assignee', async () => {
    const planned = await seedTask(ctx.deps, 'planned');
    const working = await seedTask(ctx.deps, 'in_progress');

    const all = await listTasks(ctx.deps, {});
    expect(all.map((task) => task.id).sort()).toEqual([planned, working].sort());
    expect((await listTasks(ctx.deps, { status: 'planned' })).map((task) => task.id)).toEqual([
      planned,
    ]);
    const mine = await listTasks(ctx.deps, { assigneeAgentId: 'programming' });
    expect(mine.map((task) => task.id)).toEqual([working]);
    expect(await listTasks(ctx.deps, { assigneeAgentId: 'iot' })).toEqual([]);
  });
});
