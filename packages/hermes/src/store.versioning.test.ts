import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { HermesNotFoundError } from './errors';
import { HermesStore, type ProfileInput } from './store';
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

function profileRow(agentId: string, name: string, version: number): RawRow {
  return {
    _id: `hermes-${agentId}-v${version}`,
    ...PROFILE_INPUT,
    agentId,
    name,
    version,
    createdAt: T0,
  };
}

describe('getProfile pointer integrity', () => {
  // A pointer stored under another agent's _id must never route to that agent's profile.
  test('pointer hermes-programming carrying agentId ceo is rejected, never returns ceo data', async () => {
    await rawCollection('hermes_profiles').insertMany([
      profileRow('ceo', 'Cara', 1),
      profileRow('programming', 'Pip', 1),
    ]);
    await rawCollection('hermes_profile_pointers').insertOne({
      _id: 'hermes-programming',
      agentId: 'ceo',
      activeVersion: 1,
    });
    const result = await store.getProfile('programming', 'programming').catch((e: unknown) => e);
    expect(result).toBeInstanceOf(HermesNotFoundError);
  });

  test('pointer to a version with no row rejects with HermesNotFoundError', async () => {
    await rawCollection('hermes_profiles').insertOne(profileRow('iot', 'Ivy', 1));
    await rawCollection('hermes_profile_pointers').insertOne({
      _id: 'hermes-iot',
      agentId: 'iot',
      activeVersion: 4,
    });
    await expect(store.getProfile('iot', 'iot')).rejects.toBeInstanceOf(HermesNotFoundError);
  });
});

describe('append-only versioning', () => {
  test('three versions: latest is v3 and the pointer follows it', async () => {
    await store.createProfileVersion(PROFILE_INPUT);
    await store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip II' });
    const v3 = await store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip III' });
    expect(v3).toEqual({
      id: 'hermes-programming-v3',
      ...PROFILE_INPUT,
      name: 'Pip III',
      version: 3,
    });
    expect(await store.getProfile('programming', 'programming')).toEqual(v3);
    const names = await rawCollection('hermes_profiles').find({}).sort({ version: 1 }).toArray();
    expect(names.map((row) => row.name)).toEqual(['Pip', 'Pip II', 'Pip III']);
  });

  test('unique {agentId, version}: a second row for v1 under another _id fails E11000', async () => {
    await store.createProfileVersion(PROFILE_INPUT);
    const error = await rawCollection('hermes_profiles')
      .insertOne({ ...profileRow('programming', 'Impostor', 1), _id: 'other' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code: DUPLICATE_KEY });
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(1);
  });

  test('concurrent createProfileVersion for one agent: exactly one wins, old row never overwritten', async () => {
    const results = await Promise.allSettled([
      store.createProfileVersion({ ...PROFILE_INPUT, name: 'first' }),
      store.createProfileVersion({ ...PROFILE_INPUT, name: 'second' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rows = await rawCollection('hermes_profiles').find({}).toArray();
    expect(rows).toHaveLength(1);
    const winner = results.find((r) => r.status === 'fulfilled');
    expect(winner?.status === 'fulfilled' ? winner.value.name : '').toBe(String(rows[0]?.name));
  });
});

describe('ensureProfileVersion concurrency', () => {
  test('two concurrent ensures of the same seed both resolve with one row', async () => {
    const seed = { ...PROFILE_INPUT, version: 1 };
    const [a, b] = await Promise.all([
      store.ensureProfileVersion(seed),
      store.ensureProfileVersion(seed),
    ]);
    expect(a).toEqual({ id: 'hermes-programming-v1', ...seed });
    expect(b).toEqual(a);
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(1);
    expect(await rawCollection('hermes_profile_pointers').countDocuments()).toBe(1);
    expect((await store.getProfile('programming', 'programming')).version).toBe(1);
  });

  test('concurrent ensure losing the insert race returns the STORED row, not its own input', async () => {
    const results = await Promise.all([
      store.ensureProfileVersion({ ...PROFILE_INPUT, name: 'boot A', version: 1 }),
      store.ensureProfileVersion({ ...PROFILE_INPUT, name: 'boot B', version: 1 }),
    ]);
    const stored = await rawCollection('hermes_profiles').findOne({ _id: 'hermes-programming-v1' });
    expect(results.map((profile) => profile.name)).toEqual([
      String(stored?.name),
      String(stored?.name),
    ]);
  });
});

describe('findSkills sort keys', () => {
  test('sorted by name, not id', async () => {
    const base = { markdown: 'm', appliesToRoles: ['domain'], tags: ['code'] };
    await store.upsertSkill({ ...base, id: 'a', name: 'B' });
    await store.upsertSkill({ ...base, id: 'z', name: 'A' });
    expect((await store.findSkills('domain', ['code'])).map((skill) => skill.id)).toEqual([
      'z',
      'a',
    ]);
  });
});

describe('ensureProfileVersion error discrimination', () => {
  const SEED = { ...PROFILE_INPUT, version: 1 };

  async function pointerCount(): Promise<number> {
    return rawCollection('hermes_profile_pointers').countDocuments({ agentId: 'programming' });
  }

  // Unique {agentId, version} hit under a FOREIGN _id: re-read by own _id finds nothing.
  test('duplicate on {agentId, version} under a foreign _id rethrows E11000, no pointer', async () => {
    await rawCollection('hermes_profiles').insertOne({
      ...profileRow('programming', 'Pip', 1),
      _id: 'other',
    });
    const error = await store.ensureProfileVersion(SEED).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: DUPLICATE_KEY });
    expect(await pointerCount()).toBe(0);
    expect(await rawCollection('hermes_profiles').countDocuments()).toBe(1);
  });

  test('non-E11000 error is rethrown as-is even when the row exists afterwards', async () => {
    const failure = Object.assign(new Error('write concern'), { code: 64 });
    const create = spyOn(db.models.Profile, 'create').mockImplementationOnce(async () => {
      await rawCollection('hermes_profiles').insertOne(profileRow('programming', 'Pip', 1));
      throw failure;
    });
    try {
      await expect(store.ensureProfileVersion(SEED)).rejects.toBe(failure);
      expect(await pointerCount()).toBe(0);
    } finally {
      create.mockRestore();
    }
  });

  test('plain error without code is rethrown as-is; no row and no pointer written', async () => {
    const failure = new Error('network');
    const create = spyOn(db.models.Profile, 'create').mockImplementationOnce(async () => {
      throw failure;
    });
    try {
      await expect(store.ensureProfileVersion(SEED)).rejects.toBe(failure);
      expect(await rawCollection('hermes_profiles').countDocuments()).toBe(0);
      expect(await pointerCount()).toBe(0);
    } finally {
      create.mockRestore();
    }
  });
});

describe('versioning is scoped per agent', () => {
  test('version numbers count per agent: programming starts at v1 after ceo v1, v2', async () => {
    await store.createProfileVersion({ ...PROFILE_INPUT, agentId: 'ceo', name: 'Cara' });
    await store.createProfileVersion({ ...PROFILE_INPUT, agentId: 'ceo', name: 'Cara II' });
    const programming = await store.createProfileVersion(PROFILE_INPUT);
    expect(programming.version).toBe(1);
    expect(programming.id).toBe('hermes-programming-v1');
  });

  test('failed insert of a new version leaves the pointer on the previous version', async () => {
    const v1 = await store.createProfileVersion(PROFILE_INPUT);
    const failure = new Error('insert failed');
    const create = spyOn(db.models.Profile, 'create').mockImplementationOnce(async () => {
      throw failure;
    });
    try {
      await expect(store.createProfileVersion({ ...PROFILE_INPUT, name: 'Pip II' })).rejects.toBe(
        failure,
      );
    } finally {
      create.mockRestore();
    }
    const pointer = await rawCollection('hermes_profile_pointers').findOne({
      _id: 'hermes-programming',
    });
    expect(pointer?.activeVersion).toBe(1);
    expect(await store.getProfile('programming', 'programming')).toEqual(v1);
  });

  test('activateProfileVersion checks the version of THIS agent, not any agent', async () => {
    await store.createProfileVersion({ ...PROFILE_INPUT, agentId: 'ceo', name: 'Cara' });
    await store.createProfileVersion({ ...PROFILE_INPUT, agentId: 'ceo', name: 'Cara II' });
    const v1 = await store.createProfileVersion(PROFILE_INPUT);
    await expect(store.activateProfileVersion('programming', 2)).rejects.toBeInstanceOf(
      HermesNotFoundError,
    );
    expect(await store.getProfile('programming', 'programming')).toEqual(v1);
  });
});

describe('profile storage details', () => {
  test('ensureProfileVersion stamps the stored row with the injected clock', async () => {
    await store.ensureProfileVersion({ ...PROFILE_INPUT, version: 1 });
    const raw = await rawCollection('hermes_profiles').findOne({ _id: 'hermes-programming-v1' });
    expect(raw?.createdAt).toEqual(T0);
  });

  test('empty voiceGuidelines is accepted and read back as empty', async () => {
    const created = await store.createProfileVersion({ ...PROFILE_INPUT, voiceGuidelines: '' });
    expect(created.voiceGuidelines).toBe('');
    expect((await store.getProfile('programming', 'programming')).voiceGuidelines).toBe('');
    const raw = await rawCollection('hermes_profiles').findOne({ _id: created.id });
    expect(raw?.voiceGuidelines).toBe('');
  });
});
