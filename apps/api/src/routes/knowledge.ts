import { TagSchema } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { ERROR_MESSAGES, sendError, sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { createKnowledgeDoc, listKnowledgeDocs } from '../services/knowledge';

const MAX_TITLE_LENGTH = 200;
// Fits comfortably under the 16kb JSON body limit; bigger documents need chunked ingest later.
const MAX_TEXT_LENGTH = 12_000;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 32;

// Text is stored verbatim (RAG source) but must contain something besides whitespace.
const CreateKnowledgeBodySchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  text: z
    .string()
    .max(MAX_TEXT_LENGTH)
    .refine((text) => text.trim().length > 0),
  tags: z.array(TagSchema.max(MAX_TAG_LENGTH)).max(MAX_TAGS).default([]),
});

export interface KnowledgeRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
}

export function createKnowledgeRouter(deps: KnowledgeRouterDeps): Router {
  const router = Router();

  router.post('/knowledge', deps.requireAuth, requireRole('operator'), async (req, res) => {
    const body = CreateKnowledgeBodySchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidBody);
      return;
    }
    sendSuccess(res, await createKnowledgeDoc(deps, body.data), 201);
  });

  router.get('/knowledge', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    sendSuccess(res, await listKnowledgeDocs(deps));
  });

  return router;
}
