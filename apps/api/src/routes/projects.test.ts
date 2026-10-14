import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { ProjectSchema } from '@redhunter/shared';
import request from 'supertest';
import {
  bearer,
  expiredToken,
  startWorkContext,
  unsignedToken,
  type WorkContext,
} from '../test-support/work';

const PATH = '/api/v1/projects';
const ONE_MEGABYTE = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VALID = { name: 'RedHunter Web', repoPath: '/srv/repos/redhunter-web' };
let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([ctx.db.models.Project.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
});

function post(token: string, body: unknown) {
  return request(ctx.app)
    .post(PATH)
    .set('Authorization', bearer(token))
    .send(body as object);
}

function list(token: string, query = '') {
  return request(ctx.app).get(`${PATH}${query}`).set('Authorization', bearer(token));
}

describe('POST /api/v1/projects', () => {
  test('operator creates a project (201): name trimmed, adapter defaults to opencode, no event', async () => {
    const res = await post(ctx.tokens.operator, { ...VALID, name: '  RedHunter Web  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.stringMatching(UUID),
        name: 'RedHunter Web',
        repoPath: VALID.repoPath,
        defaultAdapter: 'opencode',
      },
    });
    expect(() => ProjectSchema.strict().parse(res.body.data)).not.toThrow();
    expect(await ctx.db.models.Project.countDocuments()).toBe(1);
    // No project.* type exists in the shared event catalog (decisions.md Task: 5b).
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });

  test('owner may post and choose the adapter', async () => {
    const res = await post(ctx.tokens.owner, { ...VALID, defaultAdapter: 'codex' });
    expect(res.status).toBe(201);
    expect(res.body.data.defaultAdapter).toBe('codex');
  });

  test('forged server-owned fields are ignored (id, _id, createdBy, createdAt, eventId, status)', async () => {
    const res = await post(ctx.tokens.operator, {
      ...VALID,
      id: 'attacker-id',
      _id: 'attacker-mongo-id',
      createdBy: 'ceo',
      createdAt: '2000-01-01T00:00:00.000Z',
      eventId: '00000000-0000-4000-8000-000000000000',
      status: 'archived',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toMatch(UUID);
    expect(() => ProjectSchema.strict().parse(res.body.data)).not.toThrow();
    const stored = await ctx.db.models.Project.findById(res.body.data.id).lean();
    expect(stored?.createdAt.getFullYear()).toBeGreaterThan(2000);
    expect(await ctx.db.models.Project.countDocuments({ _id: 'attacker-mongo-id' })).toBe(0);
    expect(JSON.stringify(stored)).not.toContain('attacker');
  });

  test('viewer -> 403 from requireRole("operator"), nothing stored', async () => {
    const res = await post(ctx.tokens.viewer, VALID);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Project.countDocuments()).toBe(0);
  });

  test('no token, expired token and alg=none token -> 401, nothing stored', async () => {
    const missing = await request(ctx.app).post(PATH).send(VALID);
    const expired = await post(await expiredToken(), VALID);
    const unsigned = await post(unsignedToken(), VALID);
    for (const res of [missing, expired, unsigned]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Project.countDocuments()).toBe(0);
  });

  test('400 for invalid bodies, operator injection and unsafe repo paths', async () => {
    const bodies: unknown[] = [
      {},
      { name: VALID.name },
      { repoPath: VALID.repoPath },
      { ...VALID, name: '' },
      { ...VALID, name: '   ' },
      { ...VALID, name: 42 },
      { ...VALID, name: { $ne: null } },
      { ...VALID, repoPath: { $ne: null } },
      { ...VALID, repoPath: 'relative/repo' },
      { ...VALID, repoPath: '/srv/../etc' },
      { ...VALID, repoPath: '/srv/./repo' },
      { ...VALID, repoPath: '/srv//repo' },
      { ...VALID, repoPath: '/srv/repo\u0000x' },
      { ...VALID, defaultAdapter: 'cursor' },
      [],
    ];
    for (const body of bodies) {
      const res = await post(ctx.tokens.operator, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Project.countDocuments()).toBe(0);
  });

  test('name bound: 120 chars -> 201, 121 chars -> 400', async () => {
    expect((await post(ctx.tokens.operator, { ...VALID, name: 'n'.repeat(120) })).status).toBe(201);
    expect((await post(ctx.tokens.operator, { ...VALID, name: 'm'.repeat(121) })).status).toBe(400);
    expect(await ctx.db.models.Project.countDocuments()).toBe(1);
  });

  test('repoPath bound: 1024 chars -> 201, 1025 chars -> 400', async () => {
    const atLimit = `/${'a'.repeat(1023)}`;
    const overLimit = `/${'b'.repeat(1024)}`;
    const ok = await post(ctx.tokens.operator, { name: 'limit', repoPath: atLimit });
    expect(ok.status).toBe(201);
    expect(ok.body.data.repoPath).toBe(atLimit);
    expect((await post(ctx.tokens.operator, { name: 'over', repoPath: overLimit })).status).toBe(
      400,
    );
    expect(await ctx.db.models.Project.countDocuments()).toBe(1);
  });

  test('trailing slash and root-level paths are accepted as already normalized', async () => {
    for (const repoPath of ['/srv/repo/', '/repo']) {
      const res = await post(ctx.tokens.operator, { name: repoPath, repoPath });
      expect(res.status).toBe(201);
      expect(res.body.data.repoPath).toBe(repoPath);
    }
  });

  test('400 for malformed JSON, 413 for an oversized body', async () => {
    const malformed = await request(ctx.app)
      .post(PATH)
      .set('Authorization', bearer(ctx.tokens.operator))
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ success: false, error: expect.any(String) });
    const huge = await post(ctx.tokens.operator, { ...VALID, name: 'x'.repeat(ONE_MEGABYTE) });
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ success: false, error: expect.any(String) });
  });
});

describe('GET /api/v1/projects', () => {
  test('viewer, operator and owner list projects in creation order', async () => {
    const first = await post(ctx.tokens.operator, { ...VALID, name: 'first' });
    await Bun.sleep(5);
    const second = await post(ctx.tokens.operator, { ...VALID, name: 'second' });
    for (const token of [ctx.tokens.viewer, ctx.tokens.operator, ctx.tokens.owner]) {
      const res = await list(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: [first.body.data, second.body.data] });
    }
    expect(JSON.stringify((await list(ctx.tokens.viewer)).body)).not.toContain('createdAt');
  });

  test('query keys, including operator injection, are ignored (no filter, no 500)', async () => {
    await post(ctx.tokens.operator, VALID);
    for (const query of ['?name[$ne]=x', '?name=nothing', '?name=a&name=a', '?$where=1']) {
      const res = await list(ctx.tokens.viewer, query);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }
  });

  test('401 without token', async () => {
    expect((await request(ctx.app).get(PATH)).status).toBe(401);
  });
});

describe('no other project routes', () => {
  test('GET /projects/:id and PUT/PATCH/DELETE -> 404 JSON', async () => {
    const created = await post(ctx.tokens.operator, VALID);
    const id = created.body.data.id as string;
    const auth = bearer(ctx.tokens.owner);
    const responses = [
      await request(ctx.app).get(`${PATH}/${id}`).set('Authorization', auth),
      await request(ctx.app)
        .get(`${PATH}/${'z'.repeat(300)}`)
        .set('Authorization', auth),
      await request(ctx.app).put(`${PATH}/${id}`).set('Authorization', auth).send(VALID),
      await request(ctx.app).patch(`${PATH}/${id}`).set('Authorization', auth).send(VALID),
      await request(ctx.app).delete(`${PATH}/${id}`).set('Authorization', auth),
      await request(ctx.app).delete(PATH).set('Authorization', auth),
    ];
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Project.countDocuments()).toBe(1);
  });
});
