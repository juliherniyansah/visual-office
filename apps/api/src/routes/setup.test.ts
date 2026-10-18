import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app';
import { createOutbox } from '../events/outbox';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { ERROR_MESSAGES } from '../http/response';
import { MIN_OWNER_PASSWORD_LENGTH } from '../auth/credentials';

const PATH_STATUS = '/api/v1/auth/setup-status';
const PATH_SETUP = '/api/v1/auth/setup';
const TEST_SECRET = 'setup-test-secret-0123456789abcdefghij';

let db: TestDatabase;
let app: Express;

beforeAll(async () => {
  db = await createTestDatabase();
  const outbox = createOutbox({ models: db.models });
  app = createApp({ models: db.models, jwtSecret: TEST_SECRET, outbox });
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.models.User.deleteMany({});
});

describe('GET /auth/setup-status', () => {
  test('returns setupComplete: false on empty DB', async () => {
    const res = await request(app).get(PATH_STATUS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ setupComplete: false });
  });

  test('returns setupComplete: true after user exists', async () => {
    await db.models.User.create({
      email: 'owner@example.com',
      passwordHash: 'x',
      role: 'owner',
    });

    const res = await request(app).get(PATH_STATUS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ setupComplete: true });
  });
});

describe('POST /auth/setup', () => {
  const validBody = {
    email: 'owner@example.com',
    password: 'super-secret-12',
    confirmPassword: 'super-secret-12',
  };

  test('creates owner user and returns JWT on empty DB', async () => {
    const res = await request(app).post(PATH_SETUP).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThan(0);

    const user = await db.models.User.findOne({ email: 'owner@example.com' });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('owner');
    expect(user!.passwordHash).not.toBe(validBody.password);
  });

  test('returns 409 SETUP_CONFLICT if users exist', async () => {
    await db.models.User.create({
      email: 'existing@example.com',
      passwordHash: 'x',
      role: 'owner',
    });

    const res = await request(app).post(PATH_SETUP).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(ERROR_MESSAGES.setupConflict);
  });

  test('validates input: password mismatch', async () => {
    const res = await request(app).post(PATH_SETUP).send({
      email: 'owner@example.com',
      password: 'super-secret-12',
      confirmPassword: 'different-password',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('validates input: short password', async () => {
    const res = await request(app).post(PATH_SETUP).send({
      email: 'owner@example.com',
      password: 'short',
      confirmPassword: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
