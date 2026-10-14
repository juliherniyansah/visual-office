import { type RequestHandler, Router } from 'express';
import { requireRole } from '../auth/middleware';
import { sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { getRun, listRunEvents } from '../services/runs';
import { readIdParam } from './params';

export interface RunsRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
}

// Read-only: runs advance only through the runtime (todo 9/13), never over REST.
export function createRunsRouter(deps: RunsRouterDeps): Router {
  const router = Router();

  router.get('/runs/:id', deps.requireAuth, requireRole('viewer'), async (req, res) => {
    sendSuccess(res, await getRun(deps, readIdParam(req)));
  });

  router.get('/runs/:id/events', deps.requireAuth, requireRole('viewer'), async (req, res) => {
    sendSuccess(res, await listRunEvents(deps, readIdParam(req)));
  });

  return router;
}
