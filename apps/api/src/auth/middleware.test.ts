import { describe, expect, test } from 'bun:test';
import type { HumanRole } from '@redhunter/shared';
import express, { type Express } from 'express';
import request from 'supertest';
import { createRequireAuth, hasRole, requireRole } from './middleware';
import { signAccessToken } from './token';

const SECRET = 'middleware-test-secret-0123456789ab';
const USER_ID = '65f0c0ffee0000000000abcd';

// Test-only app: no operator route exists yet in todo 3, so RBAC is exercised on a stub.
function createProtectedApp(): Express {
  const app = express();
  const requireAuth = createRequireAuth(SECRET);
  app.get('/viewer-area', requireAuth, requireRole('viewer'), (_req, res) => {
    res.json({ success: true, data: 'viewer-ok' });
  });
  app.post('/operator-area', requireAuth, requireRole('operator'), (req, res) => {
    res.json({ success: true, data: req.auth });
  });
  app.post('/owner-area', requireAuth, requireRole('owner'), (_req, res) => {
    res.json({ success: true, data: 'owner-ok' });
  });
  app.get('/no-auth-then-role', requireRole('viewer'), (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

async function tokenFor(role: HumanRole): Promise<string> {
  return signAccessToken({ sub: USER_ID, role }, SECRET);
}

describe('hasRole', () => {
  test('applies hierarchy owner > operator > viewer', () => {
    expect(hasRole('owner', 'operator')).toBe(true);
    expect(hasRole('owner', 'owner')).toBe(true);
    expect(hasRole('operator', 'operator')).toBe(true);
    expect(hasRole('operator', 'viewer')).toBe(true);
    expect(hasRole('operator', 'owner')).toBe(false);
    expect(hasRole('viewer', 'viewer')).toBe(true);
    expect(hasRole('viewer', 'operator')).toBe(false);
    expect(hasRole('viewer', 'owner')).toBe(false);
  });
});

describe('requireAuth', () => {
  const app = createProtectedApp();

  test('401 without Authorization header, with WWW-Authenticate and error shape', async () => {
    const res = await request(app).post('/operator-area');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('401 for malformed headers', async () => {
    const headers = ['Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'Token abc', 'Bearer a b'];
    for (const header of headers) {
      const res = await request(app).post('/operator-area').set('Authorization', header);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  test('401 for an invalid token', async () => {
    const res = await request(app).post('/operator-area').set('Authorization', 'Bearer a.b.c');
    expect(res.status).toBe(401);
  });

  test('accepts the scheme case-insensitively', async () => {
    const token = await tokenFor('operator');
    const res = await request(app).post('/operator-area').set('Authorization', `bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('requireRole without requireAuth fails closed with 401', async () => {
    const res = await request(app).get('/no-auth-then-role');
    expect(res.status).toBe(401);
  });
});

describe("requireRole('operator')", () => {
  const app = createProtectedApp();

  test('403 for a viewer', async () => {
    const res = await request(app)
      .post('/operator-area')
      .set('Authorization', `Bearer ${await tokenFor('viewer')}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: expect.any(String) });
  });

  test('200 for operator and owner, claims attached to req.auth', async () => {
    for (const role of ['operator', 'owner'] as const) {
      const res = await request(app)
        .post('/operator-area')
        .set('Authorization', `Bearer ${await tokenFor(role)}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { sub: USER_ID, role } });
    }
  });

  test("requireRole('owner') rejects operator with 403", async () => {
    const res = await request(app)
      .post('/owner-area')
      .set('Authorization', `Bearer ${await tokenFor('operator')}`);
    expect(res.status).toBe(403);
  });

  test("requireRole('viewer') admits a viewer", async () => {
    const res = await request(app)
      .get('/viewer-area')
      .set('Authorization', `Bearer ${await tokenFor('viewer')}`);
    expect(res.status).toBe(200);
  });
});
