import type { Config } from '@opencode-ai/sdk';
import { spawnChild } from '../spawn';

export const DEFAULT_SERVER_TIMEOUT_MS = 10_000;
const HOSTNAME = '127.0.0.1';
const LISTENING_LINE = /^opencode server listening on (https?:\/\/\S+)/;
const OUTPUT_TAIL_CHARS = 2000;

export interface LaunchServerOptions {
  // Default 'opencode', resolved through the allow-listed child PATH.
  readonly binary?: string;
  readonly cwd: string;
  readonly config: Config;
  // Vendor keys etc.; merged over the spawn allow-list, forbidden names stripped (spawnChild).
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export interface ServerHandle {
  readonly url: string;
  // Idempotent; resolves once the server process group is gone.
  close(): Promise<void>;
}

// Not SDK createOpencodeServer: that one spawns with the full parent process.env (plan s13 forbids).
export async function launchServer(options: LaunchServerOptions): Promise<ServerHandle> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SERVER_TIMEOUT_MS;
  const child = await spawnChild(
    options.binary ?? 'opencode',
    ['serve', `--hostname=${HOSTNAME}`, '--port=0'],
    {
      cwd: options.cwd,
      // Config last: callers cannot swap the sandbox through opts.env.
      env: { ...options.env, OPENCODE_CONFIG_CONTENT: JSON.stringify(options.config) },
    },
  );
  let output = '';
  const remember = (line: string): void => {
    output = `${output}${line}\n`.slice(-OUTPUT_TAIL_CHARS);
  };
  const stderrDone = drain(child.stderr, remember);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });
  try {
    const url = await Promise.race([readUrl(child.stdout, remember), timedOut]);
    if (url === 'timeout')
      throw new Error(`Timeout waiting for opencode server after ${timeoutMs}ms`);
    if (url === undefined) {
      const exit = await child.exited;
      await stderrDone;
      throw new Error(
        `opencode server exited with code ${exit.exitCode} before listening:\n${output}`,
      );
    }
    // Keep draining: a full stdout pipe would block the server.
    void drain(child.stdout, () => {});
    return { url, close: async () => void (await child.cancel()) };
  } catch (error) {
    await child.cancel();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Manual next(): a for-await break would close the line iterator we keep draining afterwards.
async function readUrl(
  lines: AsyncIterableIterator<string>,
  remember: (line: string) => void,
): Promise<string | undefined> {
  for (;;) {
    const next = await lines.next();
    if (next.done === true) return undefined;
    remember(next.value);
    const url = LISTENING_LINE.exec(next.value)?.[1];
    if (url !== undefined) return url;
  }
}

async function drain(
  lines: AsyncIterableIterator<string>,
  onLine: (line: string) => void,
): Promise<void> {
  for await (const line of lines) onLine(line);
}
