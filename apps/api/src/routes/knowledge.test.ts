import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { KnowledgeDocSchema } from '@redhunter/shared';
import request from 'supertest';
import {
  bearer,
  expiredToken,
  startWorkContext,
  unsignedToken,
  type WorkContext,
} from '../test-support/work';

const PATH = '/api/v1/knowledge';
const ONE_MEGABYTE = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VALID = { title: 'Coding standards', text: '  Use strict TypeScript.\n', tags: ['code'] };
let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([ctx.db.models.Knowledge.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
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

describe('POST /api/v1/knowledge', () => {
  test('operator ingests a doc (201): title trimmed, text kept verbatim, no event', async () => {
    const res = await post(ctx.tokens.operator, { ...VALID, title: '  Coding standards ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.stringMatching(UUID),
        title: 'Coding standards',
        text: VALID.text,
        tags: ['code'],
      },
    });
    expect(() => KnowledgeDocSchema.strict().parse(res.body.data)).not.toThrow();
    // No knowledge.* type exists in the shared event catalog (decisions.md Task: 5b).
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });

  test('owner may post; tags default to []', async () => {
    const res = await post(ctx.tokens.owner, { title: 't', text: 'body' });
    expect(res.status).toBe(201);
    expect(res.body.data.tags).toEqual([]);
  });

  test('forged server-owned fields are ignored (id, _id, createdBy, createdAt, eventId, status)', async () => {
    const res = await post(ctx.tokens.operator, {
      ...VALID,
      id: 'attacker-id',
      _id: 'attacker-mongo-id',
      createdBy: 'ceo',
      createdAt: '2000-01-01T00:00:00.000Z',
      eventId: '00000000-0000-4000-8000-000000000000',
      status: 'published',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toMatch(UUID);
    expect(() => KnowledgeDocSchema.strict().parse(res.body.data)).not.toThrow();
    const stored = await ctx.db.models.Knowledge.findById(res.body.data.id).lean();
    expect(stored?.createdAt.getFullYear()).toBeGreaterThan(2000);
    expect(JSON.stringify(stored)).not.toContain('attacker');
  });

  test('viewer -> 403, nothing stored', async () => {
    const res = await post(ctx.tokens.viewer, VALID);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(0);
  });

  test('no token, expired token and alg=none token -> 401, nothing stored', async () => {
    const missing = await request(ctx.app).post(PATH).send(VALID);
    const expired = await post(await expiredToken(), VALID);
    const unsigned = await post(unsignedToken(), VALID);
    for (const res of [missing, expired, unsigned]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(0);
  });

  test('400 for invalid bodies and operator injection', async () => {
    const bodies: unknown[] = [
      {},
      { title: 't' },
      { text: 'x' },
      { ...VALID, title: '' },
      { ...VALID, title: '   ' },
      { ...VALID, text: '' },
      { ...VALID, text: ' \n\t ' },
      { ...VALID, title: { $ne: null } },
      { ...VALID, text: { $gt: '' } },
      { ...VALID, tags: 'code' },
      { ...VALID, tags: [''] },
      { ...VALID, tags: [{ $ne: null }] },
      [],
    ];
    for (const body of bodies) {
      const res = await post(ctx.tokens.operator, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(0);
  });

  test('title bound: 200 chars -> 201, 201 chars -> 400', async () => {
    expect((await post(ctx.tokens.operator, { ...VALID, title: 't'.repeat(200) })).status).toBe(
      201,
    );
    expect((await post(ctx.tokens.operator, { ...VALID, title: 't'.repeat(201) })).status).toBe(
      400,
    );
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(1);
  });

  test('text bound: 12000 chars -> 201, 12001 chars -> 400', async () => {
    const ok = await post(ctx.tokens.operator, { ...VALID, text: 'a'.repeat(12000) });
    expect(ok.status).toBe(201);
    expect(ok.body.data.text).toHaveLength(12000);
    expect((await post(ctx.tokens.operator, { ...VALID, text: 'a'.repeat(12001) })).status).toBe(
      400,
    );
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(1);
  });

  test('tags bounds: 32 tags -> 201, 33 -> 400; 64-char tag -> 201, 65 -> 400', async () => {
    const tags = (count: number) => Array.from({ length: count }, (_, i) => `tag-${i}`);
    expect((await post(ctx.tokens.operator, { ...VALID, tags: tags(32) })).status).toBe(201);
    expect((await post(ctx.tokens.operator, { ...VALID, tags: tags(33) })).status).toBe(400);
    expect((await post(ctx.tokens.operator, { ...VALID, tags: ['a'.repeat(64)] })).status).toBe(
      201,
    );
    expect((await post(ctx.tokens.operator, { ...VALID, tags: ['a'.repeat(65)] })).status).toBe(
      400,
    );
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(2);
  });

  test('400 for malformed JSON, 413 for an oversized body', async () => {
    const malformed = await request(ctx.app)
      .post(PATH)
      .set('Authorization', bearer(ctx.tokens.operator))
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ success: false, error: expect.any(String) });
    const huge = await post(ctx.tokens.operator, { ...VALID, text: 'x'.repeat(ONE_MEGABYTE) });
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ success: false, error: expect.any(String) });
  });
});

describe('GET /api/v1/knowledge', () => {
  test('viewer, operator and owner list docs in creation order without storage fields', async () => {
    const first = await post(ctx.tokens.operator, { ...VALID, title: 'first' });
    await Bun.sleep(5);
    const second = await post(ctx.tokens.owner, { ...VALID, title: 'second' });
    for (const token of [ctx.tokens.viewer, ctx.tokens.operator, ctx.tokens.owner]) {
      const res = await list(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: [first.body.data, second.body.data] });
    }
    const body = JSON.stringify((await list(ctx.tokens.viewer)).body);
    expect(body).not.toContain('createdAt');
    expect(body).not.toContain('"_id"');
  });

  test('query keys, including operator injection, are ignored (no filter, no 500)', async () => {
    await post(ctx.tokens.operator, VALID);
    for (const query of ['?title[$ne]=x', '?tags=none', '?tags=a&tags=a', '?$where=1']) {
      const res = await list(ctx.tokens.viewer, query);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }
  });

  test('401 without token; other methods and :id paths -> 404', async () => {
    expect((await request(ctx.app).get(PATH)).status).toBe(401);
    const auth = bearer(ctx.tokens.owner);
    for (const res of [
      await request(ctx.app).get(`${PATH}/some-id`).set('Authorization', auth),
      await request(ctx.app).put(PATH).set('Authorization', auth).send(VALID),
      await request(ctx.app).patch(`${PATH}/some-id`).set('Authorization', auth).send(VALID),
      await request(ctx.app).delete(`${PATH}/some-id`).set('Authorization', auth),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
  });

  test('corrupt stored row -> 500 generic body, row contents not leaked', async () => {
    await ctx.db.connection.collection<{ _id: string }>('knowledge_docs').insertOne({
      _id: 'bad-row-id',
      title: '',
      text: 'secret-corrupt-text',
      tags: 'nope',
      createdAt: new Date(),
    } as { _id: string });
    const logged = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await list(ctx.tokens.viewer);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: 'Terjadi kesalahan internal' });
      for (const leak of ['bad-row-id', 'secret-corrupt-text', 'nope', 'tags', 'Zod']) {
        expect(JSON.stringify(res.body)).not.toContain(leak);
      }
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  // One invalid field per row: proves each field is re-validated on its own at the HTTP layer.
  test.each([
    ['tags only', { _id: 'tags-only-row-id', title: 'ok', text: 'x', tags: 'nope' }, ['nope']],
    ['missing title', { _id: 'no-title-row-id', text: 'secret-body', tags: [] }, ['secret-body']],
    ['missing text', { _id: 'no-text-row-id', title: 'secret-title', tags: [] }, ['secret-title']],
  ] as const)(
    'corrupt row (%s) -> 500 generic body, nothing leaked',
    async (_label, row, values) => {
      await ctx.db.connection
        .collection<{ _id: string } & Record<string, unknown>>('knowledge_docs')
        .insertOne({ ...row, createdAt: new Date() });
      const logged = spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await list(ctx.tokens.viewer);
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'Terjadi kesalahan internal' });
        for (const leak of [row._id, 'tags', 'title', 'text', 'Zod', ...values]) {
          expect(JSON.stringify(res.body)).not.toContain(leak);
        }
      } finally {
        logged.mockRestore();
      }
    },
  );
});

describe('16kb JSON body limit (bytes, not chars)', () => {
  // 'é' is 2 bytes in UTF-8: both texts are under the 12000-char cap, only the byte limit decides.
  test('~16.0 KB body -> 201, ~16.6 KB body -> 413', async () => {
    const underLimit = await post(ctx.tokens.operator, { title: 'utf8', text: 'é'.repeat(8000) });
    expect(underLimit.status).toBe(201);
    const overLimit = await post(ctx.tokens.operator, { title: 'utf8', text: 'é'.repeat(8300) });
    expect(overLimit.status).toBe(413);
    expect(overLimit.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Knowledge.countDocuments()).toBe(1);
  });
});
