import type { Run } from '@redhunter/shared';
import type { Outbox } from '../events/outbox';
import type { ServiceDeps } from './deps';
import { transitionRun } from './runs';

export interface DispatcherOptions {
  readonly maxRetries?: number;
}

export interface RunDispatcher {
  enqueue(runId: string): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface PendingRun {
  readonly runId: string;
  readonly attempt: number;
}

const SYSTEM_ACTOR = { kind: 'system' as const, id: 'dispatcher' };

export function createRunDispatcher(
  deps: ServiceDeps,
  options: DispatcherOptions = {},
): RunDispatcher {
  const maxRetries = options.maxRetries ?? 3;
  const pendingRuns: PendingRun[] = [];
  let processing = false;
  let stopped = false;
  let processQueuePromise: Promise<void> | null = null;

  function enqueue(runId: string): void {
    if (stopped) return;
    pendingRuns.push({ runId, attempt: 1 });
    void processQueue();
  }

  async function executeRun(run: Run): Promise<void> {
    const adapter = deps.adapters?.find(a => a.id === run.adapterId);
    if (!adapter) {
      throw new Error(`Adapter ${run.adapterId} not found`);
    }

    await transitionRun(deps, {
      runId: run.id,
      to: 'composing',
      actor: SYSTEM_ACTOR,
    });

    await transitionRun(deps, {
      runId: run.id,
      to: 'executing',
      actor: SYSTEM_ACTOR,
    });

    for await (const event of adapter.start({
      runId: run.id,
      agentId: run.agentId,
      prompt: run.promptSnapshot?.text || '',
      cwd: process.cwd(),
    })) {
      if (event.type === 'text') {
        console.info(`Adapter output: ${event.text}`);
      }
    }
  }

  async function processQueue(): Promise<void> {
    if (processing || stopped) return;
    processing = true;

    try {
      while (pendingRuns.length > 0 && !stopped) {
        const pending = pendingRuns.shift();
        if (!pending) break;

        const run = await deps.models.Run.findById(pending.runId).lean();
        if (!run) continue;

        try {
          await executeRun({ ...run, id: run._id } as Run);

          await transitionRun(deps, {
            runId: pending.runId,
            to: 'verifying',
            actor: SYSTEM_ACTOR,
          });

          await transitionRun(deps, {
            runId: pending.runId,
            to: 'succeeded',
            actor: SYSTEM_ACTOR,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`Run ${pending.runId} failed (attempt ${pending.attempt}): ${message}`);

          if (pending.attempt < maxRetries) {
            await transitionRun(deps, {
              runId: pending.runId,
              to: 'paused',
              error: message,
              actor: SYSTEM_ACTOR,
            });

            await transitionRun(deps, {
              runId: pending.runId,
              to: 'queued',
              actor: SYSTEM_ACTOR,
            });

            pendingRuns.push({ runId: pending.runId, attempt: pending.attempt + 1 });
          } else {
            console.error(`Run ${pending.runId} exhausted retries (${maxRetries})`);

            await transitionRun(deps, {
              runId: pending.runId,
              to: 'failed',
              error: message,
              actor: SYSTEM_ACTOR,
            });
          }
        }
      }
    } finally {
      processing = false;
    }
  }

  async function start(): Promise<void> {
    stopped = false;
    const pending = await deps.models.Run.find({ status: 'queued' }).sort({ createdAt: 1 }).lean();
    for (const run of pending) {
      pendingRuns.push({ runId: run._id, attempt: 1 });
    }
    processQueuePromise = processQueue();
  }

  async function stop(): Promise<void> {
    stopped = true;
    if (processQueuePromise) {
      await processQueuePromise;
    }
  }

  return { enqueue, start, stop };
}
