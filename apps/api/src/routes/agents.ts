import { AGENT_IDS, type Agent } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { requireRole } from '../auth/middleware';
import { toAgent } from '../db/mappers';
import type { Models } from '../db/models';
import { sendSuccess } from '../http/response';

export interface AgentsRouterDeps {
  readonly models: Models;
  readonly requireAuth: RequestHandler;
}

function byHierarchy(left: Agent, right: Agent): number {
  return AGENT_IDS.indexOf(left.id) - AGENT_IDS.indexOf(right.id);
}

// Read-only on purpose: agent status changes only through runtime events (plan section 12).
export function createAgentsRouter(deps: AgentsRouterDeps): Router {
  const router = Router();

  router.get('/agents', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    const records = await deps.models.Agent.find().lean();
    sendSuccess(res, records.map(toAgent).sort(byHierarchy));
  });

  return router;
}
