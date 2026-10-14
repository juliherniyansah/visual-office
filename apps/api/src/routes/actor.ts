import type { Actor } from '@redhunter/shared';
import type { Request } from 'express';

// Only call after requireAuth/requireRole: the actor always comes from the verified token.
export function humanActor(req: Request): Actor {
  if (req.auth === undefined) {
    throw new Error('humanActor called without an authenticated request');
  }
  return { kind: 'human', id: req.auth.sub };
}
