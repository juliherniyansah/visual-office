import { realpathSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

// Child env is an explicit allow-list (plan section 13); vendor keys come in via `options.env`.
export const DEFAULT_ENV_ALLOW_LIST = ['PATH', 'HOME', 'LANG', 'TERM', 'TMPDIR'] as const;
// Stripped even when passed explicitly. Compared case-insensitively: Linux env names are
// case-sensitive, so `anthropic_auth_token` is a distinct var, but it is stripped too (fail closed).
export const FORBIDDEN_ENV_NAMES = [
  'ANTHROPIC_AUTH_TOKEN',
  'WEBSOCKET_AUTH_FILE_DESCRIPTOR',
] as const;
export const DEFAULT_KILL_GRACE_MS = 5000;

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Returns a function that clears the timer. Injected by tests to avoid real 5 s waits.
export type SetTimer = (fire: () => void, ms: number) => () => void;

export type SpawnErrorCode =
  | 'invalid_cwd'
  | 'invalid_env'
  | 'not_found'
  | 'spawn_failed'
  | 'aborted';

export class SpawnError extends Error {
  override readonly name = 'SpawnError';
  readonly code: SpawnErrorCode;

  constructor(code: SpawnErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

export interface ChildExit {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

export interface ChildHandle {
  readonly pid: number;
  // Line iterators ('\n' split, trailing '\r' dropped). Drain them: a full pipe blocks the child.
  readonly stdout: AsyncIterableIterator<string>;
  readonly stderr: AsyncIterableIterator<string>;
  // Resolves (never rejects) once the child exits; leftover group members are then SIGKILLed.
  readonly exited: Promise<ChildExit>;
  // SIGTERM to the process group, SIGKILL after DEFAULT_KILL_GRACE_MS. Idempotent.
  cancel(): Promise<ChildExit>;
}

export interface SpawnOptions {
  // Absolute existing directory; '/' (also via '..' or symlinks) is rejected as an adapter cwd.
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  // Aborted before spawn => SpawnError 'aborted'; aborted later => cancel().
  readonly signal?: AbortSignal;
  readonly setTimer?: SetTimer;
}

const defaultSetTimer: SetTimer = (fire, ms) => {
  const timer = setTimeout(fire, ms);
  return () => clearTimeout(timer);
};

function resolveCwd(cwd: string): string {
  if (!isAbsolute(cwd)) throw new SpawnError('invalid_cwd', `cwd must be absolute: "${cwd}"`);
  let real: string;
  try {
    real = realpathSync(cwd);
  } catch (error) {
    throw new SpawnError('invalid_cwd', `cwd does not exist: "${cwd}"`, { cause: error });
  }
  if (real === '/') throw new SpawnError('invalid_cwd', 'cwd must not be the filesystem root');
  if (!statSync(real).isDirectory()) {
    throw new SpawnError('invalid_cwd', `cwd is not a directory: "${cwd}"`);
  }
  return real;
}

function isForbidden(name: string): boolean {
  const upper = name.toUpperCase();
  return FORBIDDEN_ENV_NAMES.some((forbidden) => forbidden === upper);
}

function buildChildEnv(extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  for (const [name, value] of Object.entries(extra)) {
    if (!ENV_NAME_PATTERN.test(name) || value.includes('\0')) {
      throw new SpawnError('invalid_env', `Invalid env entry: ${JSON.stringify(name)}`);
    }
  }
  const inherited: Record<string, string> = {};
  for (const name of DEFAULT_ENV_ALLOW_LIST) {
    const value = process.env[name];
    if (value !== undefined) inherited[name] = value;
  }
  // Explicit env wins over inherited values; forbidden names are dropped last, whatever their source.
  const merged = Object.entries({ ...inherited, ...extra });
  return Object.fromEntries(merged.filter(([name]) => !isForbidden(name)));
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) yield part.endsWith('\r') ? part.slice(0, -1) : part;
  }
  buffer += decoder.decode();
  if (buffer !== '') yield buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
}

function startProcess(
  command: string,
  args: readonly string[],
  cwd: string,
  env: Record<string, string>,
) {
  try {
    // detached => setsid(): child leads its own process group, so signals reach grandchildren.
    return Bun.spawn([command, ...args], {
      cwd,
      env,
      detached: true,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    throw new SpawnError(isMissing ? 'not_found' : 'spawn_failed', `Failed to spawn "${command}"`, {
      cause: error,
    });
  }
}

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    // ESRCH: group already gone. EPERM: pgid now owned by someone else. Both: nothing of ours left.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ESRCH' && code !== 'EPERM') throw error;
  }
}

export async function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
): Promise<ChildHandle> {
  const cwd = resolveCwd(options.cwd);
  const env = buildChildEnv(options.env);
  if (options.signal?.aborted) throw new SpawnError('aborted', 'Spawn aborted before start');
  const child = startProcess(command, args, cwd, env);
  const setTimer = options.setTimer ?? defaultSetTimer;
  let clearKillTimer: (() => void) | undefined;
  let isStopping = false;

  const exited = child.exited.then((): ChildExit => {
    isStopping = true;
    clearKillTimer?.();
    // Leader is gone; reap anything it left behind in its group (no strays).
    killGroup(child.pid, 'SIGKILL');
    options.signal?.removeEventListener('abort', onAbort);
    return { exitCode: child.exitCode, signal: child.signalCode };
  });

  const cancel = (): Promise<ChildExit> => {
    if (!isStopping) {
      isStopping = true;
      killGroup(child.pid, 'SIGTERM');
      clearKillTimer = setTimer(() => killGroup(child.pid, 'SIGKILL'), DEFAULT_KILL_GRACE_MS);
    }
    return exited;
  };

  function onAbort(): void {
    void cancel();
  }
  options.signal?.addEventListener('abort', onAbort, { once: true });

  return {
    pid: child.pid,
    stdout: readLines(child.stdout),
    stderr: readLines(child.stderr),
    exited,
    cancel,
  };
}
