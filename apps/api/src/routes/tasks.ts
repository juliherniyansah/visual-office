import { AgentIdSchema, type TaskStatus, TaskStatusSchema } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { ERROR_MESSAGES, sendError, sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { listTasks, transitionTask } from '../services/tasks';
import { humanActor } from './actor';
import { readIdParam } from './params';

// Human intervention only (plan section 4). `from` narrows TASK_TRANSITIONS to states a human may
// act on: assigned -> in_progress is a runtime move, so resume requires a paused task.
const TASK_ACTIONS = {
  pause: { to: 'paused', from: ['in_progress'] },
  resume: { to: 'in_progress', from: ['paused'] },
  cancel: { to: 'cancelled', from: ['planned', 'assigned', 'in_progress', 'paused', 'escalated'] },
} as const satisfies Record<string, { to: TaskStatus; from: readonly TaskStatus[] }>;

const PatchTaskBodySchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']),
});

const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  assigneeAgentId: AgentIdSchema.optional(),
});

export interface TasksRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
}

export function createTasksRouter(deps: TasksRouterDeps): Router {
  const router = Router();

  router.get('/tasks', deps.requireAuth, requireRole('viewer'), async (req, res) => {
    const filter = TaskQuerySchema.safeParse(req.query);
    if (!filter.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidQuery);
      return;
    }
    sendSuccess(res, await listTasks(deps, filter.data));
  });

  router.patch('/tasks/:id', deps.requireAuth, requireRole('operator'), async (req, res) => {
    const body = PatchTaskBodySchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidBody);
      return;
    }
    const action = TASK_ACTIONS[body.data.action];
    const task = await transitionTask(deps, {
      taskId: readIdParam(req),
      to: action.to,
      allowedFrom: action.from,
      actor: humanActor(req),
    });
    sendSuccess(res, task);
  });

  return router;
}
