import { type RequestHandler, Router } from 'express';
import { requireRole } from '../auth/middleware';
import { sendSuccess } from '../http/response';
import type { ServiceDeps } from '../services/deps';

const GROUP_BY_VALUES = ['agentId', 'adapterId', 'day'] as const;
type GroupBy = (typeof GROUP_BY_VALUES)[number];

export function createUsageRouter(deps: Pick<ServiceDeps, 'models'>): Router {
  const router = Router();
  const requireViewer = requireRole('viewer');

  const getUsage: RequestHandler = async (req, res, next) => {
    try {
      const groupByRaw = Array.isArray(req.query.groupBy) ? req.query.groupBy[0] : req.query.groupBy;
      const groupBy = (GROUP_BY_VALUES as readonly string[]).includes(groupByRaw as string)
        ? (groupByRaw as GroupBy)
        : 'agentId';

      const runs = await deps.models.Run.find({ status: 'done' })
        .select({ agentId: 1, adapterId: 1, endedAt: 1, usage: 1 })
        .lean();

      type Bucket = {
        key: string;
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        runs: number;
      };
      const buckets = new Map<string, Bucket>();

      for (const run of runs) {
        const usage = Array.isArray(run.usage) ? run.usage : [];
        const inputTokens = usage.reduce((sum, u) => sum + (u.inputTokens ?? 0), 0);
        const outputTokens = usage.reduce((sum, u) => sum + (u.outputTokens ?? 0), 0);
        const costUsd = usage.reduce((sum, u) => sum + (u.costUsd ?? 0), 0);

        let key: string;
        if (groupBy === 'agentId') {
          key = run.agentId;
        } else if (groupBy === 'adapterId') {
          key = run.adapterId;
        } else {
          const ended = run.endedAt ?? run.createdAt;
          key = ended ? new Date(ended).toISOString().slice(0, 10) : 'unknown';
        }

        const prev = buckets.get(key);
        if (prev) {
          prev.inputTokens += inputTokens;
          prev.outputTokens += outputTokens;
          prev.costUsd += costUsd;
          prev.runs += 1;
        } else {
          buckets.set(key, { key, inputTokens, outputTokens, costUsd, runs: 1 });
        }
      }

      const bucketsArray = Array.from(buckets.values()).sort((a, b) => b.runs - a.runs);
      const totals = bucketsArray.reduce(
        (acc, b) => ({
          inputTokens: acc.inputTokens + b.inputTokens,
          outputTokens: acc.outputTokens + b.outputTokens,
          costUsd: acc.costUsd + b.costUsd,
          runs: acc.runs + b.runs,
        }),
        { inputTokens: 0, outputTokens: 0, costUsd: 0, runs: 0 },
      );

      sendSuccess(res, { groupBy, buckets: bucketsArray, totals });
    } catch (err) {
      next(err);
    }
  };

  router.get('/', requireViewer, getUsage);
  return router;
}
