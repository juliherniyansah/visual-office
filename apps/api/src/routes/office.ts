import { type RequestHandler, Router } from 'express';
import { requireRole } from '../auth/middleware';
import { sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { getOfficeState } from '../services/officeState';

export interface OfficeRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
}

// Read-only: office_state is written only by the projector (todo 15), never over REST.
export function createOfficeRouter(deps: OfficeRouterDeps): Router {
  const router = Router();

  router.get('/office/state', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    sendSuccess(res, await getOfficeState(deps));
  });

  return router;
}
