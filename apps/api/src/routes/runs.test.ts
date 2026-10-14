import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { DomainEventSchema, RunSchema } from '@redhunter/shared';
import request from 'supertest';
import { createRun, transitionRun } from '../services/runs';
import { assignTask, createTask } from '../services/tasks';
import {
  bearer,
  SYSTEM_ACTOR,
  seedTask,
  startWorkContext,
  TEST_PROJECT_ID,
  type WorkContext,
} from '../test-support/work';

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

function get(path: string, token = ctx.tokens.viewer) {
  return request(ctx.app).get(`/api/v1${path}`).set('Authorization', bearer(token));
}

async function seedRun(): Promise<string> {
  const taskId = await seedTask(ctx.deps, 'assigned');
  return (await createRun(ctx.deps, { taskId, adapterId: 'opencode', actor: SYSTEM_ACTOR })).id;
}

describe('GET /api/v1/runs/:id', () => {
  test('viewer reads a run (re-validated, no Mongo fields)', async () => {
    const runId = await seedRun();
    const res = await get(`/runs/${runId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: runId, status: 'queued', agentId: 'programming' });
    expect(() => RunSchema.strict().parse(res.body.data)).not.toThrow();
  });

  test('unknown and odd ids -> 404 JSON, never 500', async () => {
    for (const id of ['missing', '65f0c0ffee0000000000dead', '%7B%22%24ne%22%3A1%7D']) {
      const res = await get(`/runs/${id}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
  });

  test('401 without token', async () => {
    const runId = await seedRun();
    expect((await request(ctx.app).get(`/api/v1/runs/${runId}`)).status).toBe(401);
  });

  test('no route mutates runs or agents over REST', async () => {
    const runId = await seedRun();
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const run = await request(ctx.app)
        [method](`/api/v1/runs/${runId}`)
        .set('Authorization', bearer(ctx.tokens.owner));
      const agent = await request(ctx.app)
        [method]('/api/v1/agents/programming')
        .set('Authorization', bearer(ctx.tokens.owner));
      expect(run.status).toBe(404);
      expect(agent.status).toBe(404);
    }
  });
});

describe('GET /api/v1/runs/:id/events', () => {
  test('returns this run’s events ordered by createdAt', async () => {
    const runId = await seedRun();
    await seedRun();
    for (const to of ['composing', 'executing'] as const) {
      await transitionRun(ctx.deps, { runId, to, actor: SYSTEM_ACTOR });
    }
    await transitionRun(ctx.deps, {
      runId,
      to: 'escalated',
      escalatedTo: 'coo',
      actor: SYSTEM_ACTOR,
    });

    const res = await get(`/runs/${runId}/events`);
    expect(res.status).toBe(200);
    const events = res.body.data as { type: string; createdAt: string }[];
    expect(events.map((event) => event.type)).toEqual(['run.started', 'run.escalated']);
    for (const event of events) {
      expect(() => DomainEventSchema.parse(event)).not.toThrow();
    }
    const times = events.map((event) => event.createdAt);
    expect([...times].sort()).toEqual(times);
  });

  test('unknown run -> 404; no token -> 401', async () => {
    expect((await get('/runs/missing/events')).status).toBe(404);
    expect((await request(ctx.app).get('/api/v1/runs/missing/events')).status).toBe(401);
  });

  test('ignores events of another aggregate kind that share the run id', async () => {
    const runId = await seedRun();
    await ctx.outbox.emit({
      type: 'task.status_changed',
      aggregate: { kind: 'task', id: runId },
      actor: SYSTEM_ACTOR,
      payload: { taskId: runId, status: 'paused' },
    });
    const res = await get(`/runs/${runId}/events`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((event: { type: string }) => event.type)).toEqual(['run.started']);
  });
});

describe('id length guard', () => {
  test('ids over 128 chars -> 404 without touching Mongo (GET /runs/:id, PATCH /tasks/:id)', async () => {
    const longId = 'a'.repeat(129);
    const runLookup = spyOn(ctx.db.models.Run, 'findById');
    const taskLookup = spyOn(ctx.db.models.Task, 'findById');
    try {
      const run = await get(`/runs/${longId}`);
      const events = await get(`/runs/${longId}/events`);
      const task = await request(ctx.app)
        .patch(`/api/v1/tasks/${longId}`)
        .set('Authorization', bearer(ctx.tokens.operator))
        .send({ action: 'pause' });
      for (const res of [run, events, task]) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ success: false, error: expect.any(String) });
      }
      expect(runLookup).not.toHaveBeenCalled();
      expect(taskLookup).not.toHaveBeenCalled();
    } finally {
      runLookup.mockRestore();
      taskLookup.mockRestore();
    }
  });

  test('a 128-char id still reaches the lookup (boundary)', async () => {
    const runLookup = spyOn(ctx.db.models.Run, 'findById');
    try {
      expect((await get(`/runs/${'a'.repeat(128)}`)).status).toBe(404);
      expect(runLookup).toHaveBeenCalledTimes(1);
    } finally {
      runLookup.mockRestore();
    }
  });
});

describe('happy flow: directive -> task -> run visible over REST', () => {
  test('operator directive, service-created task + run, viewer reads all of it', async () => {
    const posted = await request(ctx.app)
      .post('/api/v1/directives')
      .set('Authorization', bearer(ctx.tokens.operator))
      .send({ text: 'Wire the lobby screens', capabilityTags: ['code'] });
    expect(posted.status).toBe(201);
    const directiveId = posted.body.data.id as string;

    const task = await createTask(ctx.deps, {
      directiveId,
      projectId: TEST_PROJECT_ID,
      acceptance: ['screens show runs'],
      actor: SYSTEM_ACTOR,
    });
    await assignTask(ctx.deps, { taskId: task.id, agentId: 'programming', actor: SYSTEM_ACTOR });
    const run = await createRun(ctx.deps, {
      taskId: task.id,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });

    const tasks = await get('/tasks?assigneeAgentId=programming');
    expect(tasks.body.data).toEqual([
      expect.objectContaining({ id: task.id, directiveId, status: 'assigned' }),
    ]);
    const readRun = await get(`/runs/${run.id}`);
    expect(readRun.body.data).toMatchObject({ id: run.id, taskId: task.id, status: 'queued' });
    const runEvents = await get(`/runs/${run.id}/events`);
    expect(runEvents.body.data).toEqual([
      expect.objectContaining({
        type: 'run.started',
        payload: { runId: run.id, taskId: task.id, agentId: 'programming', adapterId: 'opencode' },
      }),
    ]);

    const all = await ctx.db.models.Event.find({}).sort({ createdAt: 1, _id: 1 }).lean();
    expect(all.map((row) => row.type)).toEqual([
      'directive.created',
      'task.created',
      'task.assigned',
      'run.started',
    ]);
  });
});
