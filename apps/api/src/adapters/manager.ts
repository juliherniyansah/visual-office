import type { AdapterId } from '@redhunter/shared';
import type { Logger } from '../lib/logger';

export interface AdapterManagerOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly logger?: Logger;
}

export interface AdapterHandle {
  readonly adapterId: AdapterId;
  readonly pid: number;
  readonly startedAt: Date;
  kill(): Promise<void>;
  readonly exited: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>;
}

export interface AdapterSpawner {
  (adapterId: AdapterId): Promise<AdapterHandle>;
}

export interface AdapterManager {
  start(adapterId: AdapterId): Promise<void>;
  stop(adapterId: AdapterId): Promise<void>;
  stopAll(): Promise<void>;
  readonly running: ReadonlyMap<AdapterId, AdapterHandle>;
}

export function createAdapterManager(
  spawner: AdapterSpawner,
  options: AdapterManagerOptions = {},
): AdapterManager {
  const maxRetries = options.maxRetries ?? 10;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const logger = options.logger ?? console;

  const running = new Map<AdapterId, AdapterHandle>();
  const retryCounts = new Map<AdapterId, number>();
  const stopping = new Set<AdapterId>();

  async function startWithRetry(adapterId: AdapterId): Promise<void> {
    const attempt = retryCounts.get(adapterId) ?? 0;

    if (attempt >= maxRetries) {
      logger.error(`Adapter ${adapterId} exhausted retries (${maxRetries})`);
      return;
    }

    try {
      const handle = await spawner(adapterId);
      running.set(adapterId, handle);
      retryCounts.set(adapterId, 0);
      logger.info(`Adapter ${adapterId} started (pid ${handle.pid})`);

      handle.exited.then(({ exitCode, signal }) => {
        running.delete(adapterId);

        if (stopping.has(adapterId)) {
          stopping.delete(adapterId);
          return;
        }

        const wasCrash = exitCode !== 0 || signal !== null;
        if (wasCrash) {
          logger.warn(
            `Adapter ${adapterId} crashed (exit=${exitCode}, signal=${signal}), restarting...`,
          );
          const currentAttempt = retryCounts.get(adapterId) ?? 0;
          retryCounts.set(adapterId, currentAttempt + 1);
          const delay = Math.min(baseDelayMs * 2 ** currentAttempt, maxDelayMs);
          setTimeout(() => void startWithRetry(adapterId), delay);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start adapter ${adapterId}: ${message}`);
      const currentAttempt = retryCounts.get(adapterId) ?? 0;
      retryCounts.set(adapterId, currentAttempt + 1);
      const delay = Math.min(baseDelayMs * 2 ** currentAttempt, maxDelayMs);
      setTimeout(() => void startWithRetry(adapterId), delay);
    }
  }

  async function start(adapterId: AdapterId): Promise<void> {
    if (running.has(adapterId)) return;
    retryCounts.set(adapterId, 0);
    await startWithRetry(adapterId);
  }

  async function stop(adapterId: AdapterId): Promise<void> {
    const handle = running.get(adapterId);
    if (!handle) return;

    stopping.add(adapterId);
    await handle.kill();
    running.delete(adapterId);
    retryCounts.delete(adapterId);
  }

  async function stopAll(): Promise<void> {
    const adapterIds = Array.from(running.keys());
    await Promise.all(adapterIds.map((id) => stop(id)));
  }

  return { start, stop, stopAll, running };
}
