import { AdapterIdSchema } from '@redhunter/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { ERROR_MESSAGES, sendError, sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';
import { createProject, listProjects } from '../services/projects';

const MAX_NAME_LENGTH = 120;
const MAX_REPO_PATH_LENGTH = 1024;
const DEFAULT_ADAPTER = 'opencode';

// Absolute POSIX path without '.', '..', empty segments or NUL: repoPath later becomes an adapter
// cwd (plan section 8), so traversal-shaped input is rejected here, not normalized.
function isSafeAbsolutePath(path: string): boolean {
  const segments = path.split('/').slice(1, path.endsWith('/') ? -1 : undefined);
  return (
    path.startsWith('/') &&
    !path.includes('\0') &&
    segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

// Non-strict object: server-owned fields (id, createdAt, createdBy, eventId) are stripped.
const CreateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  repoPath: z.string().max(MAX_REPO_PATH_LENGTH).refine(isSafeAbsolutePath),
  defaultAdapter: AdapterIdSchema.default(DEFAULT_ADAPTER),
});

export interface ProjectsRouterDeps extends ServiceDeps {
  readonly requireAuth: RequestHandler;
}

export function createProjectsRouter(deps: ProjectsRouterDeps): Router {
  const router = Router();

  router.post('/projects', deps.requireAuth, requireRole('operator'), async (req, res) => {
    const body = CreateProjectBodySchema.safeParse(req.body);
    if (!body.success) {
      sendError(res, 400, ERROR_MESSAGES.invalidBody);
      return;
    }
    sendSuccess(res, await createProject(deps, body.data), 201);
  });

  router.get('/projects', deps.requireAuth, requireRole('viewer'), async (_req, res) => {
    sendSuccess(res, await listProjects(deps));
  });

  return router;
}
