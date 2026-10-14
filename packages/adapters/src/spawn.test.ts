import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ChildHandle,
  DEFAULT_KILL_GRACE_MS,
  type SetTimer,
  SpawnError,
  type SpawnOptions,
  spawnChild,
} from './spawn';

const WORK_DIR = mkdtempSync(join(tmpdir(), 'rh-t8-spawn-'));
// Unique sleep argument so a stray grandchild can be found with pgrep after the suite.
const STRAY_SLEEP = 'sleep 30.808';
const IGNORES_TERM = `trap "" TERM; ${STRAY_SLEEP} & echo $!; wait`;
const HONORS_TERM = `${STRAY_SLEEP} & echo $!; wait`;
const BOUND_MS = 1000;
const PENDING_PROBE_MS = 100;

afterAll(async () => {
  rmSync(WORK_DIR, { recursive: true, force: true });
  const stray = await Bun.$`pgrep -f ${STRAY_SLEEP}`.nothrow().quiet();
  expect(stray.stdout.toString()).toBe('');
});

interface ManualTimer {
  readonly ms: number;
  readonly fire: () => void;
  cleared: boolean;
}

function manualTimers(): { readonly armed: ManualTimer[]; readonly setTimer: SetTimer } {
  const armed: ManualTimer[] = [];
  const setTimer: SetTimer = (fire, ms) => {
    const timer: ManualTimer = { ms, fire, cleared: false };
    armed.push(timer);
    return () => {
      timer.cleared = true;
    };
  };
  return { armed, setTimer };
}

function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} not settled in ${BOUND_MS} ms`)), BOUND_MS),
  );
  return Promise.race([promise, timeout]);
}

async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending');
  const timer = new Promise((resolve) => setTimeout(resolve, PENDING_PROBE_MS, pending));
  return (await Promise.race([promise, timer])) !== pending;
}

async function lines(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const line of iterable) out.push(line);
  return out;
}

// Reads one line without closing the stream (a for-await break would cancel it).
async function nextPid(child: ChildHandle): Promise<number> {
  const result = await child.stdout[Symbol.asyncIterator]().next();
  if (result.done) throw new Error('child closed stdout without output');
  return Number(result.value);
}

async function isGone(pid: number): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const stat = Bun.file(`/proc/${pid}/stat`);
    if (!(await stat.exists())) return true;
    await Bun.sleep(50);
  }
  return false;
}

function sh(script: string, options: Omit<SpawnOptions, 'cwd'> = {}) {
  return spawnChild('sh', ['-c', script], { cwd: WORK_DIR, ...options });
}

describe('spawnChild output and exit', () => {
  test('splits stdout and stderr into lines (CRLF, missing trailing newline)', async () => {
    const child = await sh(`printf 'a\\r\\nb\\n\\nc'; printf 'e1\\ne2' >&2`);
    const [out, err] = await Promise.all([lines(child.stdout), lines(child.stderr)]);
    expect(out).toEqual(['a', 'b', '', 'c']);
    expect(err).toEqual(['e1', 'e2']);
  });

  test('reads large output and multi-byte chars split across chunks', async () => {
    const child = await sh(`seq 1 100000; awk 'BEGIN{for(i=0;i<100000;i++) printf "€"; print ""}'`);
    const out = await lines(child.stdout);
    expect(out).toHaveLength(100001);
    expect(out[99999]).toBe('100000');
    expect(out[100000]).toBe('€'.repeat(100000));
  });

  test('resolves exited with a nonzero exit code instead of rejecting', async () => {
    const child = await sh('exit 3');
    expect(await bounded(child.exited, 'exit')).toEqual({ exitCode: 3, signal: null });
  });

  test.each([['definitely-not-a-binary-t8'], ['/nonexistent/bin/t8']])(
    'rejects %s with SpawnError not_found',
    async (cmd) => {
      const error = await spawnChild(cmd, [], { cwd: WORK_DIR }).catch((e) => e);
      expect(error).toBeInstanceOf(SpawnError);
      expect(error.code).toBe('not_found');
      expect(error.cause).toBeInstanceOf(Error);
    },
  );

  test('rejects a non-executable file with SpawnError spawn_failed', async () => {
    const script = join(WORK_DIR, 'not-executable.sh');
    writeFileSync(script, 'echo hi\n', { mode: 0o644 });
    const error = await spawnChild(script, [], { cwd: WORK_DIR }).catch((e) => e);
    expect(error).toBeInstanceOf(SpawnError);
    expect(error.code).toBe('spawn_failed');
  });

  test.each([
    ['empty', ''],
    ['a file', realpathSync(process.execPath)],
    ['root', '/'],
    ['root via traversal', `${WORK_DIR}/../../../../../..`],
    ['double slash root', '//'],
    ['relative', 'packages/adapters'],
    ['missing directory', join(WORK_DIR, 'missing')],
  ])('rejects %s cwd with SpawnError invalid_cwd before spawning', async (_label, cwd) => {
    const marker = join(WORK_DIR, `marker-${crypto.randomUUID()}`);
    const error = await spawnChild('touch', [marker], { cwd }).catch((e) => e);
    expect(error).toBeInstanceOf(SpawnError);
    expect(error.code).toBe('invalid_cwd');
    expect(existsSync(marker)).toBe(false);
  });

  test('runs in the given cwd', async () => {
    const child = await spawnChild('pwd', [], { cwd: WORK_DIR });
    expect(await lines(child.stdout)).toEqual([realpathSync(WORK_DIR)]);
  });
});

describe('spawnChild cancel', () => {
  test('SIGKILLs a child that ignores SIGTERM only after the grace timer fires', async () => {
    const { armed, setTimer } = manualTimers();
    const child = await sh(IGNORES_TERM, { setTimer });
    const grandchild = await nextPid(child);
    const cancelled = child.cancel();
    expect(armed.map((timer) => timer.ms)).toEqual([DEFAULT_KILL_GRACE_MS]);
    expect(DEFAULT_KILL_GRACE_MS).toBe(5000);
    expect(await isSettled(child.exited)).toBe(false);
    armed[0]?.fire();
    expect(await bounded(cancelled, 'cancel')).toEqual({ exitCode: null, signal: 'SIGKILL' });
    expect(await isGone(grandchild)).toBe(true);
  });

  test('a child that honors SIGTERM exits without SIGKILL and the timer is cleared', async () => {
    const { armed, setTimer } = manualTimers();
    const child = await sh(HONORS_TERM, { setTimer });
    const grandchild = await nextPid(child);
    expect(await bounded(child.cancel(), 'cancel')).toEqual({ exitCode: null, signal: 'SIGTERM' });
    expect(armed.map((timer) => [timer.ms, timer.cleared])).toEqual([
      [DEFAULT_KILL_GRACE_MS, true],
    ]);
    expect(await isGone(grandchild)).toBe(true);
  });

  test('cancel twice sends one SIGTERM and returns the same exit', async () => {
    const { armed, setTimer } = manualTimers();
    const child = await sh(HONORS_TERM, { setTimer });
    await nextPid(child);
    const [first, second] = await bounded(Promise.all([child.cancel(), child.cancel()]), 'cancel');
    expect(first).toEqual({ exitCode: null, signal: 'SIGTERM' });
    expect(second).toEqual(first);
    expect(armed).toHaveLength(1);
  });

  test('cancel after exit is a no-op', async () => {
    const { armed, setTimer } = manualTimers();
    const child = await sh('exit 0', { setTimer });
    await bounded(child.exited, 'exit');
    expect(await child.cancel()).toEqual({ exitCode: 0, signal: null });
    expect(armed).toHaveLength(0);
  });

  test('leader exit kills leftover group members (no strays)', async () => {
    const { armed, setTimer } = manualTimers();
    const child = await sh(`(trap "" TERM; exec ${STRAY_SLEEP}) & echo $!`, { setTimer });
    const grandchild = await nextPid(child);
    expect(await bounded(child.exited, 'exit')).toEqual({ exitCode: 0, signal: null });
    expect(await isGone(grandchild)).toBe(true);
    expect(armed).toHaveLength(0);
  });

  test('abort signal cancels a running child', async () => {
    const controller = new AbortController();
    const child = await sh(HONORS_TERM, { signal: controller.signal });
    const grandchild = await nextPid(child);
    controller.abort();
    expect(await bounded(child.exited, 'exit')).toEqual({ exitCode: null, signal: 'SIGTERM' });
    expect(await isGone(grandchild)).toBe(true);
  });

  test('an aborted signal rejects before spawning', async () => {
    const marker = join(WORK_DIR, `marker-${crypto.randomUUID()}`);
    const error = await spawnChild('touch', [marker], {
      cwd: WORK_DIR,
      signal: AbortSignal.abort(),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(SpawnError);
    expect(error.code).toBe('aborted');
    expect(existsSync(marker)).toBe(false);
  });
});
