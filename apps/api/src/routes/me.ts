import { type RequestHandler, Router } from 'express';
import { isObjectIdOrHexString } from 'mongoose';
import { toPublicUser } from '../db/mappers';
import type { Models } from '../db/models';
import { sendSuccess, sendUnauthorized } from '../http/response';

export interface MeRouterDeps {
  readonly models: Models;
  readonly requireAuth: RequestHandler;
}

export function createMeRouter(deps: MeRouterDeps): Router {
  const router = Router();

  router.get('/me', deps.requireAuth, async (req, res) => {
    const subject = req.auth?.sub;
    if (subject === undefined || !isObjectIdOrHexString(subject)) {
      sendUnauthorized(res);
      return;
    }
    // Deleted users keep a valid token until expiry; treat them as unauthenticated.
    const user = await deps.models.User.findById(subject).lean();
    if (user === null) {
      sendUnauthorized(res);
      return;
    }
    sendSuccess(res, toPublicUser(user));
  });

  return router;
}
