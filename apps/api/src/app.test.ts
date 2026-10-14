import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { AGENT_IDS, type HumanRole, PublicUserSchema } from '@redhunter/shared';
import express from 'express';
import request from 'supertest';
import { createApp } from './app';
import { createRequireAuth, requireRole } from './auth/middleware';
import { hashPassword } from './auth/password';
import { signAccessToken } from './auth/token';
import { createOutbox } from './events/outbox';
import { runSeed } from './seed';
import { createTestDatabase, type TestDatabase } from './test-support/database';

const SECRET = 'app-test-secret-0123456789abcdefgh';
const OWNER = { email: 'owner@example.test', password: 'owner-password-123' };
const VIEWER = { email: 'viewer@example.test', password: 'viewer-password-123' };
const OPERATOR = { email: 'operator@example.test', password: 'operator-password-123' };
const LOGIN_PATH = '/api/v1/auth/login';
const ONE_MEGABYTE = 1024 * 1024;

let db: TestDatabase;
let app: express.Express;

async function createUser(credentials: typeof VIEWER, role: HumanRole): Promise<void> {
  await db.models.User.create({
    email: credentials.email,
    passwordHash: await hashPassword(credentials.password),
    role,
  });
}

async function login(credentials: { email: string; password: string }): Promise<string> {
  const res = await request(app).post(LOGIN_PATH).send(credentials);
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

beforeAll(async () => {
  db = await createTestDatabase();
  await runSeed({ models: db.models, owner: OWNER });
  await Promise.all([createUser(VIEWER, 'viewer'), createUser(OPERATOR, 'operator')]);
  app = createApp({ models: db.models, jwtSecret: SECRET, outbox: createOutbox(db) });
});

afterAll(async () => {
  await db.drop();
});

describe('POST /api/v1/auth/login', () => {
  test('returns a JWT and the public user (no passwordHash)', async () => {
    const res = await request(app).post(LOGIN_PATH).send(OWNER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      email: OWNER.email,
      role: 'owner',
    });
    expect(() => PublicUserSchema.strict().parse(res.body.data.user)).not.toThrow();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('email lookup is case-insensitive and trimmed', async () => {
    const res = await request(app)
      .post(LOGIN_PATH)
      .send({ email: '  OWNER@Example.Test ', password: OWNER.password });
    expect(res.status).toBe(200);
  });

  test('wrong password and unknown email both get 401 with the identical body', async () => {
    const wrongPassword = await request(app)
      .post(LOGIN_PATH)
      .send({ email: OWNER.email, password: 'not-the-password' });
    const unknownEmail = await request(app)
      .post(LOGIN_PATH)
      .send({ email: 'nobody@example.test', password: 'not-the-password' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ success: false, error: expect.any(String) });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  test('400 for empty body, missing fields and non-string credentials', async () => {
    const bodies: unknown[] = [
      {},
      { email: OWNER.email },
      { password: OWNER.password },
      { email: 123, password: OWNER.password },
      { email: OWNER.email, password: 123456 },
      { email: { $ne: null }, password: { $ne: null } },
      { email: [OWNER.email], password: [OWNER.password] },
      { email: '', password: '' },
    ];
    for (const body of bodies) {
      const res = await request(app)
        .post(LOGIN_PATH)
        .send(body as object);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: expect.any(String) });
    }
  });

  test('400 when no JSON body is sent at all', async () => {
    const res = await request(app).post(LOGIN_PATH);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('400 JSON error for malformed JSON', async () => {
    const res = await request(app)
      .post(LOGIN_PATH)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('413 JSON error for a huge payload', async () => {
    const res = await request(app)
      .post(LOGIN_PATH)
      .send({ email: OWNER.email, password: 'x'.repeat(ONE_MEGABYTE) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('400 for an over-long password (bounded KDF work)', async () => {
    const res = await request(app)
      .post(LOGIN_PATH)
      .send({ email: OWNER.email, password: 'x'.repeat(2000) });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/me', () => {
  test('returns the PublicUser for the bearer token', async () => {
    const token = await login(VIEWER);
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { id: expect.any(String), email: VIEWER.email, role: 'viewer' },
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('401 without token', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('401 for a valid token whose user no longer exists', async () => {
    const ghostToken = await signAccessToken(
      { sub: '65f0c0ffee0000000000dead', role: 'owner' },
      SECRET,
    );
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${ghostToken}`);
    expect(res.status).toBe(401);
  });

  test('401 for a valid token whose sub is not an ObjectId', async () => {
    const token = await signAccessToken({ sub: 'not-an-object-id', role: 'owner' }, SECRET);
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/agents', () => {
  test('viewer gets the 7 seeded agents in hierarchy order with exact capabilityTags', async () => {
    const token = await login(VIEWER);
    const res = await request(app).get('/api/v1/agents').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const agents = res.body.data as { id: string; capabilityTags: string[] }[];
    expect(agents.map((agent) => agent.id)).toEqual([...AGENT_IDS]);
    expect(Object.fromEntries(agents.map((agent) => [agent.id, agent.capabilityTags]))).toEqual({
      ceo: ['direct'],
      coo: ['route', 'process'],
      cto: ['route', 'technical'],
      programming: ['code'],
      game: ['game'],
      iot: ['iot'],
      ai_development: ['ai'],
    });
    expect(JSON.stringify(res.body)).not.toContain('"_id"');
  });

  test('401 without token and with a tampered token', async () => {
    const token = await login(VIEWER);
    const tampered = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
    const missing = await request(app).get('/api/v1/agents');
    const forged = await request(app)
      .get('/api/v1/agents')
      .set('Authorization', `Bearer ${tampered}`);
    expect(missing.status).toBe(401);
    expect(forged.status).toBe(401);
  });
});

describe('RBAC with real login tokens', () => {
  // No operator route ships in todo 3; reuse the production middleware on a stub POST.
  const stub = express();
  stub.post('/directives', createRequireAuth(SECRET), requireRole('operator'), (_req, res) => {
    res.status(201).json({ success: true });
  });

  test("viewer POST -> 403 from requireRole('operator')", async () => {
    const res = await request(stub)
      .post('/directives')
      .set('Authorization', `Bearer ${await login(VIEWER)}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('operator and owner POST -> 201', async () => {
    for (const credentials of [OPERATOR, OWNER]) {
      const res = await request(stub)
        .post('/directives')
        .set('Authorization', `Bearer ${await login(credentials)}`);
      expect(res.status).toBe(201);
    }
  });
});

describe('app shell', () => {
  test('unknown route -> 404 JSON', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('does not advertise Express', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('no route writes agent status', async () => {
    const token = await login(OWNER);
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await request(app)
        [method]('/api/v1/agents')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    }
  });
});
