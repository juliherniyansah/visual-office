import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { HermesMemory } from '@redhunter/shared';
import { type AssembleDeps, assembleContext, type ContextTask, rankMemories } from './context';
import { HermesBudgetError } from './errors';
import { InMemoryKnowledgeStore } from './knowledge';
import { HermesStore } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';

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
    personalityTraits: ['precise'],
    voiceGuidelines: 'Terse.',
    constitutionRef: 'constitution@v1',
  });
});

function layerIds(context: Awaited<ReturnType<typeof assembleContext>>, layer: string): string[] {
  return context.layers.find((entry) => entry.id === layer)?.blocks.map((b) => b.id) ?? [];
}

describe('assembleContext per-layer caps', () => {
  test('4 candidates each: experience capped at 3, rag capped at 3, skills uncapped (4)', async () => {
    const experienceIds: string[] = [];
    for (const offset of [0, 1, 2, 3]) {
      const clock = () => new Date(T0.getTime() + offset * 1000);
      const row = await new HermesStore(db.models, clock).addExperience({
        agentId: 'programming',
        taskType: 'bugfix',
        outcome: 'pass',
        lessons: [`lesson ${offset}`],
        runId: `run-${offset}`,
      });
      experienceIds.push(row.id);
    }
    for (const id of ['kb1', 'kb2', 'kb3', 'kb4']) {
      await knowledge.upsert({ id, title: 'Note', text: 'flaky mongo', tags: [] });
    }
    for (const name of ['A', 'B', 'C', 'D']) {
      await store.upsertSkill({
        id: `skill-${name}`,
        name,
        markdown: 'm',
        appliesToRoles: ['domain'],
        tags: ['code'],
      });
    }
    const context = await assembleContext('programming', TASK, 2000, deps);
    // Newest first: offsets 3, 2, 1.
    expect(layerIds(context, 'experience')).toEqual(experienceIds.slice(1).reverse());
    // Equal BM25 scores -> id ascending.
    expect(layerIds(context, 'rag')).toEqual(['kb1', 'kb2', 'kb3']);
    expect(layerIds(context, 'skills')).toEqual(['skill-A', 'skill-B', 'skill-C', 'skill-D']);
    expect(context.dropped).toEqual([]);
  });
});

describe('assembleContext greedy fill', () => {
  test('a smaller later block still fits after a larger earlier block was dropped', async () => {
    const big = await store.addMemory({
      agentId: 'programming',
      kind: 'semantic',
      text: `mongo ${'m'.repeat(200)}`,
      importance: 1,
    });
    await knowledge.upsert({ id: 'kb', title: 'Mongo', text: 'flaky', tags: [] });
    const full = await assembleContext('programming', TASK, 2000, deps);
    const profileTokens = full.layers.find((layer) => layer.id === 'profile')?.tokens ?? 0;
    const ragTokens = full.layers.find((layer) => layer.id === 'rag')?.tokens ?? 0;
    const memoryTokens = full.layers.find((layer) => layer.id === 'memories')?.tokens ?? 0;
    expect(memoryTokens).toBeGreaterThan(ragTokens);
    expect(ragTokens).toBeGreaterThan(0);

    const budget = profileTokens + ragTokens;
    const context = await assembleContext('programming', TASK, budget, deps);
    expect(layerIds(context, 'memories')).toEqual([]);
    expect(layerIds(context, 'rag')).toEqual(['kb']);
    expect(context.dropped).toEqual([{ layer: 'memories', id: big.id }]);
    expect(context.totalTokens).toBe(budget);
  });
});

describe('rankMemories tie-breaks', () => {
  function memory(id: string, createdAt: string): HermesMemory {
    return { id, agentId: 'programming', kind: 'semantic', text: 'same', importance: 1, createdAt };
  }

  test('equal relevance, importance and createdAt -> id ascending', () => {
    const at = '2026-05-01T12:00:00.000Z';
    expect(rankMemories([memory('b', at), memory('a', at)], 'task').map((m) => m.id)).toEqual([
      'a',
      'b',
    ]);
  });

  // Ids run opposite to recency, so only the recency key can produce this order.
  test('equal relevance and importance -> newer createdAt first', () => {
    const older = memory('a', '2026-05-01T12:00:00.000Z');
    const newer = memory('b', '2026-05-02T12:00:00.000Z');
    expect(rankMemories([older, newer], 'task').map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('assembleContext fill priority and budget boundary', () => {
  const PROFILE_COST = 10;
  const BLOCK_COST = 5;
  // Profile 10, every other block 5: budget 15 leaves room for exactly one non-profile block.
  const fixedCost = (text: string) => (text.startsWith('Name:') ? PROFILE_COST : BLOCK_COST);

  test('experience fills before rag when only one of them fits', async () => {
    const lesson = await store.addExperience({
      agentId: 'programming',
      taskType: 'bugfix',
      outcome: 'pass',
      lessons: ['pin seeds'],
      runId: 'r',
    });
    await knowledge.upsert({ id: 'kb', title: 'Mongo', text: 'mongo', tags: [] });
    const context = await assembleContext(
      'programming',
      { text: 'mongo', capabilityTags: [] },
      PROFILE_COST + BLOCK_COST,
      { ...deps, estimateTokens: fixedCost },
    );
    expect(layerIds(context, 'experience')).toEqual([lesson.id]);
    expect(layerIds(context, 'rag')).toEqual([]);
    expect(context.dropped).toEqual([{ layer: 'rag', id: 'kb' }]);
  });

  test('budget 0 is valid when the profile costs 0 tokens; -1 is not', async () => {
    const zeroCost = { ...deps, estimateTokens: () => 0 };
    const context = await assembleContext('programming', TASK, 0, zeroCost);
    expect(context.budget).toBe(0);
    expect(context.totalTokens).toBe(0);
    expect(layerIds(context, 'profile')).toEqual(['hermes-programming-v1']);
    await expect(assembleContext('programming', TASK, -1, zeroCost)).rejects.toBeInstanceOf(
      HermesBudgetError,
    );
  });
});

describe('rankMemories relevance', () => {
  function memory(id: string, text: string, importance: number): HermesMemory {
    const createdAt = '2026-05-01T12:00:00.000Z';
    return { id, agentId: 'programming', kind: 'semantic', text, importance, createdAt };
  }

  // 'mongo' x3 hits one distinct task term; 'mongo flaky' hits two.
  test('counts DISTINCT task terms, not repeated occurrences', () => {
    const repeated = memory('repeated', 'mongo mongo mongo', 1);
    const distinct = memory('distinct', 'mongo flaky', 0);
    expect(rankMemories([repeated, distinct], 'mongo flaky').map((m) => m.id)).toEqual([
      'distinct',
      'repeated',
    ]);
  });

  test('task text goes through the tokenizer (case and punctuation)', () => {
    const irrelevant = memory('irrelevant', 'coffee', 1);
    const relevant = memory('relevant', 'mongo', 0);
    expect(rankMemories([irrelevant, relevant], 'Fix MONGO, now').map((m) => m.id)).toEqual([
      'relevant',
      'irrelevant',
    ]);
  });
});

describe('assembleContext experience order', () => {
  test('experience of other task types keeps newest-first order', async () => {
    const days = ['2026-01-01', '2026-02-01', '2026-03-01'] as const;
    for (const [index, day] of days.entries()) {
      const clock = () => new Date(`${day}T00:00:00.000Z`);
      await new HermesStore(db.models, clock).addExperience({
        agentId: 'programming',
        taskType: 'feature',
        outcome: 'pass',
        lessons: [`lesson ${index}`],
        runId: `run-${index}`,
      });
    }
    const context = await assembleContext('programming', TASK, 2000, deps);
    const texts = context.layers.find((layer) => layer.id === 'experience')?.blocks ?? [];
    expect(texts.map((block) => block.text)).toEqual([
      'feature (pass): lesson 2',
      'feature (pass): lesson 1',
      'feature (pass): lesson 0',
    ]);
  });
});

describe('rankMemories importance', () => {
  // Equal hits and createdAt; id order (a < b) is opposite to importance order, so only the
  // importance comparator can put 'b' first.
  test('equal relevance and createdAt -> higher importance first', () => {
    const createdAt = '2026-05-01T12:00:00.000Z';
    const base = { agentId: 'programming', kind: 'semantic', text: 'same', createdAt } as const;
    const low: HermesMemory = { ...base, id: 'a', importance: 0.1 };
    const high: HermesMemory = { ...base, id: 'b', importance: 0.9 };
    expect(rankMemories([low, high], 'task').map((memory) => memory.id)).toEqual(['b', 'a']);
  });
});

describe('rankMemories first task term', () => {
  function memory(id: string, text: string): HermesMemory {
    const createdAt = '2026-05-01T12:00:00.000Z';
    return { id, agentId: 'programming', kind: 'semantic', text, importance: 1, createdAt };
  }

  // Only the FIRST task word is shared; id order (a < b) is opposite to the expected order.
  test('first task term counts toward relevance', () => {
    const ranked = rankMemories([memory('a', 'other'), memory('b', 'mongo')], 'mongo flaky');
    expect(ranked.map((m) => m.id)).toEqual(['b', 'a']);
  });

  test('single-character task term counts toward relevance', () => {
    const ranked = rankMemories([memory('a', 'y'), memory('b', 'x')], 'x');
    expect(ranked.map((m) => m.id)).toEqual(['b', 'a']);
  });
});

describe('assembleContext greedy fill within one layer', () => {
  // Rag hits come out [big, small] (big has more term hits); budget fits only the small one.
  test('a smaller later block in the SAME layer still fits after a bigger one was dropped', async () => {
    const bigText = `mongo mongo ${'b'.repeat(200)}`;
    await knowledge.upsert({ id: 'kb-big', title: 'Mongo', text: bigText, tags: [] });
    await knowledge.upsert({ id: 'kb-small', title: 'Note', text: 'mongo', tags: [] });
    const full = await assembleContext('programming', TASK, 2000, deps);
    expect(layerIds(full, 'rag')).toEqual(['kb-big', 'kb-small']);
    const profileTokens = full.layers.find((layer) => layer.id === 'profile')?.tokens ?? 0;
    const blocks = full.layers.find((layer) => layer.id === 'rag')?.blocks ?? [];
    const smallTokens = blocks.find((block) => block.id === 'kb-small')?.tokens ?? 0;
    const bigTokens = blocks.find((block) => block.id === 'kb-big')?.tokens ?? 0;
    expect(bigTokens).toBeGreaterThan(smallTokens);

    const context = await assembleContext('programming', TASK, profileTokens + smallTokens, deps);
    expect(layerIds(context, 'rag')).toEqual(['kb-small']);
    expect(context.dropped).toEqual([{ layer: 'rag', id: 'kb-big' }]);
  });
});
