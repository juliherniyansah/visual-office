import { AgentIdSchema, type HermesExperience, type HermesMemory, type HermesProfile } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { requireRole } from '../auth/middleware';
import { ERROR_MESSAGES, sendError, sendSuccess } from '../http/response';

// Profile + recent memories + experience for the Agent detail dashboard (todo 15).
export interface AgentHermesData {
  readonly profile: HermesProfile;
  readonly memories: readonly HermesMemory[];
  readonly experience: readonly HermesExperience[];
}

// Narrow seam so the route stays storage-agnostic; wired to HermesStore in app.ts.
export interface AgentHermesSource {
  get(agentId: Parameters<typeof AgentIdSchema.parse>[0]): Promise<AgentHermesData | null>;
}

export interface AgentsHermesRouterDeps {
  readonly source: AgentHermesSource;
  readonly requireAuth: RequestHandler;
}

export function createAgentsHermesRouter(deps: AgentsHermesRouterDeps): Router {
  const router = Router();

  router.get('/agents/:id/hermes', deps.requireAuth, requireRole('viewer'), async (req, res) => {
    const parsed = AgentIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      sendError(res, 404, ERROR_MESSAGES.resourceNotFound);
      return;
    }
    const data = await deps.source.get(parsed.data);
    if (data === null) {
      sendError(res, 404, ERROR_MESSAGES.resourceNotFound);
      return;
    }
    sendSuccess(res, data);
  });

  return router;
}
