import { describe, expect, test } from 'bun:test';
import type { AdapterEvent, AdapterRunInput } from '@redhunter/shared';
import { FakeAdapter } from './fake';

const INPUT: AdapterRunInput = {
  runId: 'run-1',
  agentId: 'programming',
  cwd: '/srv/repos/redhunter',
  prompt: 'Fix the login bug.',
};

const PERMISSION: AdapterEvent = {
  type: 'permission_request',
  permissionId: 'perm-1',
  tool: 'bash',
  detail: 'rm -rf dist',
};

const STARTED: AdapterEvent = { type: 'started', vendorSessionId: 'ses_1' };
const TEXT: AdapterEvent = { type: 'text', text: 'first' };
const COMPLETED: AdapterEvent = { type: 'completed', finalText: 'done' };

const SCRIPT: readonly AdapterEvent[] = [
  STARTED,
  TEXT,
  { type: 'tool', name: 'bash', input: { command: 'ls' }, status: 'started' },
  { type: 'tool', name: 'bash', input: { command: 'ls' }, status: 'completed', exitCode: 0 },
  { type: 'text', text: 'second' },
  COMPLETED,
];

const GATED_SCRIPT: readonly AdapterEvent[] = [
  STARTED,
  PERMISSION,
  { type: 'text', text: 'after permission' },
  COMPLETED,
];

const PENDING_PROBE_MS = 20;

async function collect(events: AsyncIterable<AdapterEvent>): Promise<AdapterEvent[]> {
  const out: AdapterEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending');
  const winner = await Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, PENDING_PROBE_MS, pending)),
  ]);
  return winner !== pending;
}

function iterate(adapter: FakeAdapter, input: AdapterRunInput = INPUT) {
  return adapter.start(input)[Symbol.asyncIterator]();
}

describe('FakeAdapter replay', () => {
  test('replays the script in order and then ends', async () => {
    const adapter = new FakeAdapter({ script: SCRIPT });
    expect(await collect(adapter.start(INPUT))).toEqual([...SCRIPT]);
  });

  test('defaults id to opencode and accepts another id', () => {
    expect(new FakeAdapter({ script: [] }).id).toBe('opencode');
    expect(new FakeAdapter({ script: [], id: 'claude' }).id).toBe('claude');
  });

  test('waits on the injected sleep for delayed steps only', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => {
      sleeps.push(ms);
    };
    const script = [STARTED, { event: TEXT, delayMs: 50 }, COMPLETED];
    const adapter = new FakeAdapter({ script, sleep });
    expect(await collect(adapter.start(INPUT))).toEqual([STARTED, TEXT, COMPLETED]);
    expect(sleeps).toEqual([50]);
  });

  test('default sleep really waits for delayed steps', async () => {
    const adapter = new FakeAdapter({ script: [{ event: TEXT, delayMs: 30 }] });
    const before = performance.now();
    expect(await collect(adapter.start(INPUT))).toEqual([TEXT]);
    expect(performance.now() - before).toBeGreaterThanOrEqual(25);
  });

  test('rejects a second concurrent start for the same run and allows a restart after', async () => {
    const adapter = new FakeAdapter({ script: SCRIPT });
    const first = adapter.start(INPUT);
    expect(() => adapter.start(INPUT)).toThrow('Run run-1 is already active');
    expect(await collect(first)).toHaveLength(SCRIPT.length);
    expect(await collect(adapter.start(INPUT))).toHaveLength(SCRIPT.length);
  });

  test('releases the run when the consumer stops early', async () => {
    const adapter = new FakeAdapter({ script: SCRIPT });
    for await (const event of adapter.start(INPUT)) {
      if (event.type === 'text') break;
    }
    expect(await collect(adapter.start(INPUT))).toHaveLength(SCRIPT.length);
  });
});

describe('FakeAdapter permission gating', () => {
  test('pauses after permission_request until allow, then continues', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const events = iterate(adapter);
    await events.next();
    expect((await events.next()).value).toEqual(PERMISSION);
    const next = events.next();
    expect(await isSettled(next)).toBe(false);
    await adapter.answerPermission('run-1', 'perm-1', 'allow');
    expect((await next).value).toEqual({ type: 'text', text: 'after permission' });
    expect(await collect({ [Symbol.asyncIterator]: () => events })).toEqual([COMPLETED]);
  });

  test('accepts an answer given before the consumer asks for the next event', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const events = iterate(adapter);
    await events.next();
    await events.next();
    await adapter.answerPermission('run-1', 'perm-1', 'allow');
    expect((await events.next()).value).toEqual({ type: 'text', text: 'after permission' });
  });

  test('deny emits failed and skips the rest of the script', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const events = iterate(adapter);
    await events.next();
    await events.next();
    const next = events.next();
    await adapter.answerPermission('run-1', 'perm-1', 'deny');
    expect((await next).value).toEqual({ type: 'failed', error: 'Permission perm-1 denied' });
    expect((await events.next()).done).toBe(true);
  });

  test('rejects answers for an unknown run or a permission that is not pending', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const events = iterate(adapter);
    await events.next();
    await expect(adapter.answerPermission('run-1', 'perm-1', 'allow')).rejects.toThrow(
      'No pending permission perm-1 for run run-1',
    );
    await events.next();
    await expect(adapter.answerPermission('run-1', 'perm-2', 'allow')).rejects.toThrow(
      'No pending permission perm-2 for run run-1',
    );
    await expect(adapter.answerPermission('run-9', 'perm-1', 'allow')).rejects.toThrow(
      'No pending permission perm-1 for run run-9',
    );
    await adapter.cancel('run-1');
  });
});

describe('FakeAdapter cancel', () => {
  test('ends the iterator while waiting for a permission', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const events = iterate(adapter);
    await events.next();
    expect((await events.next()).value).toEqual(PERMISSION);
    const next = events.next();
    await adapter.cancel('run-1');
    expect(await next).toEqual({ done: true, value: undefined });
  });

  test('stops replay between events; repeated or unknown cancel is a no-op', async () => {
    const adapter = new FakeAdapter({ script: SCRIPT });
    const events = iterate(adapter);
    expect((await events.next()).value).toEqual(STARTED);
    await adapter.cancel('run-1');
    await adapter.cancel('run-1');
    await adapter.cancel('run-unknown');
    expect((await events.next()).done).toBe(true);
  });

  test('ends the iterator during a delayed step', async () => {
    const adapter = new FakeAdapter({
      script: [{ event: TEXT, delayMs: 1000 }],
      sleep: () => new Promise(() => {}),
    });
    const next = iterate(adapter).next();
    expect(await isSettled(next)).toBe(false);
    await adapter.cancel('run-1');
    expect(await next).toEqual({ done: true, value: undefined });
  });

  test('abort signal cancels the run; a pre-aborted signal yields nothing', async () => {
    const adapter = new FakeAdapter({ script: GATED_SCRIPT });
    const controller = new AbortController();
    const events = iterate(adapter, { ...INPUT, signal: controller.signal });
    await events.next();
    expect((await events.next()).value).toEqual(PERMISSION);
    const next = events.next();
    controller.abort();
    expect((await next).done).toBe(true);
    const aborted = AbortSignal.abort();
    expect(await collect(adapter.start({ ...INPUT, signal: aborted }))).toEqual([]);
  });
});
