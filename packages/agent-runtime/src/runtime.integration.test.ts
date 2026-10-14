import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { FakeAdapter } from '@redhunter/adapters';
import { HermesStore, InMemoryKnowledgeStore, seedProfiles } from '@redhunter/hermes';
import { createTestDatabase, type TestDatabase } from '@redhunter/hermes/src/test-support/database';
import { type AdapterEvent, PromptSnapshotSchema } from '@redhunter/shared';
import { AuthorizationError, authorize } from './authorize';
import { loadConstitution } from './prompt/constitution';
import { HermesPromptSource } from './prompt/from-hermes';
import { AgentRuntime } from './runtime';
import { DEFAULT_POLICY, makeRequest, STUB_BASE } from './test-support/harness';
import {
  InMemoryDecisionRepository,
  InMemoryRunRepository,
  RecordingLogger,
  RecordingSink,
  sequentialIds,
  TEST_NOW,
} from './test-support/in-memory';

let db: TestDatabase;
let store: HermesStore;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
  store = new HermesStore(db.models, () => TEST_NOW);
  await seedProfiles(store);
  await store.addMemory({
    agentId: 'programming',
    kind: 'episodic',
    text: 'login bug was a stale JWT secret',
    importance: 5,
  });
});

function createRuntime(adapter: FakeAdapter) {
  const runs = new InMemoryRunRepository();
  const decisions = new InMemoryDecisionRepository();
  const sink = new RecordingSink();
  const logger = new RecordingLogger();
  const knowledge = new InMemoryKnowledgeStore();
  const runtime = new AgentRuntime({
    adapters: new Map([[adapter.id, adapter]]),
    events: sink,
    runs,
    decisions,
    experience: store,
    promptSource: new HermesPromptSource({
      store,
      knowledge,
      base: () => ({ ...STUB_BASE, constitution: loadConstitution() }),
    }),
    logger,
    now: () => TEST_NOW,
    newId: sequentialIds(),
    backoff: async () => {},
  });
  return { runtime, runs, decisions, sink, logger };
}

describe('AgentRuntime integration (real HermesStore + FakeAdapter)', () => {
  test('success: run succeeded, result.recorded, Hermes experience row written', async () => {
    const script: AdapterEvent[] = [
      { type: 'started', vendorSessionId: 'ses-int' },
      { type: 'tool', name: 'task', input: { subagent_type: 'explore' }, status: 'started' },
      { type: 'tool', name: 'task', input: { subagent_type: 'explore' }, status: 'completed' },
      { type: 'file_change', path: 'src/auth.ts', kind: 'modified' },
      { type: 'completed', finalText: 'Rotated the JWT secret.' },
    ];
    const h = createRuntime(new FakeAdapter({ script }));
    const outcome = await h.runtime.execute(makeRequest());

    expect(outcome.run.status).toBe('succeeded');
    expect(h.logger.entries.map((entry) => entry.fields?.to)).toEqual([
      'composing',
      'executing',
      'verifying',
      'succeeded',
    ]);
    expect(h.sink.payloadsOf('result.recorded')[0]?.result.summary).toBe('Rotated the JWT secret.');
    expect(h.sink.types()).toContain('worker.spawned');
    expect(h.sink.types()).toContain('worker.despawned');

    const rows = await store.getExperience('programming', 'programming');
    expect<unknown>(rows.map(({ id: _id, ...row }) => row)).toEqual([
      {
        agentId: 'programming',
        taskType: 'bugfix',
        outcome: 'pass',
        lessons: ['Completed bugfix in 1 attempt(s)'],
        runId: 'run-1',
      },
    ]);

    const snapshot = PromptSnapshotSchema.parse(h.runs.get('run-1')?.promptSnapshot);
    expect(snapshot.layers.map((layer) => layer.id)).toHaveLength(9);
    expect(snapshot.text).toContain('stale JWT secret');
    expect(snapshot.text).toContain('prompt rules are not security boundaries');
  });

  test('failing adapter: maxRetries retries then escalated to manager with decision', async () => {
    const adapter = new FakeAdapter({ script: [{ type: 'failed', error: 'build broken' }] });
    const h = createRuntime(adapter);
    const outcome = await h.runtime.execute(
      makeRequest({ agentPolicy: { ...DEFAULT_POLICY, escalationChain: ['cto', 'human'] } }),
    );

    expect(outcome.attempts).toBe(DEFAULT_POLICY.maxRetries + 1);
    expect(outcome.run.status).toBe('escalated');
    expect(h.sink.payloadsOf('run.escalated')).toEqual([{ runId: 'run-1', escalatedTo: 'cto' }]);
    expect(h.sink.payloadsOf('decision.requested')).toHaveLength(1);
    expect(await store.getExperience('programming', 'programming')).toEqual([]);
  });

  test('authorization: domain agent cannot create directives; runtime rejects managers running adapters', async () => {
    expect(authorize('programming', 'createDirective')).toBe(false);
    expect(authorize('coo', 'assignTask')).toBe(true);
    const h = createRuntime(new FakeAdapter({ script: [{ type: 'completed', finalText: 'x' }] }));
    await expect(h.runtime.execute(makeRequest({ agentId: 'coo' }))).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect(h.sink.events).toEqual([]);
  });
});
