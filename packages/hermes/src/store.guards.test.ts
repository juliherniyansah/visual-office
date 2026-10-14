import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ZodError } from 'zod';
import { assembleContext } from './context';
import { InMemoryKnowledgeStore } from './knowledge';
import { type ExperienceInput, HermesStore, type ProfileInput } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';

type RawRow = { _id: string } & Record<string, unknown>;

const T0 = new Date('2026-05-01T12:00:00.000Z');
const DUPLICATE_KEY = 11000;
const PROFILE_INPUT: ProfileInput = {
  agentId: 'programming',
  name: 'Pip',
  role: 'Programming',
  personalityTraits: ['precise'],
  voiceGuidelines: 'Terse.',
  constitutionRef: 'constitution@v1',
};

let db: TestDatabase;
let store: HermesStore;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new HermesStore(db.models, () => T0);
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
});

function rawCollection(name: string) {
  return db.connection.collection<RawRow>(name);
}

describe('experience isolation between agents', () => {
  async function seedThreeAgents(): Promise<void> {
    for (const agentId of ['ceo', 'iot', 'programming'] as const) {
      await store.addExperience({
        agentId,
        taskType: 'bugfix',
        outcome: 'pass',
        lessons: [`lesson-of-${agentId}`],
        runId: `run-${agentId}`,
      });
    }
  }

  test('getExperience returns only the requested agent rows', async () => {
    await seedThreeAgents();
    const rows = await store.getExperience('iot', 'iot');
    expect(rows.map((row) => [row.agentId, row.runId])).toEqual([['iot', 'run-iot']]);
  });

  test('assembleContext never carries another agent lessons', async () => {
    await seedThreeAgents();
    await store.createProfileVersion(PROFILE_INPUT);
    const context = await assembleContext(
      'programming',
      { text: 'bugfix', capabilityTags: [], taskType: 'bugfix' },
      2000,
      { store, knowledge: new InMemoryKnowledgeStore() },
    );
    const texts = context.layers.flatMap((layer) => layer.blocks.map((block) => block.text));
    expect(texts.filter((text) => text.includes('lesson-of-'))).toEqual([
      'bugfix (pass): lesson-of-programming',
    ]);
  });
});

// Values below pass Mongoose casting/validation, so only the zod write guard can reject them.
describe('write-path zod guards (zod-only invalid values)', () => {
  const MEMORY = { agentId: 'iot', kind: 'semantic', text: 'x', importance: 1 } as const;

  test.each([
    ['ttl 0', { ...MEMORY, ttl: 0 }],
    ['empty runId', { ...MEMORY, runId: '' }],
  ] as const)('addMemory rejects %s with ZodError, nothing written', async (_label, input) => {
    await expect(store.addMemory(input)).rejects.toBeInstanceOf(ZodError);
    expect(await rawCollection('hermes_memories').countDocuments()).toBe(0);
  });

  test('addExperience rejects an empty lesson with ZodError, nothing written', async () => {
    const input: ExperienceInput = {
      agentId: 'iot',
      taskType: 't',
      outcome: 'pass',
      lessons: [''],
      runId: 'r',
    };
    await expect(store.addExperience(input)).rejects.toBeInstanceOf(ZodError);
    expect(await rawCollection('hermes_experience').countDocuments()).toBe(0);
  });

  test('ensureProfileVersion rejects an empty trait with ZodError, nothing written', async () => {
    const input = { ...PROFILE_INPUT, personalityTraits: [''], version: 1 };
    await expect(store.ensureProfileVersion(input)).rejects.toBeInstanceOf(ZodError);
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(0);
    expect(await rawCollection('hermes_profile_pointers').countDocuments()).toBe(0);
  });
});

describe('ensureProfileVersion pointer and error handling', () => {
  test('first ensure of version 2 points activeVersion at 2', async () => {
    await store.ensureProfileVersion({ ...PROFILE_INPUT, version: 2 });
    const pointer = await rawCollection('hermes_profile_pointers').findOne({
      _id: 'hermes-programming',
    });
    expect(pointer).toEqual({
      _id: 'hermes-programming',
      agentId: 'programming',
      activeVersion: 2,
    });
    expect(await store.getProfile('programming', 'programming')).toEqual({
      id: 'hermes-programming-v2',
      ...PROFILE_INPUT,
      version: 2,
    });
  });

  test('codeless error is rethrown as-is even when the row exists afterwards', async () => {
    const failure = new Error('socket closed');
    const create = spyOn(db.models.Profile, 'create').mockImplementationOnce(async () => {
      await rawCollection('hermes_profiles').insertOne({
        _id: 'hermes-programming-v1',
        ...PROFILE_INPUT,
        version: 1,
        createdAt: T0,
      });
      throw failure;
    });
    try {
      await expect(store.ensureProfileVersion({ ...PROFILE_INPUT, version: 1 })).rejects.toBe(
        failure,
      );
      expect(await rawCollection('hermes_profile_pointers').countDocuments()).toBe(0);
    } finally {
      create.mockRestore();
    }
  });
});

describe('findSkills tag semantics: share at least one tag', () => {
  const BASE = { markdown: 'm', appliesToRoles: ['domain'] };

  test('multi-tag skill matches a multi-tag query sharing one tag', async () => {
    await store.upsertSkill({ ...BASE, id: 'ab', name: 'AB', tags: ['a', 'b'] });
    await store.upsertSkill({ ...BASE, id: 'xy', name: 'XY', tags: ['x', 'y'] });
    expect((await store.findSkills('domain', ['b', 'c'])).map((skill) => skill.id)).toEqual(['ab']);
  });

  test('single-tag skill matches a query with an extra unknown tag', async () => {
    await store.upsertSkill({ ...BASE, id: 's', name: 'S', tags: ['code'] });
    expect((await store.findSkills('domain', ['code', 'zzz'])).map((skill) => skill.id)).toEqual([
      's',
    ]);
  });
});

describe('models storage shape', () => {
  test('memory added without embedding stores no embedding key (not [])', async () => {
    const memory = await store.addMemory({
      agentId: 'iot',
      kind: 'semantic',
      text: 'x',
      importance: 1,
    });
    const raw = await rawCollection('hermes_memories').findOne({ _id: memory.id });
    expect(raw === null ? [] : Object.keys(raw).sort()).toEqual([
      '_id',
      'agentId',
      'createdAt',
      'importance',
      'kind',
      'text',
    ]);
    const [read] = await store.getMemories('iot', 'iot');
    expect(read === undefined ? true : 'embedding' in read).toBe(false);
  });

  // Fresh DB: indexes must be built by the time the models factory resolves (no build race).
  test('unique {agentId, version} index exists as soon as the models factory resolves', async () => {
    const fresh = await createTestDatabase();
    try {
      const indexes = await fresh.connection.collection('hermes_profiles').indexes();
      const unique = indexes.find((index) => index.key.agentId === 1 && index.key.version === 1);
      expect(unique?.unique).toBe(true);
      const row = { ...PROFILE_INPUT, version: 1, createdAt: T0 };
      const profiles = fresh.connection.collection<RawRow>('hermes_profiles');
      await profiles.insertOne({ _id: 'a', ...row });
      const error = await profiles.insertOne({ _id: 'b', ...row }).catch((e: unknown) => e);
      expect(error).toMatchObject({ code: DUPLICATE_KEY });
    } finally {
      await fresh.drop();
    }
  });
});

describe('memory order and skill return value', () => {
  // _id order (a < b < c) is the REVERSE of createdAt order, so only the createdAt key wins.
  test('getMemories is newest-first by createdAt even when _id order is opposite', async () => {
    const base = { agentId: 'programming', kind: 'semantic', importance: 1 };
    await rawCollection('hermes_memories').insertMany([
      { ...base, _id: 'a', text: 'oldest', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { ...base, _id: 'b', text: 'middle', createdAt: new Date('2026-02-01T00:00:00.000Z') },
      { ...base, _id: 'c', text: 'newest', createdAt: new Date('2026-03-01T00:00:00.000Z') },
    ]);
    const memories = await store.getMemories('programming', 'programming');
    expect(memories.map((memory) => memory.id)).toEqual(['c', 'b', 'a']);
  });

  test('upsertSkill returns exactly the stored skill', async () => {
    const skill = {
      id: 'skill-tdd',
      name: 'TDD',
      markdown: '# Red green',
      appliesToRoles: ['domain'],
      tags: ['code', 'test'],
    };
    expect(await store.upsertSkill(skill)).toEqual(skill);
    expect(await store.findSkills('domain', ['code'])).toEqual([skill]);
  });
});

describe('default clock (no clock injected)', () => {
  const ONE_HOUR_SECONDS = 3600;

  test('addMemory stamps createdAt with the current time; ttl 1h memory is still live', async () => {
    const realStore = new HermesStore(db.models);
    const before = Date.now();
    const added = await realStore.addMemory({
      agentId: 'game',
      kind: 'episodic',
      text: 'fresh',
      importance: 1,
      ttl: ONE_HOUR_SECONDS,
    });
    const after = Date.now();
    const [read] = await realStore.getMemories('game', 'game');
    expect(read?.id).toBe(added.id);
    const createdAt = Date.parse(read?.createdAt ?? '');
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });

  test('createProfileVersion stores createdAt from the current time (storage-only field)', async () => {
    const before = Date.now();
    const profile = await new HermesStore(db.models).createProfileVersion(PROFILE_INPUT);
    const after = Date.now();
    const raw = await rawCollection('hermes_profiles').findOne({ _id: profile.id });
    const createdAt = raw?.createdAt instanceof Date ? raw.createdAt.getTime() : Number.NaN;
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });

  // A row 1 minute old must sort AFTER a row stamped by the default clock (newest first).
  test('addExperience stamps the current time: new row sorts before a 1-minute-old row', async () => {
    await rawCollection('hermes_experience').insertOne({
      _id: 'a-minute-ago',
      agentId: 'game',
      taskType: 't',
      outcome: 'pass',
      lessons: ['old'],
      runId: 'r-old',
      createdAt: new Date(Date.now() - 60_000),
    });
    const added = await new HermesStore(db.models).addExperience({
      agentId: 'game',
      taskType: 't',
      outcome: 'pass',
      lessons: ['new'],
      runId: 'r-new',
    });
    const rows = await new HermesStore(db.models).getExperience('game', 'game');
    expect(rows.map((row) => row.id)).toEqual([added.id, 'a-minute-ago']);
  });
});

describe('profile read guards on untrusted rows', () => {
  const ROW = { ...PROFILE_INPUT, agentId: 'iot', name: 'Ivy', version: 1, createdAt: T0 };

  // 1.5 is stored fine by Mongo; only the zod int() guard on the pointer rejects it.
  test('fractional pointer activeVersion 1.5 throws ZodError, not NotFound', async () => {
    await rawCollection('hermes_profiles').insertOne({ _id: 'hermes-iot-v1', ...ROW });
    await rawCollection('hermes_profile_pointers').insertOne({
      _id: 'hermes-iot',
      agentId: 'iot',
      activeVersion: 1.5,
    });
    const error = await store.getProfile('iot', 'iot').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZodError);
  });

  test('a stray id field in the stored row never overrides the row _id', async () => {
    await rawCollection('hermes_profiles').insertOne({
      _id: 'hermes-iot-v1',
      ...ROW,
      id: 'hermes-ceo-v1',
    });
    await rawCollection('hermes_profile_pointers').insertOne({
      _id: 'hermes-iot',
      agentId: 'iot',
      activeVersion: 1,
    });
    expect((await store.getProfile('iot', 'iot')).id).toBe('hermes-iot-v1');
  });
});

// Rows are untrusted: a forged `id` key stored next to `_id` must never win over `_id`.
describe('stray id field never overrides _id (memory, skill, experience)', () => {
  test('getMemories returns the row _id, not a stray id', async () => {
    await rawCollection('hermes_memories').insertOne({
      _id: 'memory-real',
      id: 'memory-forged',
      agentId: 'iot',
      kind: 'semantic',
      text: 'x',
      importance: 1,
      createdAt: T0,
    });
    const memories = await store.getMemories('iot', 'iot');
    expect(memories.map((memory) => memory.id)).toEqual(['memory-real']);
  });

  test('findSkills returns the row _id, not a stray id', async () => {
    await rawCollection('hermes_skills').insertOne({
      _id: 'skill-real',
      id: 'skill-forged',
      name: 'S',
      markdown: 'm',
      appliesToRoles: ['domain'],
      tags: ['code'],
    });
    const skills = await store.findSkills('domain', ['code']);
    expect(skills.map((skill) => skill.id)).toEqual(['skill-real']);
  });

  test('getExperience returns the row _id, not a stray id', async () => {
    await rawCollection('hermes_experience').insertOne({
      _id: 'experience-real',
      id: 'experience-forged',
      agentId: 'iot',
      taskType: 't',
      outcome: 'pass',
      lessons: ['l'],
      runId: 'r',
      createdAt: T0,
    });
    const rows = await store.getExperience('iot', 'iot');
    expect(rows.map((row) => row.id)).toEqual(['experience-real']);
  });
});
