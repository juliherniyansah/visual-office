import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { AGENT_DEFINITIONS, AGENT_IDS, type AgentId, AgentSchema } from '@redhunter/shared';
import { verifyPassword } from '../auth/password';
import { toAgent } from '../db/mappers';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { seedAgents } from './agents';
import { runSeed } from './index';
import { seedOwner } from './owner';

const EXPECTED_CAPABILITY_TAGS: Record<AgentId, string[]> = {
  ceo: ['direct'],
  coo: ['route', 'process'],
  cto: ['route', 'technical'],
  programming: ['code'],
  game: ['game'],
  iot: ['iot'],
  ai_development: ['ai'],
};

const OWNER = { email: 'owner@example.test', password: 'first-owner-password' };

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await Promise.all([db.models.Agent.deleteMany({}), db.models.User.deleteMany({})]);
});

async function loadAgents(): Promise<ReturnType<typeof toAgent>[]> {
  const records = await db.models.Agent.find().lean();
  return records.map(toAgent);
}

describe('seedAgents', () => {
  test('creates the 7 permanent agents with exact capabilityTags', async () => {
    expect(await seedAgents(db.models)).toBe(AGENT_IDS.length);
    const agents = await loadAgents();
    expect(agents.map((agent) => agent.id).sort()).toEqual([...AGENT_IDS].sort());
    for (const agent of agents) {
      expect(agent.capabilityTags).toEqual(EXPECTED_CAPABILITY_TAGS[agent.id]);
      expect(() => AgentSchema.parse(agent)).not.toThrow();
    }
  });

  test('copies static identity from AGENT_DEFINITIONS and seeds runtime defaults', async () => {
    await seedAgents(db.models);
    const agents = await loadAgents();
    for (const definition of AGENT_DEFINITIONS) {
      const agent = agents.find((entry) => entry.id === definition.id);
      expect(agent).toMatchObject({
        title: definition.title,
        role: definition.role,
        reportsTo: [...definition.reportsTo],
        floor: definition.floor,
        deskSlot: definition.deskSlot,
        status: 'idle',
        hermesProfileId: `hermes-${definition.id}`,
      });
      expect(agent?.omoPolicy.escalationChain).toEqual([...definition.reportsTo, 'human']);
    }
  });

  test('is idempotent: running twice still yields exactly 7 agents', async () => {
    await seedAgents(db.models);
    await seedAgents(db.models);
    expect(await db.models.Agent.countDocuments()).toBe(7);
  });

  test('re-seed keeps runtime state but restores static identity drift', async () => {
    await seedAgents(db.models);
    await db.models.Agent.updateOne(
      { _id: 'programming' },
      { $set: { status: 'working', currentRunId: 'run-1', capabilityTags: ['hacked'] } },
    );
    await seedAgents(db.models);
    const programming = (await loadAgents()).find((agent) => agent.id === 'programming');
    expect(programming?.status).toBe('working');
    expect(programming?.currentRunId).toBe('run-1');
    expect(programming?.capabilityTags).toEqual(['code']);
  });
});

describe('seedOwner', () => {
  test('creates one owner whose password verifies; hash never equals the password', async () => {
    const result = await seedOwner(db.models, OWNER);
    expect(result).toEqual({ created: true, passwordUpdated: true });
    const users = await db.models.User.find().lean();
    expect(users).toHaveLength(1);
    expect(users[0]?.role).toBe('owner');
    expect(users[0]?.passwordHash).not.toBe(OWNER.password);
    expect(await verifyPassword(OWNER.password, users[0]?.passwordHash)).toBe(true);
  });

  test('second run does not overwrite a changed owner password', async () => {
    await seedOwner(db.models, OWNER);
    const result = await seedOwner(db.models, { ...OWNER, password: 'second-owner-password' });
    expect(result).toEqual({ created: false, passwordUpdated: false });
    const user = await db.models.User.findOne({ email: OWNER.email }).lean();
    expect(await verifyPassword(OWNER.password, user?.passwordHash)).toBe(true);
    expect(await verifyPassword('second-owner-password', user?.passwordHash)).toBe(false);
  });

  test('forcePassword explicitly resets the owner password', async () => {
    await seedOwner(db.models, OWNER);
    const result = await seedOwner(
      db.models,
      { ...OWNER, password: 'forced-owner-password' },
      { forcePassword: true },
    );
    expect(result).toEqual({ created: false, passwordUpdated: true });
    const user = await db.models.User.findOne({ email: OWNER.email }).lean();
    expect(await verifyPassword('forced-owner-password', user?.passwordHash)).toBe(true);
  });

  test('normalizes the email so case variants do not create a second owner', async () => {
    await seedOwner(db.models, OWNER);
    await seedOwner(db.models, { ...OWNER, email: '  OWNER@Example.Test ' });
    expect(await db.models.User.countDocuments()).toBe(1);
  });
});

describe('runSeed', () => {
  test('is idempotent: twice -> exactly 7 agents and 1 owner', async () => {
    const first = await runSeed({ models: db.models, owner: OWNER });
    const second = await runSeed({ models: db.models, owner: OWNER });
    expect(first).toEqual({ agents: 7, owner: { created: true, passwordUpdated: true } });
    expect(second).toEqual({ agents: 7, owner: { created: false, passwordUpdated: false } });
    expect(await db.models.Agent.countDocuments()).toBe(7);
    expect(await db.models.User.countDocuments({ role: 'owner' })).toBe(1);
    expect(await db.models.User.countDocuments()).toBe(1);
  });

  test('skips the owner when no credentials are configured', async () => {
    expect(await runSeed({ models: db.models })).toEqual({ agents: 7, owner: undefined });
    expect(await db.models.User.countDocuments()).toBe(0);
  });
});
