import type { AdapterEvent, AdapterRunInput, AgentAdapter } from '@redhunter/shared';

export interface CrashRetryOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

/**
 * Wraps an AgentAdapter to automatically retry on crash (unexpected exit before completion).
 * Uses exponential backoff: baseDelayMs * 2^attempt, capped at maxDelayMs.
 * Only retries on `failed` events, not on successful completion or cancellation.
 */
export function withCrashRetry(
  adapter: AgentAdapter,
  options: CrashRetryOptions = {},
): AgentAdapter {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  return {
    id: adapter.id,
    async *start(input: AdapterRunInput): AsyncGenerator<AdapterEvent> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let failed = false;

        for await (const event of adapter.start(input)) {
          if (event.type === 'failed') {
            failed = true;
          }
          yield event;
        }

        if (!failed) break;
        if (attempt >= maxRetries) break;

        const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
        yield {
          type: 'text',
          text: `Adapter crashed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        };
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    },
    async answerPermission(runId, permissionId, decision) {
      return adapter.answerPermission(runId, permissionId, decision);
    },
    async cancel(runId) {
      return adapter.cancel(runId);
    },
  };
}
