import {
  ADAPTER_IDS,
  AGENT_DEFINITIONS,
  type Agent,
  type AgentDefinition,
  AgentSchema,
  HUMAN_ESCALATION,
} from '@redhunter/shared';
import type { AnyBulkWriteOperation } from 'mongoose';
import type { AgentRecord, Models } from '../db/models';

// Plan section 7: retry max 2. Turns/budget are v1 defaults; todo 9 tunes them.
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_TURNS = 30;
const DEFAULT_BUDGET_TOKENS = 32_000;

export function buildAgent(definition: AgentDefinition): Agent {
  // AGENT_DEFINITIONS is deep-frozen: copy arrays before they reach Mongoose.
  return AgentSchema.parse({
    id: definition.id,
    title: definition.title,
    role: definition.role,
    reportsTo: [...definition.reportsTo],
    floor: definition.floor,
    deskSlot: definition.deskSlot,
    hermesProfileId: `hermes-${definition.id}`,
    allowedAdapters: [...ADAPTER_IDS],
    capabilityTags: [...definition.capabilityTags],
    status: 'idle',
    omoPolicy: {
      maxRetries: DEFAULT_MAX_RETRIES,
      maxTurns: DEFAULT_MAX_TURNS,
      budgetTokens: DEFAULT_BUDGET_TOKENS,
      allowedTools: [],
      // Escalate up the reporting line, then to a human (plan section 7).
      escalationChain: [...definition.reportsTo, HUMAN_ESCALATION],
    },
  });
}

// Static identity is re-asserted every run; runtime state is only written on first insert.
function toUpsert(agent: Agent): AnyBulkWriteOperation<AgentRecord> {
  const { id, title, role, reportsTo, floor, deskSlot, hermesProfileId, capabilityTags } = agent;
  return {
    updateOne: {
      filter: { _id: id },
      update: {
        $set: { title, role, reportsTo, floor, deskSlot, hermesProfileId, capabilityTags },
        $setOnInsert: {
          allowedAdapters: agent.allowedAdapters,
          status: agent.status,
          omoPolicy: agent.omoPolicy,
        },
      },
      upsert: true,
    },
  };
}

export async function seedAgents(models: Models): Promise<number> {
  const agents = AGENT_DEFINITIONS.map(buildAgent);
  await models.Agent.bulkWrite(agents.map(toUpsert));
  return agents.length;
}
