import type { AgentRuntime } from '@redhunter/agent-runtime';
import type { Decision } from '@redhunter/shared';
import express, { type Express } from 'express';
import { createRequireAuth } from './auth/middleware';
import type { Models } from './db/models';
import type { Outbox } from './events/outbox';
import { errorHandler, notFoundHandler } from './http/errors';
import { type AgentHermesSource, createAgentsHermesRouter } from './routes/agentsHermes';
import { createAgentsRouter } from './routes/agents';
import { createAuthRouter } from './routes/auth';
import { createDecisionsRouter } from './routes/decisions';
import { createDirectivesRouter } from './routes/directives';
import { createKnowledgeRouter } from './routes/knowledge';
import { createMeRouter } from './routes/me';
import { createOfficeRouter } from './routes/office';
import { createProjectsRouter } from './routes/projects';
import { createRunsRouter } from './routes/runs';
import { createTasksRouter } from './routes/tasks';
import { createUsageRouter } from './routes/usage';
import { createHealthRouter } from './routes/health';
import type { Connection } from 'mongoose';
import type { AgentAdapter, AdapterId } from '@redhunter/shared';

export const API_PREFIX = '/api/v1';
// Request bodies are small (knowledge text <= 12k chars); the cap rejects oversized payloads early.
const JSON_BODY_LIMIT = '16kb';

export interface AppDeps {
  readonly models: Models;
  readonly jwtSecret: string;
  readonly outbox: Outbox;
  // Optional so pure-HTTP tests (no runtime) keep working; routing only happens when present.
  readonly runtime?: AgentRuntime;
  // Agent detail data source (todo 15); route is only mounted when present.
  readonly hermesSource?: AgentHermesSource;
  // Allowed CORS origins for cross-origin requests
  readonly allowedOrigins?: readonly string[];
  readonly connection?: Connection;
  readonly adapters?: Partial<Record<AdapterId, AgentAdapter>>;
}

// Pure factory: no listen, no DB connect. supertest and todo 4 (Socket.IO) build on it.
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  // CORS middleware for cross-origin requests
  if (deps.allowedOrigins && deps.allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && deps.allowedOrigins!.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const requireAuth = createRequireAuth(deps.jwtSecret);
  const work = { models: deps.models, outbox: deps.outbox, requireAuth };
  app.use(API_PREFIX, createAuthRouter(deps));
  app.use(API_PREFIX, createMeRouter({ models: deps.models, requireAuth }));
  app.use(API_PREFIX, createAgentsRouter({ models: deps.models, requireAuth }));
  app.use(API_PREFIX, createDirectivesRouter({ ...work, runtime: deps.runtime }));
  app.use(API_PREFIX, createTasksRouter(work));
  app.use(API_PREFIX, createRunsRouter(work));
  app.use(API_PREFIX, createProjectsRouter(work));
  app.use(API_PREFIX, createKnowledgeRouter(work));
  app.use(API_PREFIX, createOfficeRouter(work));
  if (deps.hermesSource !== undefined) {
    app.use(API_PREFIX, createAgentsHermesRouter({ source: deps.hermesSource, requireAuth }));
  }
  app.use(API_PREFIX, createUsageRouter({ models: deps.models }));

  if (deps.runtime !== undefined) {
    app.use(API_PREFIX, createDecisionsRouter({
      runtime: deps.runtime,
      requireAuth,
      decisions: {
        findById: (id: string) => deps.runtime!.decisions.findById(id),
        update: (id: string, patch: Partial<Decision>) => deps.runtime!.decisions.update(id, patch),
        listPending: () => deps.runtime!.decisions.listPending(),
      },
    }));
  }

  // Healthz outside auth, no prefix
  if (deps.connection !== undefined && deps.adapters !== undefined) {
    app.use('/healthz', createHealthRouter({
      models: deps.models,
      outbox: deps.outbox,
      connection: deps.connection,
      adapters: Object.values(deps.adapters),
    }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
