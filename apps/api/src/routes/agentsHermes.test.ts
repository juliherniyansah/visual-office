import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHermesModels, HermesStore, seedProfiles } from '@redhunter/hermes';
import request from 'supertest';
import { createApp } from '../app';
import { createOutbox } from '../events/outbox';
import { createAgentHermesSource } from '../services/agentHermes';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { bearer, startWorkContext, type WorkContext } from '../test-support/work';

let ctx: WorkContext;
let db: TestDatabase;
let store: HermesStore;

beforeAll(async () => {
  ctx = await startWorkContext();
  db = ctx.db;
  const hermesModels = await createHermesModels(db.connection);
  store = new HermesStore(hermesModels);
  await seedProfiles(store);
  await store.addMemory({
    agentId: 'programming',
    kind: 'episodic',
    text: 'fixed the login bug',
    importance: 0.8,
  });
  await store.addExperience({
    agentId: 'programming',
    taskType: 'bugfix',
    outcome: 'pass',
    lessons: ['write the failing test first'],
    runId: 'run-abc',
  });
});

afterAll(async () => {
  await db.drop();
});

function app() {
  return createApp({
    models: db.models,
    jwtSecret: 'work-test-secret-0123456789abcdefghij',
    outbox: createOutbox({ models: db.models }),
    hermesSource: createAgentHermesSource(store),
  });
}

describe('GET /api/v1/agents/:id/hermes', () => {
  test('viewer+ receives profile, recent memories and experience', async () => {
    const res = await request(app())
      .get('/api/v1/agents/programming/hermes')
      .set('Authorization', bearer(ctx.tokens.viewer));
    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({ agentId: 'programming', version: 1 });
    expect(res.body.data.memories).toHaveLength(1);
    expect(res.body.data.memories[0]).toMatchObject({ text: 'fixed the login bug' });
    expect(res.body.data.experience).toHaveLength(1);
    expect(res.body.data.experience[0]).toMatchObject({ outcome: 'pass', runId: 'run-abc' });
  });

  test('agent detail never leaks another agent\'s memories', async () => {
    const res = await request(app())
      .get('/api/v1/agents/ceo/hermes')
      .set('Authorization', bearer(ctx.tokens.viewer));
    expect(res.status).toBe(200);
    expect(res.body.data.memories).toEqual([]);
    expect(res.body.data.experience).toEqual([]);
  });

  test('unknown agent id -> 404', async () => {
    const res = await request(app())
      .get('/api/v1/agents/not-an-agent/hermes')
      .set('Authorization', bearer(ctx.tokens.viewer));
    expect(res.status).toBe(404);
  });

  test('missing token -> 401', async () => {
    const res = await request(app()).get('/api/v1/agents/ceo/hermes');
    expect(res.status).toBe(401);
  });
});
