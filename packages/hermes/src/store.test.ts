import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ZodError } from 'zod';
import { HermesAccessError, HermesNotFoundError } from './errors';
import { HermesStore, type ProfileInput } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';

type RawRow = { _id: string | number } & Record<string, unknown>;

// Drops a key entirely (an `undefined` value would be stored as null by the driver).
function without<T extends object>(row: T, key: keyof T): Omit<T, typeof key> {
  const { [key]: _dropped, ...rest } = row;
  return rest;
}

const T0 = new Date('2026-05-01T12:00:00.000Z');
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
let clockNow = T0;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new HermesStore(db.models, () => clockNow);
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  clockNow = T0;
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
});

function rawCollection(name: string) {
  return db.connection.collection<RawRow>(name);
}

describe('profiles', () => {
  test('appends v1 then v2, moves activeVersion, never mutates the old row', async () => {
    const v1 = await store.createProfileVersion(PROFILE_INPUT);
    expect(v1).toEqual({ id: 'hermes-programming-v1', ...PROFILE_INPUT, version: 1 });
    const rawV1 = await rawCollection('hermes_profiles').findOne({ _id: v1.id });

    const v2 = await store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip II' });
    expect(v2).toEqual({
      id: 'hermes-programming-v2',
      ...PROFILE_INPUT,
      name: 'Pip II',
      version: 2,
    });
    expect(await rawCollection('hermes_profiles').findOne({ _id: v1.id })).toEqual(rawV1);
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(2);
    expect(await store.getProfile('programming', 'programming')).toEqual(v2);
    expect(
      await rawCollection('hermes_profile_pointers').findOne({ _id: 'hermes-programming' }),
    ).toEqual({
      _id: 'hermes-programming',
      agentId: 'programming',
      activeVersion: 2,
    });
  });

  test('activateProfileVersion points back to v1; unknown version rejected, pointer kept', async () => {
    const v1 = await store.createProfileVersion(PROFILE_INPUT);
    await store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip II' });
    const before = await rawCollection('hermes_profiles').find({}).sort({ _id: 1 }).toArray();

    await store.activateProfileVersion('programming', 1);
    expect(await store.getProfile('programming', 'programming')).toEqual(v1);
    expect(await rawCollection('hermes_profiles').find({}).sort({ _id: 1 }).toArray()).toEqual(
      before,
    );

    await expect(store.activateProfileVersion('programming', 3)).rejects.toBeInstanceOf(
      HermesNotFoundError,
    );
    expect(await store.getProfile('programming', 'programming')).toEqual(v1);
  });

  test('getProfile without any profile rejects with HermesNotFoundError', async () => {
    await expect(store.getProfile('iot', 'iot')).rejects.toBeInstanceOf(HermesNotFoundError);
  });

  test('invalid profile input is rejected and nothing is written', async () => {
    await expect(store.createProfileVersion({ ...PROFILE_INPUT, name: '' })).rejects.toThrow();
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(0);
    expect(await rawCollection('hermes_profile_pointers').countDocuments()).toBe(0);
  });

  test('ensureProfileVersion is idempotent and does not move an existing pointer', async () => {
    const first = await store.ensureProfileVersion({ ...PROFILE_INPUT, version: 1 });
    await store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip II' });
    const again = await store.ensureProfileVersion({
      ...PROFILE_INPUT,
      name: 'changed',
      version: 1,
    });
    expect(again).toEqual(first);
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(2);
    expect((await store.getProfile('programming', 'programming')).version).toBe(2);
  });
});

describe('agent-scoped reads', () => {
  async function seedCeoData(): Promise<void> {
    await store.createProfileVersion({ ...PROFILE_INPUT, agentId: 'ceo', name: 'Cara' });
    await store.addMemory({ agentId: 'ceo', kind: 'semantic', text: 'secret', importance: 1 });
    await store.addExperience({
      agentId: 'ceo',
      taskType: 'plan',
      outcome: 'pass',
      lessons: ['x'],
      runId: 'r1',
    });
  }

  const READERS = [
    ['profile', (s: HermesStore) => s.getProfile('ceo', 'programming'), 'ProfilePointer'],
    ['memories', (s: HermesStore) => s.getMemories('ceo', 'programming'), 'Memory'],
    ['experience', (s: HermesStore) => s.getExperience('ceo', 'programming'), 'Experience'],
  ] as const;

  test.each(READERS)(
    'cross-agent %s read rejected before any query',
    async (_label, read, model) => {
      await seedCeoData();
      const spies = [
        spyOn(db.models[model], 'find'),
        spyOn(db.models[model], 'findOne'),
        spyOn(db.models[model], 'findById'),
      ];
      const error = await read(store).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HermesAccessError);
      expect(error).toMatchObject({ agentId: 'ceo', asAgent: 'programming' });
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      }
    },
  );

  test('own reads succeed when asAgent equals agentId', async () => {
    await seedCeoData();
    expect((await store.getProfile('ceo', 'ceo')).name).toBe('Cara');
    expect((await store.getMemories('ceo', 'ceo')).map((memory) => memory.text)).toEqual([
      'secret',
    ]);
    expect((await store.getExperience('ceo', 'ceo')).map((row) => row.runId)).toEqual(['r1']);
  });
});

describe('memories', () => {
  test('addMemory stamps uuid id and createdAt from the clock (Date in Mongo)', async () => {
    const memory = await store.addMemory({
      agentId: 'programming',
      runId: 'run-1',
      kind: 'episodic',
      text: 'fixed flaky test',
      importance: 0.5,
      ttl: 60,
    });
    expect(memory).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      agentId: 'programming',
      runId: 'run-1',
      kind: 'episodic',
      text: 'fixed flaky test',
      importance: 0.5,
      createdAt: '2026-05-01T12:00:00.000Z',
      ttl: 60,
    });
    const raw = await rawCollection('hermes_memories').findOne({ _id: memory.id });
    expect(raw?.createdAt).toEqual(T0);
  });

  test('invalid memory input is rejected and nothing is written', async () => {
    const input = { agentId: 'programming', kind: 'semantic', text: 'x', importance: -1 } as const;
    await expect(store.addMemory(input)).rejects.toThrow();
    expect(await rawCollection('hermes_memories').countDocuments()).toBe(0);
  });

  test('newest first, equal createdAt ordered by id; other agents excluded', async () => {
    const base = { kind: 'semantic', importance: 1, agentId: 'programming' };
    await rawCollection('hermes_memories').insertMany([
      { ...base, _id: 'b', text: 'tie b', createdAt: T0 },
      { ...base, _id: 'a', text: 'tie a', createdAt: T0 },
      { ...base, _id: 'z', text: 'old', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { ...base, _id: '0', text: 'new', createdAt: new Date('2026-06-01T00:00:00.000Z') },
      { ...base, _id: 'c', text: 'ceo', agentId: 'ceo', createdAt: T0 },
    ]);
    const texts = (await store.getMemories('programming', 'programming')).map((m) => m.text);
    expect(texts).toEqual(['new', 'tie a', 'tie b', 'old']);
  });

  test('ttl-expired memories are excluded exactly at expiry, kept 1 ms before', async () => {
    await store.addMemory({
      agentId: 'game',
      kind: 'episodic',
      text: 'short',
      importance: 1,
      ttl: 60,
    });
    await store.addMemory({ agentId: 'game', kind: 'episodic', text: 'forever', importance: 1 });
    clockNow = new Date(T0.getTime() + 59_999);
    expect((await store.getMemories('game', 'game')).map((m) => m.text).sort()).toEqual([
      'forever',
      'short',
    ]);
    clockNow = new Date(T0.getTime() + 60_000);
    expect((await store.getMemories('game', 'game')).map((m) => m.text)).toEqual(['forever']);
  });

  test('empty memories returns []', async () => {
    expect(await store.getMemories('iot', 'iot')).toEqual([]);
  });

  const VALID_MEMORY = {
    agentId: 'programming',
    runId: 'run-1',
    kind: 'semantic',
    text: 'ok',
    embedding: [0.1],
    importance: 1,
    createdAt: T0,
    ttl: 60,
  };
  const CORRUPT_MEMORIES: [string, RawRow][] = [
    ['empty runId', { _id: 'm1', ...VALID_MEMORY, runId: '' }],
    ['bad kind', { _id: 'm2', ...VALID_MEMORY, kind: 'dream' }],
    ['empty text', { _id: 'm3', ...VALID_MEMORY, text: '' }],
    ['missing text', { _id: 'm4', ...without(VALID_MEMORY, 'text') }],
    ['missing kind', { _id: 'm11', ...without(VALID_MEMORY, 'kind') }],
    ['non-number embedding element', { _id: 'm5', ...VALID_MEMORY, embedding: ['x'] }],
    ['negative importance', { _id: 'm6', ...VALID_MEMORY, importance: -1 }],
    ['missing importance', { _id: 'm7', ...without(VALID_MEMORY, 'importance') }],
    ['string createdAt', { _id: 'm8', ...VALID_MEMORY, createdAt: '2026-05-01T12:00:00.000Z' }],
    ['zero ttl', { _id: 'm9', ...VALID_MEMORY, ttl: 0 }],
    ['fractional ttl', { _id: 'm10', ...VALID_MEMORY, ttl: 1.5 }],
    ['non-string id', { _id: 42, ...VALID_MEMORY }],
  ];

  test.each(CORRUPT_MEMORIES)('re-validates stored rows: corrupt %s throws', async (_l, row) => {
    await rawCollection('hermes_memories').insertOne(row);
    await expect(store.getMemories('programming', 'programming')).rejects.toThrow();
  });

  test('control: valid base memory row parses', async () => {
    await rawCollection('hermes_memories').insertOne({ _id: 'ok', ...VALID_MEMORY });
    expect<unknown>(await store.getMemories('programming', 'programming')).toEqual([
      { id: 'ok', ...VALID_MEMORY, createdAt: T0.toISOString() },
    ]);
  });
});

describe('profiles re-validation', () => {
  const VALID_PROFILE = { ...PROFILE_INPUT, version: 1, createdAt: T0 };
  const CORRUPT_PROFILES: [string, RawRow][] = [
    ['empty name', { _id: 'p', ...VALID_PROFILE, name: '' }],
    ['missing role', { _id: 'p', ...without(VALID_PROFILE, 'role') }],
    ['non-array traits', { _id: 'p', ...VALID_PROFILE, personalityTraits: 'calm' }],
    ['empty trait element', { _id: 'p', ...VALID_PROFILE, personalityTraits: [''] }],
    ['non-string voice', { _id: 'p', ...VALID_PROFILE, voiceGuidelines: 7 }],
    ['empty constitutionRef', { _id: 'p', ...VALID_PROFILE, constitutionRef: '' }],
    ['non-string id', { _id: 99, ...VALID_PROFILE }],
  ];
  const POINTER = { _id: 'hermes-programming', agentId: 'programming', activeVersion: 1 };

  test.each(CORRUPT_PROFILES)('corrupt %s throws on getProfile', async (_l, row) => {
    await rawCollection('hermes_profiles').insertOne(row);
    await rawCollection('hermes_profile_pointers').insertOne(POINTER);
    await expect(store.getProfile('programming', 'programming')).rejects.toThrow();
  });

  test('control: valid base profile row parses (createdAt stripped)', async () => {
    await rawCollection('hermes_profiles').insertOne({ _id: 'p', ...VALID_PROFILE });
    await rawCollection('hermes_profile_pointers').insertOne(POINTER);
    expect(await store.getProfile('programming', 'programming')).toEqual({
      id: 'p',
      ...PROFILE_INPUT,
      version: 1,
    });
  });

  // activeVersion 0 casts fine in Mongo; only the zod pointer guard turns it into a ZodError.
  test('corrupt pointer activeVersion 0 throws ZodError, not NotFound', async () => {
    await rawCollection('hermes_profiles').insertOne({ _id: 'p', ...VALID_PROFILE });
    await rawCollection('hermes_profile_pointers').insertOne({ ...POINTER, activeVersion: 0 });
    const error = await store.getProfile('programming', 'programming').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZodError);
  });
});

describe('skills', () => {
  const SKILL = {
    id: 'skill-review',
    name: 'Code review',
    markdown: '# Review',
    appliesToRoles: ['domain'],
    tags: ['code'],
  };

  test('upsertSkill replaces by id; findSkills matches role AND any tag, sorted by name', async () => {
    await store.upsertSkill({ ...SKILL, name: 'old name' });
    await store.upsertSkill(SKILL);
    await store.upsertSkill({ ...SKILL, id: 'skill-a', name: 'Architecture', tags: ['code', 'x'] });
    await store.upsertSkill({ ...SKILL, id: 'skill-exec', appliesToRoles: ['executive'] });
    await store.upsertSkill({ ...SKILL, id: 'skill-iot', tags: ['iot'] });
    expect(await rawCollection('hermes_skills').countDocuments()).toBe(4);
    const found = await store.findSkills('domain', ['code']);
    expect(found.map((skill) => skill.id)).toEqual(['skill-a', 'skill-review']);
    expect(found[1]).toEqual(SKILL);
    expect(await store.findSkills('domain', [])).toEqual([]);
  });

  test('equal names ordered by id', async () => {
    await store.upsertSkill({ ...SKILL, id: 'b' });
    await store.upsertSkill({ ...SKILL, id: 'a' });
    expect((await store.findSkills('domain', ['code'])).map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('invalid skill input rejected, nothing written', async () => {
    await expect(store.upsertSkill({ ...SKILL, name: '' })).rejects.toThrow();
    expect(await rawCollection('hermes_skills').countDocuments()).toBe(0);
  });

  const VALID_SKILL = { name: 'n', markdown: 'm', appliesToRoles: ['domain'], tags: ['code'] };
  const CORRUPT_SKILLS: [string, RawRow][] = [
    ['empty name', { _id: 's', ...VALID_SKILL, name: '' }],
    ['missing name', { _id: 's', ...without(VALID_SKILL, 'name') }],
    ['missing markdown', { _id: 's', ...without(VALID_SKILL, 'markdown') }],
    ['non-string markdown', { _id: 's', ...VALID_SKILL, markdown: 1 }],
    ['empty role element', { _id: 's', ...VALID_SKILL, appliesToRoles: ['domain', ''] }],
    ['empty tag element', { _id: 's', ...VALID_SKILL, tags: ['code', ''] }],
    ['non-string id', { _id: 5, ...VALID_SKILL }],
  ];

  test.each(CORRUPT_SKILLS)('corrupt %s throws on findSkills', async (_l, row) => {
    await rawCollection('hermes_skills').insertOne(row);
    await expect(store.findSkills('domain', ['code'])).rejects.toThrow();
  });

  test('control: valid base skill row parses', async () => {
    await rawCollection('hermes_skills').insertOne({ _id: 's', ...VALID_SKILL });
    expect(await store.findSkills('domain', ['code'])).toEqual([{ id: 's', ...VALID_SKILL }]);
  });
});

describe('experience', () => {
  test('addExperience returns uuid row; getExperience newest first, ties by id', async () => {
    const added = await store.addExperience({
      agentId: 'iot',
      taskType: 'firmware',
      outcome: 'fail',
      lessons: ['flash slower'],
      runId: 'run-9',
    });
    expect(added).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      agentId: 'iot',
      taskType: 'firmware',
      outcome: 'fail',
      lessons: ['flash slower'],
      runId: 'run-9',
    });
    const base = { agentId: 'iot', taskType: 't', outcome: 'pass', lessons: [], runId: 'r' };
    await rawCollection('hermes_experience').insertMany([
      { ...base, _id: 'b', createdAt: new Date('2026-06-01T00:00:00.000Z') },
      { ...base, _id: 'a', createdAt: new Date('2026-06-01T00:00:00.000Z') },
    ]);
    expect((await store.getExperience('iot', 'iot')).map((row) => row.id)).toEqual([
      'a',
      'b',
      added.id,
    ]);
  });

  test('invalid experience input rejected, nothing written', async () => {
    const input = {
      agentId: 'iot',
      taskType: '',
      outcome: 'pass',
      lessons: [],
      runId: 'r',
    } as const;
    await expect(store.addExperience({ ...input, lessons: [] })).rejects.toThrow();
    expect(await rawCollection('hermes_experience').countDocuments()).toBe(0);
  });

  const VALID_EXPERIENCE = {
    agentId: 'iot',
    taskType: 't',
    outcome: 'pass',
    lessons: ['l'],
    runId: 'r',
    createdAt: T0,
  };
  const CORRUPT_EXPERIENCE: [string, RawRow][] = [
    ['empty taskType', { _id: 'e', ...VALID_EXPERIENCE, taskType: '' }],
    ['bad outcome', { _id: 'e', ...VALID_EXPERIENCE, outcome: 'maybe' }],
    ['non-array lessons', { _id: 'e', ...VALID_EXPERIENCE, lessons: 'l' }],
    ['empty lesson element', { _id: 'e', ...VALID_EXPERIENCE, lessons: [''] }],
    ['missing runId', { _id: 'e', ...without(VALID_EXPERIENCE, 'runId') }],
    ['missing taskType', { _id: 'e', ...without(VALID_EXPERIENCE, 'taskType') }],
    ['missing lessons', { _id: 'e', ...without(VALID_EXPERIENCE, 'lessons') }],
    ['non-string id', { _id: 3, ...VALID_EXPERIENCE }],
  ];

  test.each(CORRUPT_EXPERIENCE)('corrupt %s throws on getExperience', async (_l, row) => {
    await rawCollection('hermes_experience').insertOne(row);
    await expect(store.getExperience('iot', 'iot')).rejects.toThrow();
  });

  test('control: valid base experience row parses (createdAt stripped)', async () => {
    await rawCollection('hermes_experience').insertOne({ _id: 'e', ...VALID_EXPERIENCE });
    const { createdAt: _createdAt, ...fields } = VALID_EXPERIENCE;
    expect<unknown>(await store.getExperience('iot', 'iot')).toEqual([{ id: 'e', ...fields }]);
  });
});
