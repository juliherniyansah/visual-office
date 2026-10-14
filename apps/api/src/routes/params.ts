import type { Request } from 'express';
import { NotFoundError } from '../services/errors';

const MAX_ID_LENGTH = 128;

// Ids are server-generated uuids; a missing or oversized :id cannot exist -> 404 without a query.
export function readIdParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) {
    throw new NotFoundError('resource', 'invalid id');
  }
  return id;
}
