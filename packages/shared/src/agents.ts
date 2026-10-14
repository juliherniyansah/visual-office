import { deepFreeze } from './deep-freeze';
import type { AgentId, AgentRole, FloorId } from './enums';
import { findAgentDesk } from './office-layout';

// Static identity of a permanent agent; runtime fields (status, omoPolicy, ...) live in `agents`.
export interface AgentDefinition {
  readonly id: AgentId;
  readonly title: string;
  readonly role: AgentRole;
  readonly reportsTo: readonly AgentId[];
  readonly capabilityTags: readonly string[];
  readonly floor: FloorId;
  readonly deskSlot: string;
}

type AgentProfile = Omit<AgentDefinition, 'floor' | 'deskSlot'>;

const MANAGERS: readonly AgentId[] = ['coo', 'cto'];

const AGENT_PROFILES: readonly AgentProfile[] = [
  {
    id: 'ceo',
    title: 'Chief Executive Officer',
    role: 'executive',
    reportsTo: [],
    capabilityTags: ['direct'],
  },
  {
    id: 'coo',
    title: 'Chief Operating Officer',
    role: 'manager',
    reportsTo: ['ceo'],
    capabilityTags: ['route', 'process'],
  },
  {
    id: 'cto',
    title: 'Chief Technology Officer',
    role: 'manager',
    reportsTo: ['ceo'],
    capabilityTags: ['route', 'technical'],
  },
  {
    id: 'programming',
    title: 'Programming',
    role: 'domain',
    reportsTo: MANAGERS,
    capabilityTags: ['code'],
  },
  { id: 'game', title: 'Game', role: 'domain', reportsTo: MANAGERS, capabilityTags: ['game'] },
  { id: 'iot', title: 'IoT', role: 'domain', reportsTo: MANAGERS, capabilityTags: ['iot'] },
  {
    id: 'ai_development',
    title: 'AI Development',
    role: 'domain',
    reportsTo: MANAGERS,
    capabilityTags: ['ai'],
  },
];

function toDefinition(profile: AgentProfile): AgentDefinition {
  const placement = findAgentDesk(profile.id);
  return {
    ...profile,
    reportsTo: [...profile.reportsTo],
    capabilityTags: [...profile.capabilityTags],
    floor: placement.floorId,
    deskSlot: placement.deskId,
  };
}

// Seed source for apps/api (todo 3). Floor/desk derive from OFFICE_LAYOUT (single source).
export const AGENT_DEFINITIONS: readonly AgentDefinition[] = deepFreeze(
  AGENT_PROFILES.map(toDefinition),
);
