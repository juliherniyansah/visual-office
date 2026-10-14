import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ConflictError, NotFoundError } from '../services/errors';
import { ERROR_MESSAGES, sendError } from './response';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_PAYLOAD_TOO_LARGE = 413;

interface ClientError {
  readonly status: number;
}

// body-parser errors carry a 4xx `status` (entity.parse.failed 400, entity.too.large 413, ...).
function isClientError(err: unknown): err is ClientError {
  if (typeof err !== 'object' || err === null || !('status' in err)) {
    return false;
  }
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, ERROR_MESSAGES.notFound);
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof NotFoundError) {
    sendError(res, HTTP_NOT_FOUND, ERROR_MESSAGES.resourceNotFound);
    return;
  }
  // Invalid status transitions and lost compare-and-set races.
  if (err instanceof ConflictError) {
    sendError(res, HTTP_CONFLICT, ERROR_MESSAGES.conflict);
    return;
  }
  // Request bodies are never logged (they may contain credentials).
  if (isClientError(err) && err.status === HTTP_PAYLOAD_TOO_LARGE) {
    sendError(res, HTTP_PAYLOAD_TOO_LARGE, ERROR_MESSAGES.payloadTooLarge);
    return;
  }
  if (isClientError(err)) {
    sendError(res, HTTP_BAD_REQUEST, ERROR_MESSAGES.invalidBody);
    return;
  }
  console.error('Unhandled request error:', err instanceof Error ? err.stack : 'non-Error thrown');
  sendError(res, 500, ERROR_MESSAGES.internal);
};
