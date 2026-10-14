import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import request from 'supertest';
import { transitionTask } from '../services/tasks';
import {
  bearer,
  delayFirstWrite,
  expiredToken,
  SYSTEM_ACTOR,
  seedTask,
  startWorkContext,
  storedEventTypes,
  unsignedToken,
  type WorkContext,
} from '../test-support/work';

const PATH = '/api/v1/tasks';
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

function patch(taskId: string, body: unknown, token = ctx.tokens.operator) {
  return request(ctx.app)
    .patch(`${PATH}/${taskId}`)
    .set('Authorization', bearer(token))
    .send(body as object);
}

function list(query = '') {
  return request(ctx.app).get(`${PATH}${query}`).set('Authorization', bearer(ctx.tokens.viewer));
}

describe('GET /api/v1/tasks', () => {
  test('viewer lists tasks; status and assigneeAgentId filters apply', async () => {
    const planned = await seedTask(ctx.deps, 'planned');
    const working = await seedTask(ctx.deps, 'in_progress');

    const all = await list();
    expect(all.status).toBe(200);
    expect(all.body.success).toBe(true);
    expect(all.body.data.map((task: { id: string }) => task.id).sort()).toEqual(
      [planned, working].sort(),
    );
    expect((await list('?status=planned')).body.data).toEqual([
      expect.objectContaining({ id: planned, status: 'planned' }),
    ]);
    expect((await list('?assigneeAgentId=programming')).body.data).toEqual([
      expect.objectContaining({ id: working, assigneeAgentId: 'programming' }),
    ]);
    expect((await list('?status=done')).body.data).toEqual([]);
  });

  test('400 for unknown filter values', async () => {
    for (const query of [
      '?status=dancing',
      '?assigneeAgentId=janitor',
      '?status=planned&status=planned',
    ]) {
      const res = await list(query);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
  });

  test('401 without token', async () => {
    expect((await request(ctx.app).get(PATH)).status).toBe(401);
  });
});

describe('PATCH /api/v1/tasks/:id', () => {
  test('operator pauses, resumes and cancels; each emits task.status_changed', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');

    const paused = await patch(taskId, { action: 'pause' });
    expect(paused.status).toBe(200);
    expect(paused.body).toEqual({
      success: true,
      data: expect.objectContaining({ id: taskId, status: 'paused' }),
    });
    expect((await patch(taskId, { action: 'resume' })).body.data.status).toBe('in_progress');
    expect((await patch(taskId, { action: 'cancel' }, ctx.tokens.owner)).body.data.status).toBe(
      'cancelled',
    );

    expect(await storedEventTypes(ctx.db, taskId)).toEqual([
      'task.created',
      'task.assigned',
      'task.status_changed',
      'task.status_changed',
      'task.status_changed',
      'task.status_changed',
    ]);
    const rows = await ctx.db.models.Event.find({ type: 'task.status_changed' })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(rows.slice(1).map((row) => row.payload)).toEqual([
      { taskId, status: 'paused' },
      { taskId, status: 'in_progress' },
      { taskId, status: 'cancelled' },
    ]);
    expect(rows.slice(1).map((row) => row.actor)).toEqual([
      { kind: 'human', id: ctx.subjects.operator },
      { kind: 'human', id: ctx.subjects.operator },
      { kind: 'human', id: ctx.subjects.owner },
    ]);
  });

  test('invalid transitions -> 409 and no event (done task, resume without pause, pause planned)', async () => {
    const done = await seedTask(ctx.deps, 'done');
    const working = await seedTask(ctx.deps, 'in_progress');
    const planned = await seedTask(ctx.deps, 'planned');
    const cases: [string, string][] = [
      [done, 'pause'],
      [done, 'resume'],
      [done, 'cancel'],
      [working, 'resume'],
      [planned, 'pause'],
    ];
    for (const [taskId, action] of cases) {
      const before = await storedEventTypes(ctx.db, taskId);
      const res = await patch(taskId, { action });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
      expect(await storedEventTypes(ctx.db, taskId)).toEqual(before);
    }
  });

  test('resume only from paused: assigned/planned -> 409, no event, status unchanged', async () => {
    const assigned = await seedTask(ctx.deps, 'assigned');
    const planned = await seedTask(ctx.deps, 'planned');
    for (const [taskId, status] of [
      [assigned, 'assigned'],
      [planned, 'planned'],
    ] as const) {
      const before = await storedEventTypes(ctx.db, taskId);
      const res = await patch(taskId, { action: 'resume' });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
      expect(await storedEventTypes(ctx.db, taskId)).toEqual(before);
      expect((await ctx.db.models.Task.findById(taskId).lean())?.status).toBe(status);
    }
  });

  test('resume on a paused task -> 200 in_progress with exactly one new event', async () => {
    const taskId = await seedTask(ctx.deps, 'paused');
    const before = await storedEventTypes(ctx.db, taskId);
    const res = await patch(taskId, { action: 'resume' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: taskId, status: 'in_progress' });
    expect(await storedEventTypes(ctx.db, taskId)).toEqual([...before, 'task.status_changed']);
  });

  test('pause only from in_progress: assigned, paused, escalated -> 409, no event', async () => {
    const assigned = await seedTask(ctx.deps, 'assigned');
    const paused = await seedTask(ctx.deps, 'paused');
    const escalated = await seedTask(ctx.deps, 'in_progress');
    await transitionTask(ctx.deps, { taskId: escalated, to: 'escalated', actor: SYSTEM_ACTOR });
    for (const taskId of [assigned, paused, escalated]) {
      const before = await storedEventTypes(ctx.db, taskId);
      const res = await patch(taskId, { action: 'pause' });
      expect(res.status).toBe(409);
      expect(await storedEventTypes(ctx.db, taskId)).toEqual(before);
    }
  });

  test('cancel from every non-terminal status -> 200 cancelled', async () => {
    const escalated = await seedTask(ctx.deps, 'in_progress');
    await transitionTask(ctx.deps, { taskId: escalated, to: 'escalated', actor: SYSTEM_ACTOR });
    const ids = [
      await seedTask(ctx.deps, 'planned'),
      await seedTask(ctx.deps, 'assigned'),
      await seedTask(ctx.deps, 'in_progress'),
      await seedTask(ctx.deps, 'paused'),
      escalated,
    ];
    for (const taskId of ids) {
      const res = await patch(taskId, { action: 'cancel' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('cancelled');
    }
  });

  test('forged status in the body is ignored; only the action counts', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');
    const res = await patch(taskId, { action: 'pause', status: 'done', id: 'other' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: taskId, status: 'paused' });
  });

  test('concurrent pause + cancel on the same task: exactly one 200 and one 409', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');
    const restore = delayFirstWrite(ctx.db.models.Task);
    try {
      const [pause, cancel] = await Promise.all([
        patch(taskId, { action: 'pause' }),
        patch(taskId, { action: 'cancel' }),
      ]);
      expect([pause.status, cancel.status].sort()).toEqual([200, 409]);
      const winner = pause.status === 200 ? 'paused' : 'cancelled';
      expect((await ctx.db.models.Task.findById(taskId).lean())?.status).toBe(winner);
      const changes = await ctx.db.models.Event.countDocuments({
        type: 'task.status_changed',
        'aggregate.id': taskId,
      });
      // One from seeding (in_progress) plus exactly one from the winner.
      expect(changes).toBe(2);
    } finally {
      restore();
    }
  });

  test('viewer -> 403; missing, expired and alg=none tokens -> 401', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');
    expect((await patch(taskId, { action: 'pause' }, ctx.tokens.viewer)).status).toBe(403);
    const missing = await request(ctx.app).patch(`${PATH}/${taskId}`).send({ action: 'pause' });
    expect(missing.status).toBe(401);
    expect((await patch(taskId, { action: 'pause' }, await expiredToken())).status).toBe(401);
    expect((await patch(taskId, { action: 'pause' }, unsignedToken())).status).toBe(401);
    expect((await ctx.db.models.Task.findById(taskId).lean())?.status).toBe('in_progress');
  });

  test('400 for unknown actions or malformed JSON', async () => {
    const taskId = await seedTask(ctx.deps, 'in_progress');
    for (const body of [{}, { action: 'done' }, { action: 'PAUSE' }, { action: ['pause'] }]) {
      expect((await patch(taskId, body)).status).toBe(400);
    }
    const malformed = await request(ctx.app)
      .patch(`${PATH}/${taskId}`)
      .set('Authorization', bearer(ctx.tokens.operator))
      .set('Content-Type', 'application/json')
      .send('{"action": ');
    expect(malformed.status).toBe(400);
  });

  test('unknown or odd ids -> 404/400 JSON, never 500', async () => {
    for (const id of ['does-not-exist', '65f0c0ffee0000000000dead', '%24ne', 'a'.repeat(300)]) {
      const res = await patch(id, { action: 'pause' });
      expect([400, 404]).toContain(res.status);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    const badEncoding = await patch('%E0%A4%A', { action: 'pause' });
    expect([400, 404]).toContain(badEncoding.status);
  });
});
