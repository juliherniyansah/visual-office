import { Router } from 'express';
import { LoginBodySchema, SetupBodySchema } from '../auth/credentials';
import { hashPassword, verifyPassword } from '../auth/password';
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

  router.get('/auth/setup-status', async (_req, res) => {
    try {
      const userCount = await deps.models.User.countDocuments();
      sendSuccess(res, { setupComplete: userCount > 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      sendError(res, 500, `failed to check setup status: ${message}`);
    }
  });

  router.post('/auth/setup', async (req, res) => {
    const body = SetupBodySchema.safeParse(req.body);
    if (!body.success) {
      const errors = body.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      sendError(res, 400, `${ERROR_MESSAGES.invalidBody}: ${errors}`);
      return;
    }
    try {
      const userCount = await deps.models.User.countDocuments();
      if (userCount > 0) {
        sendError(res, 409, ERROR_MESSAGES.setupConflict);
        return;
      }
      const passwordHash = await hashPassword(body.data.password);
      const inserted = await deps.models.User.insertMany([
        {
          email: body.data.email,
          passwordHash,
          role: 'owner',
          status: 'active',
          kind: 'human',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const user = inserted[0];
      if (!user) {
        sendError(res, 500, 'failed to create owner: insert returned empty');
        return;
      }
      const publicUser = toPublicUser(user);
      const token = await signAccessToken(
        { sub: publicUser.id, role: publicUser.role },
        deps.jwtSecret,
      );
      sendSuccess(res, { token, user: publicUser }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      sendError(res, 500, `failed to create owner: ${message}`);
    }
  });

  router.get('/auth/setup-status', async (_req, res) => {
    try {
      const userCount = await deps.models.User.countDocuments();
      sendSuccess(res, { setupComplete: userCount > 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      sendError(res, 500, `failed to check setup status: ${message}`);
    }
  });

  return router;
}
