import { Router } from 'express';
import { LoginBodySchema } from '../auth/credentials';
import { verifyPassword } from '../auth/password';
import { signAccessToken } from '../auth/token';
import { toPublicUser } from '../db/mappers';
import type { Models } from '../db/models';
import { ERROR_MESSAGES, sendError, sendSuccess, sendUnauthorized } from '../http/response';

export interface AuthRouterDeps {
  readonly models: Models;
  readonly jwtSecret: string;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/auth/login', async (req, res) => {
    const body = LoginBodySchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidBody);
      return;
    }
    const user = await deps.models.User.findOne({ email: body.data.email }).lean();
    // Unknown user and wrong password share one path and one message (no enumeration).
    const isValid = await verifyPassword(body.data.password, user?.passwordHash);
    if (user === null || !isValid) {
      sendUnauthorized(res, ERROR_MESSAGES.invalidCredentials);
      return;
    }
    const publicUser = toPublicUser(user);
    const token = await signAccessToken(
      { sub: publicUser.id, role: publicUser.role },
      deps.jwtSecret,
    );
    sendSuccess(res, { token, user: publicUser });
  });

  return router;
}
