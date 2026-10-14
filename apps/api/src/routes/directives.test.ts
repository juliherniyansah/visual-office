import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { DirectiveSchema } from '@redhunter/shared';
import request from 'supertest';
import { InvalidEventError } from '../events/outbox';
import {
  bearer,
  expiredToken,
  startWorkContext,
  unsignedToken,
  type WorkContext,
} from '../test-support/work';

const PATH = '/api/v1/directives';
const ONE_MEGABYTE = 1024 * 1024;
let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([ctx.db.models.Directive.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
});

function post(token: string, body: unknown) {
  return request(ctx.app)
    .post(PATH)
    .set('Authorization', bearer(token))
    .send(body as object);
}

describe('POST /api/v1/directives', () => {
  test('operator creates an issued directive (201) and directive.created is stored', async () => {
    const res = await post(ctx.tokens.operator, {
      text: '  Build the AI Core room  ',
      priority: 'high',
      capabilityTags: ['code'],
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        issuedBy: { kind: 'human', id: ctx.subjects.operator },
        text: 'Build the AI Core room',
        status: 'issued',
        priority: 'high',
        capabilityTags: ['code'],
      },
    });
    const rows = await ctx.db.models.Event.find({}).lean();
    expect(rows.map((row) => row.type)).toEqual(['directive.created']);
    expect(rows[0]).toMatchObject({
      aggregate: { kind: 'directive', id: res.body.data.id },
      actor: { kind: 'human', id: ctx.subjects.operator },
      payload: { directive: res.body.data },
    });
  });

  test('owner may post; priority and capabilityTags default', async () => {
    const res = await post(ctx.tokens.owner, { text: 'Defaults please' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ priority: 'normal', capabilityTags: [] });
  });

  test('forged server-owned fields (id, status, issuedBy, createdBy, eventId) are ignored', async () => {
    const res = await post(ctx.tokens.operator, {
      text: 'Forgery attempt',
      id: 'attacker-id',
      status: 'draft',
      issuedBy: { kind: 'agent', id: 'ceo' },
      createdBy: 'ceo',
      eventId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe('attacker-id');
    expect(res.body.data).toMatchObject({
      status: 'issued',
      issuedBy: { kind: 'human', id: ctx.subjects.operator },
    });
    expect(() => DirectiveSchema.strict().parse(res.body.data)).not.toThrow();
    const row = await ctx.db.models.Event.findOne({ type: 'directive.created' }).lean();
    expect(row?.eventId).not.toBe('00000000-0000-4000-8000-000000000000');
  });

  test('viewer -> 403 from the real requireRole("operator"), nothing stored', async () => {
    const res = await post(ctx.tokens.viewer, { text: 'Viewer cannot direct' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Directive.countDocuments()).toBe(0);
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });

  test('no token, expired token and alg=none token -> 401', async () => {
    const missing = await request(ctx.app).post(PATH).send({ text: 'x' });
    const expired = await post(await expiredToken(), { text: 'x' });
    const unsigned = await post(unsignedToken(), { text: 'x' });
    for (const res of [missing, expired, unsigned]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Directive.countDocuments()).toBe(0);
  });

  test('400 for invalid bodies', async () => {
    const bodies: unknown[] = [
      {},
      { text: '' },
      { text: '    ' },
      { text: 42 },
      { text: 'ok', priority: 'urgent' },
      { text: 'ok', capabilityTags: 'code' },
      { text: 'ok', capabilityTags: [''] },
      { text: 'x'.repeat(4001) },
      [],
    ];
    for (const body of bodies) {
      const res = await post(ctx.tokens.operator, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
    expect(await ctx.db.models.Directive.countDocuments()).toBe(0);
  });

  test('capabilityTags count bound: 32 -> 201, 33 -> 400', async () => {
    const tags = (count: number) => Array.from({ length: count }, (_, i) => `tag-${i}`);
    const atLimit = await post(ctx.tokens.operator, { text: 'tags', capabilityTags: tags(32) });
    expect(atLimit.status).toBe(201);
    expect(atLimit.body.data.capabilityTags).toHaveLength(32);
    const overLimit = await post(ctx.tokens.operator, { text: 'tags', capabilityTags: tags(33) });
    expect(overLimit.status).toBe(400);
    expect(overLimit.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Directive.countDocuments()).toBe(1);
  });

  test('capabilityTags length bound: 64 chars -> 201, 65 chars -> 400', async () => {
    const atLimit = await post(ctx.tokens.operator, {
      text: 't',
      capabilityTags: ['a'.repeat(64)],
    });
    expect(atLimit.status).toBe(201);
    const overLimit = await post(ctx.tokens.operator, {
      text: 't',
      capabilityTags: ['a'.repeat(65)],
    });
    expect(overLimit.status).toBe(400);
    expect(overLimit.body).toEqual({ success: false, error: expect.any(String) });
    expect(await ctx.db.models.Directive.countDocuments()).toBe(1);
  });

  test('400 for malformed JSON, 413 for an oversized body', async () => {
    const malformed = await request(ctx.app)
      .post(PATH)
      .set('Authorization', bearer(ctx.tokens.operator))
      .set('Content-Type', 'application/json')
      .send('{"text": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ success: false, error: expect.any(String) });

    const huge = await post(ctx.tokens.operator, { text: 'x'.repeat(ONE_MEGABYTE) });
    expect(huge.status).toBe(413);
    expect(huge.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('emit failure surfaces as 500 JSON; the directive row stays (documented gap)', async () => {
    const emit = spyOn(ctx.outbox, 'emit').mockImplementationOnce(() =>
      Promise.reject(new InvalidEventError('forced')),
    );
    const logged = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await post(ctx.tokens.operator, { text: 'Emit will fail' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
      expect(logged).toHaveBeenCalled();
    } finally {
      emit.mockRestore();
      logged.mockRestore();
    }
    expect(await ctx.db.models.Directive.countDocuments({ text: 'Emit will fail' })).toBe(1);
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });
});

describe('GET /api/v1/directives', () => {
  test('viewer lists directives in creation order', async () => {
    const first = await post(ctx.tokens.operator, { text: 'one' });
    await Bun.sleep(5);
    const second = await post(ctx.tokens.owner, { text: 'two' });

    const res = await request(ctx.app).get(PATH).set('Authorization', bearer(ctx.tokens.viewer));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [first.body.data, second.body.data] });
    expect(JSON.stringify(res.body)).not.toContain('"_id"');
  });

  test('401 without token', async () => {
    const res = await request(ctx.app).get(PATH);
    expect(res.status).toBe(401);
  });
});
