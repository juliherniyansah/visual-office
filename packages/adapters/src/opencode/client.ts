import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client';
import { createOpencodeClient as createV2Client } from '@opencode-ai/sdk/v2/client';

export const REQUEST_TIMEOUT_MS = 30_000;
export const HEALTH_TIMEOUT_MS = 5_000;

export type { OpencodeClient };

// `directory` scopes every request (session, prompt, events) to the run's sandbox cwd.
export function createRunClient(baseUrl: string, directory: string): OpencodeClient {
  return createOpencodeClient({ baseUrl, directory });
}

export function requestSignal(runSignal: AbortSignal): AbortSignal {
  return AbortSignal.any([runSignal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
}

// v1 client has no health route; GET /global/health exists only in the v2 client (same server).
export async function fetchVersion(baseUrl: string): Promise<string> {
  const client = createV2Client({ baseUrl });
  const { data } = await client.global.health({
    throwOnError: true,
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (typeof data?.version !== 'string' || data.version === '') {
    throw new Error('health response has no version');
  }
  return data.version;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error) ?? String(error);
}

// Rewraps any failure with the step that failed, so `failed` events name what broke.
export async function labelFailure<T>(name: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    throw new Error(`opencode ${name} failed: ${errorText(error)}`, { cause: error });
  }
}
