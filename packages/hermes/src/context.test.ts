import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AgentId } from '@redhunter/shared';
import { type AssembleDeps, assembleContext, type ContextTask } from './context';
import { HermesBudgetError } from './errors';
import { InMemoryKnowledgeStore } from './knowledge';
import { HermesStore } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';
import { estimateTokens } from './tokens';

const T0 = new Date('2026-05-01T12:00:00.000Z');
const TASK: ContextTask = {
  text: 'Fix the flaky mongo test in the dispatcher',
  capabilityTags: ['code'],
  taskType: 'bugfix',
};

let db: TestDatabase;
let store: HermesStore;
let knowledge: InMemoryKnowledgeStore;
let deps: AssembleDeps;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
  store = new HermesStore(db.models, () => T0);
  knowledge = new InMemoryKnowledgeStore();
  deps = { store, knowledge };
  await store.createProfileVersion({
    agentId: 'programming',
    name: 'Pip',
    role: 'Programming',
    personalityTraits: ['precise', 'calm'],
    voiceGuidelines: 'Terse.',
    constitutionRef: 'constitution@v1',
  });
});

async function addMemory(text: string, importance: number, agentId: AgentId = 'programming') {
  return store.addMemory({ agentId, kind: 'semantic', text, importance });
}

function layerIds(context: Awaited<ReturnType<typeof assembleContext>>, layer: string): string[] {
  return context.layers.find((entry) => entry.id === layer)?.blocks.map((b) => b.id) ?? [];
}

describe('assembleContext', () => {
  test('programming @2000: profile + top-3 relevant memories, ordered layers, within budget', async () => {
    const relevantA = await addMemory('mongo test flaky because of shared db', 0.2);
    const relevantB = await addMemory('dispatcher test needs fake timers', 0.1);
    const important = await addMemory('prefer small diffs', 0.9);
    await addMemory('likes coffee', 0.3);
    await addMemory('lunch at noon', 0.05);
    await addMemory('mongo flaky secret of ceo', 1, 'ceo');

    const context = await assembleContext('programming', TASK, 2000, deps);

    expect(context.layers.map((layer) => layer.id)).toEqual([
      'profile',
      'skills',
      'memories',
      'experience',
      'rag',
    ]);
    expect(layerIds(context, 'profile')).toEqual(['hermes-programming-v1']);
    expect(context.layers[0]?.blocks[0]?.text).toBe(
      [
        'Name: Pip',
        'Role: Programming',
        'Traits: precise, calm',
        'Voice: Terse.',
        'Constitution: constitution@v1',
      ].join('\n'),
    );
    // Relevance first (3 task terms > 2 > 0), then importance.
    expect(layerIds(context, 'memories')).toEqual([relevantA.id, relevantB.id, important.id]);
    expect(context.totalTokens).toBeLessThanOrEqual(2000);
    expect(context.budget).toBe(2000);
    expect(context.dropped).toEqual([]);
  });

  test('per-layer tokens equal the sum of block estimates; total is the sum of layers', async () => {
    await addMemory('mongo flaky', 1);
    const context = await assembleContext('programming', TASK, 2000, deps);
    for (const layer of context.layers) {
      const sum = layer.blocks.reduce((acc, block) => acc + block.tokens, 0);
      expect(layer.tokens).toBe(sum);
      for (const block of layer.blocks) expect(block.tokens).toBe(estimateTokens(block.text));
    }
    const total = context.layers.reduce((acc, layer) => acc + layer.tokens, 0);
    expect(context.totalTokens).toBe(total);
    expect(context.layers[2]?.blocks[0]?.text).toBe('[semantic] mongo flaky');
  });

  test('memory ties: equal relevance and importance -> newer first, then id', async () => {
    const older = await addMemory('mongo one', 0.5);
    store = new HermesStore(db.models, () => new Date(T0.getTime() + 1000));
    const newer = await addMemory('mongo two', 0.5);
    const context = await assembleContext('programming', TASK, 2000, { ...deps, store });
    expect(layerIds(context, 'memories')).toEqual([newer.id, older.id]);
  });

  test('empty memories, skills, experience and knowledge -> only the profile block', async () => {
    const context = await assembleContext('programming', TASK, 2000, deps);
    expect(context.layers.map((layer) => layer.blocks.length)).toEqual([1, 0, 0, 0, 0]);
    expect(context.totalTokens).toBe(context.layers[0]?.tokens ?? -1);
  });

  test('skills by role + capability tags, experience same taskType first, rag by task text', async () => {
    await store.upsertSkill({
      id: 'skill-tdd',
      name: 'TDD',
      markdown: 'Red green refactor.',
      appliesToRoles: ['domain'],
      tags: ['code'],
    });
    await store.upsertSkill({
      id: 'skill-exec',
      name: 'Board',
      markdown: 'x',
      appliesToRoles: ['executive'],
      tags: ['code'],
    });
    const featureStore = new HermesStore(db.models, () => new Date(T0.getTime() + 1000));
    await featureStore.addExperience({
      agentId: 'programming',
      taskType: 'feature',
      outcome: 'pass',
      lessons: ['ship small'],
      runId: 'r1',
    });
    const bugfix = await store.addExperience({
      agentId: 'programming',
      taskType: 'bugfix',
      outcome: 'fail',
      lessons: ['reproduce first', 'pin seeds'],
      runId: 'r2',
    });
    await knowledge.upsert({ id: 'kb-mongo', title: 'Mongo', text: 'flaky mongo tests', tags: [] });
    await knowledge.upsert({ id: 'kb-art', title: 'Art', text: 'textures', tags: [] });

    const context = await assembleContext('programming', TASK, 2000, deps);
    expect(layerIds(context, 'skills')).toEqual(['skill-tdd']);
    expect(context.layers[1]?.blocks[0]?.text).toBe('## TDD\nRed green refactor.');
    expect(layerIds(context, 'experience')[0]).toBe(bugfix.id);
    expect(context.layers[3]?.blocks[0]?.text).toBe('bugfix (fail): reproduce first; pin seeds');
    expect(layerIds(context, 'rag')).toEqual(['kb-mongo']);
    expect(context.layers[4]?.blocks[0]?.text).toBe('Mongo: flaky mongo tests');
  });

  test('budget smaller than profile throws HermesBudgetError (profile never truncated)', async () => {
    const full = await assembleContext('programming', TASK, 2000, deps);
    const profileTokens = full.layers[0]?.tokens ?? 0;
    expect(profileTokens).toBeGreaterThan(1);
    await expect(
      assembleContext('programming', TASK, profileTokens - 1, deps),
    ).rejects.toBeInstanceOf(HermesBudgetError);
    const exact = await assembleContext('programming', TASK, profileTokens, deps);
    expect(exact.totalTokens).toBe(profileTokens);
  });

  test('invalid budget (negative / fractional) throws HermesBudgetError', async () => {
    await expect(assembleContext('programming', TASK, -1, deps)).rejects.toBeInstanceOf(
      HermesBudgetError,
    );
    // Fractional budget large enough for the profile: only the integer guard can reject it.
    await expect(assembleContext('programming', TASK, 2000.5, deps)).rejects.toBeInstanceOf(
      HermesBudgetError,
    );
  });

  test('tight budget drops whole non-profile blocks in priority order skills > memories > experience > rag', async () => {
    await store.upsertSkill({
      id: 'skill-tdd',
      name: 'TDD',
      markdown: 'r'.repeat(40),
      appliesToRoles: ['domain'],
      tags: ['code'],
    });
    const memory = await addMemory(`mongo ${'m'.repeat(40)}`, 1);
    // RAG block bigger than the memory block, so it can never fill the gap a dropped memory leaves.
    await knowledge.upsert({ id: 'kb', title: 'Mongo', text: `mongo ${'k'.repeat(80)}`, tags: [] });
    const full = await assembleContext('programming', TASK, 2000, deps);
    const [profile, skills, memories] = full.layers.map((layer) => layer.tokens);
    const budget = (profile ?? 0) + (skills ?? 0) + (memories ?? 0);

    const tight = await assembleContext('programming', TASK, budget, deps);
    expect(layerIds(tight, 'skills')).toEqual(['skill-tdd']);
    expect(layerIds(tight, 'memories')).toEqual([memory.id]);
    expect(layerIds(tight, 'rag')).toEqual([]);
    expect(tight.dropped).toEqual([{ layer: 'rag', id: 'kb' }]);
    expect(tight.totalTokens).toBe(budget);

    const tighter = await assembleContext('programming', TASK, budget - 1, deps);
    expect(layerIds(tighter, 'skills')).toEqual(['skill-tdd']);
    expect(tighter.dropped).toEqual([
      { layer: 'memories', id: memory.id },
      { layer: 'rag', id: 'kb' },
    ]);
    expect(tighter.totalTokens).toBeLessThanOrEqual(budget - 1);
  });

  test('token estimator is pluggable', async () => {
    const context = await assembleContext('programming', TASK, 2000, {
      ...deps,
      estimateTokens: () => 7,
    });
    expect(context.layers[0]?.tokens).toBe(7);
    expect(context.totalTokens).toBe(7);
  });

  test('ttl-expired memories are not assembled', async () => {
    await store.addMemory({
      agentId: 'programming',
      kind: 'episodic',
      text: 'mongo stale',
      importance: 1,
      ttl: 1,
    });
    const later = new HermesStore(db.models, () => new Date(T0.getTime() + 1000));
    const context = await assembleContext('programming', TASK, 2000, { ...deps, store: later });
    expect(layerIds(context, 'memories')).toEqual([]);
  });
});

describe('estimateTokens', () => {
  test('ceil(code points / 4); multi-byte chars count once', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    // 4 emoji = 4 code points (8 UTF-16 units, 16 bytes) -> 1 token.
    expect(estimateTokens('😀😀😀😀')).toBe(1);
    expect(estimateTokens('é'.repeat(8))).toBe(2);
  });
});
