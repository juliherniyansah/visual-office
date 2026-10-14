import { describe, expect, test } from 'bun:test';
import { AGENT_DEFINITIONS } from './agents';
import { AGENT_IDS, type AgentId, type FloorId } from './enums';
import { OFFICE_LAYOUT, OfficeLayoutSchema } from './office-layout';

const EXPECTED_FLOORS: Record<AgentId, FloorId> = {
  ceo: 4,
  coo: 3,
  cto: 3,
  programming: 2,
  game: 2,
  iot: 2,
  ai_development: 2,
};

const EXPECTED_TAGS: Record<AgentId, string[]> = {
  ceo: ['direct'],
  coo: ['route', 'process'],
  cto: ['route', 'technical'],
  programming: ['code'],
  game: ['game'],
  iot: ['iot'],
  ai_development: ['ai'],
};

const allDesks = OFFICE_LAYOUT.floors.flatMap((floor) =>
  floor.desks.map((desk) => ({ ...desk, floorId: floor.id })),
);

describe('OFFICE_LAYOUT (Option A)', () => {
  test('parses with OfficeLayoutSchema', () => {
    expect(OfficeLayoutSchema.parse(OFFICE_LAYOUT)).toEqual(OFFICE_LAYOUT);
  });

  test('has floors 1..4 in order', () => {
    expect(OFFICE_LAYOUT.floors.map((floor) => floor.id)).toEqual([1, 2, 3, 4]);
  });

  test('holds exactly 7 unique agents covering the roster', () => {
    const agentIds = allDesks.map((desk) => desk.agentId);
    expect(agentIds).toHaveLength(7);
    expect(new Set(agentIds).size).toBe(7);
    expect([...agentIds].sort()).toEqual([...AGENT_IDS].sort());
  });

  test('desk ids are unique', () => {
    expect(new Set(allDesks.map((desk) => desk.deskId)).size).toBe(allDesks.length);
  });

  test('assigns agents to floors per Option A, F1 has no agents', () => {
    for (const desk of allDesks) {
      expect(desk.floorId).toBe(EXPECTED_FLOORS[desk.agentId]);
    }
    const lobby = OFFICE_LAYOUT.floors.find((floor) => floor.id === 1);
    expect(lobby?.desks).toEqual([]);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(OFFICE_LAYOUT)).toBe(true);
    expect(Object.isFrozen(OFFICE_LAYOUT.floors[1]?.desks)).toBe(true);
  });
});

describe('AGENT_DEFINITIONS', () => {
  test('defines the 7 permanent agents in roster order', () => {
    expect(AGENT_DEFINITIONS.map((agent) => agent.id)).toEqual([...AGENT_IDS]);
  });

  test('capabilityTags match the seed contract', () => {
    for (const agent of AGENT_DEFINITIONS) {
      expect([...agent.capabilityTags]).toEqual(EXPECTED_TAGS[agent.id]);
    }
  });

  test('floor and deskSlot come from OFFICE_LAYOUT', () => {
    for (const agent of AGENT_DEFINITIONS) {
      const desk = allDesks.find((entry) => entry.agentId === agent.id);
      expect(agent.floor).toBe(EXPECTED_FLOORS[agent.id]);
      expect(desk?.floorId).toBe(agent.floor);
      expect(desk?.deskId).toBe(agent.deskSlot);
    }
  });

  test('agent roles follow RBAC section 13', () => {
    const roles = Object.fromEntries(AGENT_DEFINITIONS.map((agent) => [agent.id, agent.role]));
    expect(roles).toEqual({
      ceo: 'executive',
      coo: 'manager',
      cto: 'manager',
      programming: 'domain',
      game: 'domain',
      iot: 'domain',
      ai_development: 'domain',
    });
  });

  test('is frozen', () => {
    expect(Object.isFrozen(AGENT_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(AGENT_DEFINITIONS[0])).toBe(true);
  });
});
