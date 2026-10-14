import { type RequestHandler, Router } from 'express';
import type { ServiceDeps } from '../services/deps';
import { logger } from '../lib/logger';

export function createHealthRouter(deps: ServiceDeps): Router {
  const router = Router();

  const healthz: RequestHandler = async (_req, res) => {
    const checks: Record<string, string> = {};
    let healthy = true;

    // Mongo check
    try {
      if (deps.connection?.readyState === 1) {
        checks.mongo = 'ok';
      } else {
        checks.mongo = 'down';
        healthy = false;
      }
    } catch (err) {
      checks.mongo = 'error';
      healthy = false;
      logger.error({ err }, 'healthz mongo check failed');
    }

    // Adapters check
    const adapterIds = deps.adapters?.map(a => a.id) ?? [];
    if (adapterIds.length > 0) {
      checks.adapters = 'ok';
    } else {
      checks.adapters = 'missing';
      healthy = false;
    }

    const status = healthy ? 200 : 503;
    res.status(status).json({
      success: healthy,
      data: { status: healthy ? 'healthy' : 'unhealthy', checks },
    });
  };

  router.get('/', healthz);
  return router;
}
