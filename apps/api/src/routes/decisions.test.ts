import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Decision } from '@redhunter/shared';
import express from 'express';
import request from 'supertest';
import { createRequireAuth, requireRole } from '../auth/middleware';
import { createDecisionsRouter, type DecisionsRouteDeps } from './decisions';
import { signAccessToken } from '../auth/token';

const JWT_SECRET = 'test-secret-0123456789abcdefghij';

interface TestHarness {
  app: express.Express;
  decisions: Map<string, Decision>;
  clock: () => Date;
  setClock: (fn: () => Date) => void;
  viewerToken: string;
  operatorToken: string;
}

async function createHarness(): Promise<TestHarness> {
  const decisions = new Map<string, Decision>();
  let currentTime = new Date('2026-01-01T12:00:00.000Z');
  let clockFn = () => currentTime;

  const deps: DecisionsRouteDeps = {
    runtime: {
      answerPermission: async (_runId: string, _permissionId: string, _decision: 'allow' | 'deny') => {
        // Mock implementation
      },
    } as any,
    requireAuth: createRequireAuth(JWT_SECRET),
    decisions: {
      findById: async (id: string) => decisions.get(id) ?? null,
      update: async (id: string, patch: Partial<Decision>) => {
        const existing = decisions.get(id);
        if (!existing) throw new Error(`Decision ${id} not found`);
        const updated = { ...existing, ...patch };
        decisions.set(id, updated);
        return updated;
      },
      listPending: async () => Array.from(decisions.values()).filter((d) => !d.answeredAt),
    },
    clock: () => clockFn(),
  };

  const app = express();
  app.use(express.json());
  app.use('/api', createDecisionsRouter(deps));

  const viewerToken = await signAccessToken(
    { sub: 'user-viewer', role: 'viewer' },
    JWT_SECRET,
  );
  const operatorToken = await signAccessToken(
    { sub: 'user-operator', role: 'operator' },
    JWT_SECRET,
  );

  return {
    app,
    decisions,
    clock: () => currentTime,
    setClock: (fn: () => Date) => {
      clockFn = fn;
    },
    viewerToken,
    operatorToken,
  };
}

describe('decisions route', () => {
  let h: TestHarness;

  beforeAll(async () => {
    h = await createHarness();
  });

  describe('GET /api/decisions', () => {
    test('viewer can list decisions', async () => {
      const decision: Decision = {
        id: 'dec-1',
        runId: 'run-1',
        question: 'Allow tool X?',
        options: ['allow', 'deny'],
        createdAt: h.clock().toISOString(),
      };
      h.decisions.set(decision.id, decision);

      const res = await request(h.app)
        .get('/api/decisions')
        .set('authorization', `Bearer ${h.viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.decisions).toHaveLength(1);
      expect(res.body.decisions[0].id).toBe('dec-1');
    });

    test('unauthenticated returns 401', async () => {
      const res = await request(h.app).get('/api/decisions');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/decisions/:id/answer', () => {
    test('viewer gets 403', async () => {
      const decision: Decision = {
        id: 'dec-2',
        runId: 'run-2',
        question: 'Allow tool Y?',
        options: ['allow', 'deny'],
        createdAt: h.clock().toISOString(),
      };
      h.decisions.set(decision.id, decision);

      const res = await request(h.app)
        .post(`/api/decisions/${decision.id}/answer`)
        .set('authorization', `Bearer ${h.viewerToken}`)
        .send({ answer: 'allow' });

      expect(res.status).toBe(403);
    });

    test('operator can answer pending decision', async () => {
      const decision: Decision = {
        id: 'dec-3',
        runId: 'run-3',
        question: 'Allow tool Z?',
        options: ['allow', 'deny'],
        createdAt: h.clock().toISOString(),
      };
      h.decisions.set(decision.id, decision);

      const res = await request(h.app)
        .post(`/api/decisions/${decision.id}/answer`)
        .set('authorization', `Bearer ${h.operatorToken}`)
        .send({ answer: 'allow' });

      expect(res.status).toBe(200);
      expect(res.body.decision.answeredAt).toBeDefined();
      expect(res.body.decision.answer).toBe('allow');
    });

    test('already answered returns 409', async () => {
      const decision: Decision = {
        id: 'dec-4',
        runId: 'run-4',
        question: 'Allow tool W?',
        options: ['allow', 'deny'],
        createdAt: h.clock().toISOString(),
        answeredAt: h.clock().toISOString(),
        answer: 'deny',
        answeredBy: 'user-operator',
      };
      h.decisions.set(decision.id, decision);

      const res = await request(h.app)
        .post(`/api/decisions/${decision.id}/answer`)
        .set('authorization', `Bearer ${h.operatorToken}`)
        .send({ answer: 'allow' });

      expect(res.status).toBe(409);
    });

    test('expired decision returns 410', async () => {
      const thirtyOneMinAgo = new Date(h.clock().getTime() - 31 * 60 * 1000);
      const decision: Decision = {
        id: 'dec-5',
        runId: 'run-5',
        question: 'Allow tool V?',
        options: ['allow', 'deny'],
        createdAt: thirtyOneMinAgo.toISOString(),
      };
      h.decisions.set(decision.id, decision);

      const res = await request(h.app)
        .post(`/api/decisions/${decision.id}/answer`)
        .set('authorization', `Bearer ${h.operatorToken}`)
        .send({ answer: 'allow' });

      expect(res.status).toBe(410);
      expect(res.body.error).toContain('expired');
    });

    test('not found returns 404', async () => {
      const res = await request(h.app)
        .post('/api/decisions/nonexistent/answer')
        .set('authorization', `Bearer ${h.operatorToken}`)
        .send({ answer: 'allow' });

      expect(res.status).toBe(404);
    });
  });
});
