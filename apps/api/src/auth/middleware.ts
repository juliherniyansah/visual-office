import type { HumanRole } from '@redhunter/shared';
import type { RequestHandler } from 'express';
import { ERROR_MESSAGES, sendError, sendUnauthorized } from '../http/response';
import { type AccessClaims, verifyAccessToken } from './token';

declare global {
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

const ROLE_RANK: Record<HumanRole, number> = { viewer: 1, operator: 2, owner: 3 };

// Exactly "Bearer <token>"; anything else (Basic, missing token, extra parts) is rejected.
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i;

export function hasRole(actual: HumanRole, required: HumanRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined) {
    return undefined;
  }
  return BEARER_PATTERN.exec(header)?.[1];
}

export function createRequireAuth(jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (token === undefined) {
      sendUnauthorized(res);
      return;
    }
    const claims = await verifyAccessToken(token, jwtSecret);
    if (claims === null) {
      sendUnauthorized(res);
      return;
    }
    req.auth = claims;
    next();
  };
}

// Role comes from the signed token; fails closed (401) when requireAuth did not run.
export function requireRole(minRole: HumanRole): RequestHandler {
  return (req, res, next) => {
    if (req.auth === undefined) {
      sendUnauthorized(res);
      return;
    }
    if (!hasRole(req.auth.role, minRole)) {
      sendError(res, 403, ERROR_MESSAGES.forbidden);
      return;
    }
    next();
  };
}
