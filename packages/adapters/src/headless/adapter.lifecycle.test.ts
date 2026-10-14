import { afterEach, expect, spyOn, test } from 'bun:test';
import { join } from 'node:path';
import { ClaudeAdapter } from '../claude/adapter';
import { collect, RUN_INPUT, types } from '../opencode/test-support/collect';
import { isProcessAlive } from '../opencode/test-support/fake-binary';
import { createFakeCli, type FakeCli, readPid } from './test-support/fake-cli';

const INIT = '{"type":"system","subtype":"init","session_id":"s1"}';
const DENIED =
  '{"type":"system","subtype":"permission_denied","tool_name":"Bash","tool_use_id":"p1","message":"no"}';
const RESULT =
  '{"type":"result","subtype":"success","is_error":false,"result":"ok","usage":{},"total_cost_usd":0,"permission_denials":[]}';
// The fake sleeps until its process group is killed.
const HANG = 'sleep 30';

let cli: FakeCli | undefined;
afterEach(() => cli?.scratch.remove());

function setup(body: string): { adapter: ClaudeAdapter; cli: FakeCli } {
  const fake = createFakeCli('claude', body);
  cli = fake;
  return { adapter: new ClaudeAdapter({ binary: fake.binary }), cli: fake };
}

const input = (fake: FakeCli) => ({ ...RUN_INPUT, cwd: fake.cwd });

test('cancel(): iterator ends without terminal event and the child group is killed', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\n${HANG}`);
  const events = await collect(adapter.start(input(cli)), async (event) => {
    if (event.type === 'started') await adapter.cancel('run-1');
  });
  expect(types(events)).toEqual(['started']);
  expect(isProcessAlive(readPid(cli))).toBe(false);
  await adapter.cancel('run-1');
});

test('input.signal abort: ends without terminal event, child killed, listener removed', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\n${HANG}`);
  const controller = new AbortController();
  const events = await collect(
    adapter.start({ ...input(cli), signal: controller.signal }),
    (event) => {
      if (event.type === 'started') controller.abort();
    },
  );
  expect(types(events)).toEqual(['started']);
  expect(isProcessAlive(readPid(cli))).toBe(false);
});

test('pre-aborted signal: no spawn, no events', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'`);
  expect(await collect(adapter.start({ ...input(cli), signal: AbortSignal.abort() }))).toEqual([]);
  expect(await Bun.file(cli.argvFile).exists()).toBe(false);
});

test('abort after completion does not cancel a new run with the same runId', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${RESULT}'`);
  const controller = new AbortController();
  await collect(adapter.start({ ...input(cli), signal: controller.signal }));
  const second = adapter.start(input(cli));
  controller.abort();
  expect(types(await collect(second))).toEqual(['started', 'usage', 'completed']);
});

test('duplicate active runId throws; runId is free again after the run ends', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${RESULT}'`);
  const first = adapter.start(input(cli));
  expect(() => adapter.start(input(cli))).toThrow('Run run-1 is already active');
  await collect(first);
  expect(types(await collect(adapter.start(input(cli))))).toEqual([
    'started',
    'usage',
    'completed',
  ]);
});

test('answerPermission: records once, unknown and repeated ids throw, run continues', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${DENIED}'\necho '${RESULT}'`);
  const errors: string[] = [];
  const events = await collect(adapter.start(input(cli)), async (event) => {
    if (event.type !== 'permission_request') return;
    await adapter.answerPermission('run-1', 'p1', 'deny');
    for (const [run, id] of [
      ['run-1', 'p1'],
      ['run-1', 'zz'],
      ['other', 'p1'],
    ] as const) {
      errors.push(await adapter.answerPermission(run, id, 'allow').then(() => '', String));
    }
  });
  expect(types(events)).toEqual(['started', 'permission_request', 'usage', 'completed']);
  expect(errors).toEqual([
    'Error: No pending permission p1 for run run-1',
    'Error: No pending permission zz for run run-1',
    'Error: No pending permission p1 for run other',
  ]);
});

test('answerPermission after the run ended is rejected', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${DENIED}'\necho '${RESULT}'`);
  await collect(adapter.start(input(cli)));
  await expect(adapter.answerPermission('run-1', 'p1', 'allow')).rejects.toThrow(
    'No pending permission p1 for run run-1',
  );
});

test('terminal event: a still-pending permission is rejected while the iterator is suspended', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${DENIED}'\necho '${RESULT}'`);
  let lateError = '';
  await collect(adapter.start(input(cli)), async (event) => {
    if (event.type !== 'completed') return;
    lateError = await adapter.answerPermission('run-1', 'p1', 'allow').then(() => 'none', String);
  });
  expect(lateError).toBe('Error: No pending permission p1 for run run-1');
});

test('cancel() frees the runId at once, before the old iterator drains', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${RESULT}'`);
  let second: ReturnType<ClaudeAdapter['start']> | undefined;
  await collect(adapter.start(input(cli)), async (event) => {
    if (event.type !== 'started' || second !== undefined) return;
    await adapter.cancel('run-1');
    second = adapter.start(input(cli));
  });
  if (second === undefined) throw new Error('second run never started');
  expect(types(await collect(second))).toEqual(['started', 'usage', 'completed']);
});

test('abort listener is removed when the run ends', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${RESULT}'`);
  const controller = new AbortController();
  const added = spyOn(controller.signal, 'addEventListener');
  const removed = spyOn(controller.signal, 'removeEventListener');
  await collect(adapter.start({ ...input(cli), signal: controller.signal }));
  expect(added).toHaveBeenCalledTimes(1);
  expect(removed).toHaveBeenCalledTimes(1);
  expect(removed.mock.calls[0]?.[1]).toBe(added.mock.calls[0]?.[1]);
});

test('malformed and blank stdout lines are skipped, not fatal', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho ''\necho '{oops'\necho '${RESULT}'`);
  expect(types(await collect(adapter.start(input(cli))))).toEqual([
    'started',
    'usage',
    'completed',
  ]);
});

test('completed run: child left running after the result is killed by the grace period', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'\necho '${RESULT}'\nexec ${HANG}`);
  const started = Date.now();
  const events = await collect(adapter.start(input(cli)), undefined, 5000);
  expect(types(events)).toEqual(['started', 'usage', 'completed']);
  expect(isProcessAlive(readPid(cli))).toBe(false);
  expect(Date.now() - started).toBeLessThan(4000);
});

test('invalid cwd -> single failed event', async () => {
  const { adapter, cli } = setup(`echo '${INIT}'`);
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: join(cli.cwd, 'nope') }));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: 'failed',
    error: expect.stringContaining('claude run failed'),
  });
});
