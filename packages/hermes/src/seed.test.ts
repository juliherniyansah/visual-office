import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { AGENT_DEFINITIONS, AGENT_IDS, type AgentId } from '@redhunter/shared';
import { SEED_PROFILES, seedProfiles } from './seed';
import { HermesStore, type ProfileVersion } from './store';
import { createTestDatabase, type TestDatabase } from './test-support/database';

// Exact persona per agent: name + first personality trait (seed/*.json is the source).
const EXPECTED_PERSONAS: Readonly<Record<AgentId, { name: string; firstTrait: string }>> =
  Object.freeze({
    ceo: { name: 'Cara', firstTrait: 'visionary' },
    coo: { name: 'Otto', firstTrait: 'organized' },
    cto: { name: 'Tess', firstTrait: 'analytical' },
    programming: { name: 'Pip', firstTrait: 'precise' },
    game: { name: 'Gale', firstTrait: 'playful' },
    iot: { name: 'Ivy', firstTrait: 'careful' },
    ai_development: { name: 'Ada', firstTrait: 'curious' },
  });

// Full literal copy of seed/*.json (AGENT_IDS order): every persona field is user-visible in the
// assembled profile block, so content drift in any field must fail a test.
const EXPECTED_SEED_PROFILES: readonly ProfileVersion[] = [
  {
    agentId: 'ceo',
    name: 'Cara',
    role: 'Chief Executive Officer',
    personalityTraits: ['visionary', 'decisive', 'concise'],
    voiceGuidelines:
      'Speak in outcomes and priorities. Short directives, no implementation detail.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'coo',
    name: 'Otto',
    role: 'Chief Operating Officer',
    personalityTraits: ['organized', 'pragmatic', 'reliable'],
    voiceGuidelines:
      'Route work clearly: who, what, by when. Confirm acceptance criteria before assigning.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'cto',
    name: 'Tess',
    role: 'Chief Technology Officer',
    personalityTraits: ['analytical', 'rigorous', 'pragmatic'],
    voiceGuidelines: 'Explain technical trade-offs briefly. Prefer boring, proven designs.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'programming',
    name: 'Pip',
    role: 'Programming',
    personalityTraits: ['precise', 'test-first', 'terse'],
    voiceGuidelines: 'Lead with code and evidence. State what was skipped and why.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'game',
    name: 'Gale',
    role: 'Game',
    personalityTraits: ['playful', 'visual', 'iterative'],
    voiceGuidelines: 'Describe gameplay and visuals concretely. Prototype before polishing.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'iot',
    name: 'Ivy',
    role: 'IoT',
    personalityTraits: ['careful', 'hardware-aware', 'safety-minded'],
    voiceGuidelines: 'Name devices, protocols and failure modes explicitly. Never guess wiring.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
  {
    agentId: 'ai_development',
    name: 'Ada',
    role: 'AI Development',
    personalityTraits: ['curious', 'empirical', 'measured'],
    voiceGuidelines: 'Back claims with evals. Flag uncertainty and model limits plainly.',
    constitutionRef: 'constitution@v1',
    version: 1,
  },
];

let db: TestDatabase;
let store: HermesStore;

beforeAll(async () => {
  db = await createTestDatabase();
  store = new HermesStore(db.models);
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all(Object.values(db.models).map((model) => model.deleteMany({})));
});

describe('SEED_PROFILES', () => {
  test('exactly the 7 permanent agents, in AGENT_IDS order, version 1, role = agent title', () => {
    expect(SEED_PROFILES.map((profile) => profile.agentId)).toEqual([...AGENT_IDS]);
    for (const [index, profile] of SEED_PROFILES.entries()) {
      expect(profile.version).toBe(1);
      expect(profile.role).toBe(AGENT_DEFINITIONS[index]?.title ?? '');
      expect(profile.constitutionRef).toBe('constitution@v1');
      expect(profile.personalityTraits.length).toBeGreaterThan(0);
      expect(profile.voiceGuidelines.length).toBeGreaterThan(0);
    }
  });

  test('is deep-frozen', () => {
    expect(Object.isFrozen(SEED_PROFILES)).toBe(true);
    expect(Object.isFrozen(SEED_PROFILES[0]?.personalityTraits)).toBe(true);
  });

  test('every seed profile object and its traits are frozen; writes throw (ESM strict mode)', () => {
    expect(SEED_PROFILES).toHaveLength(7);
    for (const profile of SEED_PROFILES) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.personalityTraits)).toBe(true);
      expect(() => {
        profile.name = 'mutated';
      }).toThrow(TypeError);
      expect(profile.name).not.toBe('mutated');
    }
  });
  test('each seed profile has its exact name and first personality trait', () => {
    const personas = SEED_PROFILES.map((profile) => ({
      agentId: profile.agentId,
      name: profile.name,
      firstTrait: profile.personalityTraits[0],
    }));
    expect(personas).toEqual(
      AGENT_IDS.map((agentId) => ({ agentId, ...EXPECTED_PERSONAS[agentId] })),
    );
  });
  test('SEED_PROFILES equals the full literal seed objects', () => {
    expect(SEED_PROFILES).toEqual(EXPECTED_SEED_PROFILES);
  });
});

describe('seedProfiles', () => {
  test('seeds 7 profiles + 7 pointers; second run is a no-op', async () => {
    expect(await seedProfiles(store)).toBe(7);
    const rowsAfterFirst = await db.models.Profile.find({}).sort({ _id: 1 }).lean();
    expect(await seedProfiles(store)).toBe(7);
    expect(await db.models.Profile.find({}).sort({ _id: 1 }).lean()).toEqual(rowsAfterFirst);
    expect(await db.models.Profile.countDocuments()).toBe(7);
    expect(await db.models.ProfilePointer.countDocuments()).toBe(7);
    for (const agentId of AGENT_IDS) {
      const profile = await store.getProfile(agentId, agentId);
      expect(profile.id).toBe(`hermes-${agentId}-v1`);
      expect(profile.version).toBe(1);
    }
  });

  test('persisted profiles carry the exact seeded names and first traits', async () => {
    await seedProfiles(store);
    for (const agentId of AGENT_IDS) {
      const profile = await store.getProfile(agentId, agentId);
      const { name, firstTrait } = EXPECTED_PERSONAS[agentId];
      expect([profile.name, profile.personalityTraits[0]]).toEqual([name, firstTrait]);
      expect(profile.voiceGuidelines.length).toBeGreaterThan(0);
    }
  });

  test('getProfile after seeding returns the full literal seed object per agent', async () => {
    await seedProfiles(store);
    for (const expected of EXPECTED_SEED_PROFILES) {
      expect(await store.getProfile(expected.agentId, expected.agentId)).toEqual({
        id: `hermes-${expected.agentId}-v1`,
        ...expected,
      });
    }
  });

  test('re-seeding does not roll back a newer active version', async () => {
    await seedProfiles(store);
    const programming = SEED_PROFILES[3];
    if (programming === undefined) throw new Error('missing programming seed');
    const { version: _version, ...input } = programming;
    await store.createProfileVersion({ ...input, name: 'Pip II' });
    await seedProfiles(store);
    expect((await store.getProfile('programming', 'programming')).version).toBe(2);
  });
});
