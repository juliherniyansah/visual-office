import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { AgentId } from '@redhunter/shared';
import { assembleContext } from './context';
import { InMemoryKnowledgeStore } from './knowledge';
import { HermesStore } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';

type RawRow = { _id: string } & Record<string, unknown>;

const T0 = new Date('2026-05-01T12:00:00.000Z');
const TASK_TEXT = 'mongo plan';
const NAMES = { programming: 'Pip', iot: 'Ivy', ceo: 'Cara' } as const;
type ScopedAgent = keyof typeof NAMES;
const AGENTS: readonly ScopedAgent[] = ['programming', 'iot', 'ceo'];

let db: TestDatabase;
let store: HermesStore;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new HermesStore(db.models, () => T0);
});

afterAll(async () => {
  await db.drop();
});

// Every agent owns one profile, memory and lesson; programming rows carry the highest importance
// so a query widened to programming would rank them first.
beforeEach(async () => {
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
  for (const agentId of AGENTS) {
    await store.createProfileVersion({
      agentId,
      name: NAMES[agentId],
      role: agentId,
      personalityTraits: ['focused'],
      voiceGuidelines: 'Short.',
      constitutionRef: 'constitution@v1',
    });
    await store.addMemory({
      agentId,
      kind: 'semantic',
      text: `mongo memory of ${agentId}`,
      importance: agentId === 'programming' ? 9 : 1,
    });
    await store.addExperience({
      agentId,
      taskType: 'plan',
      outcome: 'pass',
      lessons: [`lesson of ${agentId}`],
      runId: `run-${agentId}`,
    });
  }
  const skill = { markdown: 'm', tags: ['plan'] };
  await store.upsertSkill({
    ...skill,
    id: 'skill-domain',
    name: 'Domain',
    appliesToRoles: ['domain'],
  });
  await store.upsertSkill({
    ...skill,
    id: 'skill-executive',
    name: 'Executive',
    appliesToRoles: ['executive'],
  });
});

async function contextFor(agentId: AgentId) {
  return assembleContext(
    agentId,
    { text: TASK_TEXT, capabilityTags: ['plan'], taskType: 'plan' },
    2000,
    { store, knowledge: new InMemoryKnowledgeStore() },
  );
}

function blockTexts(context: Awaited<ReturnType<typeof contextFor>>, layer: string): string[] {
  return context.layers.find((entry) => entry.id === layer)?.blocks.map((b) => b.text) ?? [];
}

describe('assembleContext is scoped to the requesting agent (not only programming)', () => {
  test.each([
    ['iot', 'skill-domain'],
    ['ceo', 'skill-executive'],
  ] as const)(
    '%s gets only its own profile, memories, lessons and role skills',
    async (agentId, skillId) => {
      const context = await contextFor(agentId);
      expect(context.agentId).toBe(agentId);
      const profile = context.layers.find((layer) => layer.id === 'profile')?.blocks[0];
      expect(profile?.id).toBe(`hermes-${agentId}-v1`);
      expect(profile?.text).toContain(`Name: ${NAMES[agentId]}`);
      expect(blockTexts(context, 'memories')).toEqual([`[semantic] mongo memory of ${agentId}`]);
      expect(blockTexts(context, 'experience')).toEqual([`plan (pass): lesson of ${agentId}`]);
      const skills = context.layers.find((layer) => layer.id === 'skills')?.blocks ?? [];
      expect(skills.map((block) => block.id)).toEqual([skillId]);
    },
  );
});

describe('store reads are scoped for non-programming agents', () => {
  test.each(['iot', 'ceo'] as const)(
    'getMemories(%s) excludes programming rows',
    async (agentId) => {
      const memories = await store.getMemories(agentId, agentId);
      expect(memories.map((memory) => [memory.agentId, memory.text])).toEqual([
        [agentId, `mongo memory of ${agentId}`],
      ]);
    },
  );

  test.each(['iot', 'ceo'] as const)(
    'getExperience(%s) excludes programming rows',
    async (agentId) => {
      const rows = await store.getExperience(agentId, agentId);
      expect(rows.map((row) => [row.agentId, row.runId])).toEqual([[agentId, `run-${agentId}`]]);
    },
  );
});

describe('optional memory fields round-trip', () => {
  test('runId and embedding are stored and read back unchanged', async () => {
    const added = await store.addMemory({
      agentId: 'game',
      runId: 'run-42',
      kind: 'episodic',
      text: 'with extras',
      embedding: [0.25, -1, 3],
      importance: 0.5,
    });
    expect(await store.getMemories('game', 'game')).toEqual([added]);
    expect(added.runId).toBe('run-42');
    expect(added.embedding).toEqual([0.25, -1, 3]);
    const raw = await db.connection
      .collection<RawRow>('hermes_memories')
      .findOne({ _id: added.id });
    expect(raw?.runId).toBe('run-42');
    expect(raw?.embedding).toEqual([0.25, -1, 3]);
  });

  test('absent runId and embedding stay absent on read', async () => {
    await store.addMemory({ agentId: 'game', kind: 'episodic', text: 'plain', importance: 1 });
    const [read] = await store.getMemories('game', 'game');
    expect(read === undefined ? [] : Object.keys(read).sort()).toEqual([
      'agentId',
      'createdAt',
      'id',
      'importance',
      'kind',
      'text',
    ]);
  });
});
