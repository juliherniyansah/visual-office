import type { AgentId } from '@redhunter/shared';
import type { HermesStore } from '@redhunter/hermes';
import { HermesNotFoundError } from '@redhunter/hermes';
import type { AgentHermesData, AgentHermesSource } from '../routes/agentsHermes';

const RECENT_MEMORIES = 10;
const RECENT_EXPERIENCE = 10;

// Agent detail dashboard reads Hermes as the owning agent (store enforces self-access).
export function createAgentHermesSource(store: HermesStore): AgentHermesSource {
  return {
    async get(agentId: AgentId): Promise<AgentHermesData | null> {
      try {
        const [profile, memories, experience] = await Promise.all([
          store.getProfile(agentId, agentId),
          store.getMemories(agentId, agentId),
          store.getExperience(agentId, agentId),
        ]);
        return {
          profile,
          memories: [...memories]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, RECENT_MEMORIES),
          experience: [...experience].reverse().slice(0, RECENT_EXPERIENCE),
        };
      } catch (err) {
        if (err instanceof HermesNotFoundError) return null;
        throw err;
      }
    },
  };
}
