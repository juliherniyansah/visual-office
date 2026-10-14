import type { AgentRuntime } from '@redhunter/agent-runtime';
import { PrioritySchema, TagSchema } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { matchAgent, routeDirective } from '../coo/routeDirective';
import { toDirective } from '../db/mappers';
import type { AgentRecord } from '../db/models';
import { ERROR_MESSAGES, sendError, sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { createDirective, listDirectives } from '../services/directives';
import { humanActor } from './actor';

const MAX_TEXT_LENGTH = 4000;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 32;
const HTTP_UNPROCESSABLE = 422;

// Non-strict object: server-owned fields (id, status, issuedBy, eventId) are stripped, never trusted.
const CreateDirectiveBodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  priority: PrioritySchema.default('normal'),
  capabilityTags: z.array(TagSchema.max(MAX_TAG_LENGTH)).max(MAX_TAGS).default([]),
});

export interface DirectivesRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
  readonly runtime?: AgentRuntime;
}

// Routing runs after the response: 201 means the directive is persisted; the pipeline reports
// progress through domain events (result.recorded / decision.requested), not the HTTP status.
async function runPipeline(deps: DirectivesRouterDeps, directiveId: string): Promise<void> {
  const record = await deps.models.Directive.findById(directiveId).lean();
  if (record === null || deps.runtime === undefined) return;
  try {
    await routeDirective(
      { models: deps.models, outbox: deps.outbox, runtime: deps.runtime },
      toDirective(record),
    );
  } catch (err) {
    console.error('directive pipeline failed', { directiveId, err });
  }
}

export function createDirectivesRouter(deps: DirectivesRouterDeps): Router {
  const router = Router();

  router.post('/directives', deps.requireAuth, requireRole('operator'), async (req, res) => {
    const body = CreateDirectiveBodySchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidBody);
      return;
    }
    if (deps.runtime !== undefined) {
      const agents = (await deps.models.Agent.find({}).lean()) as AgentRecord[];
      if (matchAgent(agents, body.data.capabilityTags) === undefined) {
        sendError(res, HTTP_UNPROCESSABLE, 'no agent matches capabilityTags');
        return;
      }
    }
    const directive = await createDirective(deps, { ...body.data, issuedBy: humanActor(req) });
    sendSuccess(res, directive, 201);
    void runPipeline(deps, directive.id);
  });

  router.get('/directives', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    sendSuccess(res, await listDirectives(deps));
  });

  return router;
}
