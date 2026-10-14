import type { AgentRuntime } from '@redhunter/agent-runtime';
import type { Decision, PermissionDecision } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { sendError } from '../http/response';
import { humanActor } from './actor';
import { readIdParam } from './params';

export interface DecisionsRouteDeps {
  readonly runtime: AgentRuntime;
  readonly requireAuth: RequestHandler;
  readonly decisions: {
    findById(id: string): Promise<Decision | null>;
    update(id: string, patch: Partial<Decision>): Promise<Decision>;
    listPending(): Promise<Decision[]>;
  };
  readonly clock?: () => Date;
}

const DECISION_TIMEOUT_MS = 30 * 60 * 1000;

const AnswerBodySchema = z.object({
  answer: z.enum(['allow', 'deny']),
});

export function createDecisionsRouter(deps: DecisionsRouteDeps): Router {
  const router = Router();
  const clock = deps.clock ?? (() => new Date());

  router.get('/decisions', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    const decisions = await deps.decisions.listPending();
    res.json({ decisions });
  });

  router.post(
    '/decisions/:id/answer',
    deps.requireAuth,
    requireRole('operator'),
    async (req, res, next) => {
      let id: string;
      try {
        id = readIdParam(req);
      } catch (err) {
        next(err);
        return;
      }

      const body = AnswerBodySchema.safeParse(req.body);
      if (!body.success) {
        sendError(res, 400, `Invalid request body: ${body.error.message}`);
        return;
      }

      const decision = await deps.decisions.findById(id);
      if (!decision) {
        sendError(res, 404, 'Decision not found');
        return;
      }

      if (decision.answeredAt) {
        sendError(res, 409, 'Decision already answered');
        return;
      }

      const createdAt = new Date(decision.createdAt).getTime();
      const now = clock().getTime();
      if (now - createdAt > DECISION_TIMEOUT_MS) {
        sendError(res, 410, 'Decision expired');
        return;
      }

      const actor = humanActor(req);

      try {
        await deps.runtime.answerPermission(decision.runId, id, body.data.answer);
        const updated = await deps.decisions.update(id, {
          answeredBy: actor.id,
          answer: body.data.answer,
          answeredAt: new Date().toISOString(),
        });
        res.json({ decision: updated });
      } catch (err) {
        sendError(res, 500, `Failed to answer decision: ${(err as Error).message}`);
      }
    },
  );

  return router;
}
