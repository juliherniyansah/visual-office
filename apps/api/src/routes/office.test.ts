import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { type OfficeState, OfficeStateSchema } from '@redhunter/shared';
import request from 'supertest';
import { OFFICE_STATE_ID } from '../services/officeState';
import {
  bearer,
  expiredToken,
  startWorkContext,
  unsignedToken,
  type WorkContext,
} from '../test-support/work';

const PATH = '/api/v1/office/state';
let ctx: WorkContext;

const STORED: OfficeState = {
  version: 7,
  floors: [
    {
      id: 2,
      agents: [
        {
          agentId: 'programming',
          deskId: 'f2-programming',
          pose: 'sitting',
          status: 'working',
          activityLabel: 'Mengerjakan tugas',
          runId: 'run-1',
        },
      ],
    },
  ],
  drones: [{ id: 'worker-1', parentRunId: 'run-1', floorId: 2, label: 'explore' }],
  updatedAt: '2026-10-09T05:00:00.000Z',
};

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await ctx.db.connection.collection('office_state').deleteMany({});
});

function get(token: string, query = '') {
  return request(ctx.app).get(`${PATH}${query}`).set('Authorization', bearer(token));
}

describe('GET /api/v1/office/state', () => {
  test('empty DB -> deterministic initial state for every role, nothing persisted', async () => {
    const bodies: unknown[] = [];
    for (const token of [ctx.tokens.viewer, ctx.tokens.operator, ctx.tokens.owner]) {
      const res = await get(token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(() => OfficeStateSchema.strict().parse(res.body.data)).not.toThrow();
      bodies.push(res.body.data);
    }
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(bodies[0]).toMatchObject({
      version: 0,
      drones: [],
      updatedAt: '1970-01-01T00:00:00.000Z',
    });
    expect(await ctx.db.connection.collection('office_state').countDocuments()).toBe(0);
  });

  test('returns the stored singleton re-validated, without _id or unknown fields', async () => {
    await ctx.db.connection.collection<{ _id: string }>('office_state').insertOne({
      _id: OFFICE_STATE_ID,
      ...STORED,
      updatedAt: new Date(STORED.updatedAt),
      internalNote: 'projector debug data',
    } as { _id: string });
    const res = await get(ctx.tokens.viewer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: STORED });
    expect(JSON.stringify(res.body)).not.toContain('projector debug data');
  });

  test('corrupt stored singleton -> 500 generic JSON, no internals leaked', async () => {
    await ctx.db.connection.collection<{ _id: string }>('office_state').insertOne({
      _id: OFFICE_STATE_ID,
      version: -1,
      floors: 'not-an-array',
      drones: [],
      updatedAt: new Date(),
    } as { _id: string });
    const logged = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await get(ctx.tokens.viewer);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
      const text = JSON.stringify(res.body);
      for (const leak of ['floors', 'version', 'not-an-array', 'Zod', 'stack']) {
        expect(text).not.toContain(leak);
      }
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });

  test('query keys, including operator injection, are ignored', async () => {
    for (const query of ['?version[$gt]=0', '?_id=other', '?version=1&version=1']) {
      const res = await get(ctx.tokens.viewer, query);
      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(0);
    }
  });

  test('no token, expired token and alg=none token -> 401', async () => {
    const responses = [
      await request(ctx.app).get(PATH),
      await get(await expiredToken()),
      await get(unsignedToken()),
    ];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
  });
});

describe('no write route for office state or agent status', () => {
  test('POST/PUT/PATCH/DELETE on office state and agent paths -> 404, nothing stored', async () => {
    const auth = bearer(ctx.tokens.owner);
    const paths = [PATH, '/api/v1/office', '/api/v1/agents', '/api/v1/agents/programming'];
    for (const path of paths) {
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await request(ctx.app)
          [method](path)
          .set('Authorization', auth)
          .send({ version: 99, status: 'working' });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ success: false, error: expect.any(String) });
      }
    }
    for (const status of ['/api/v1/agents/programming/status', '/api/v1/office/state/agents']) {
      expect((await request(ctx.app).patch(status).set('Authorization', auth)).status).toBe(404);
    }
    expect(await ctx.db.connection.collection('office_state').countDocuments()).toBe(0);
  });
});
