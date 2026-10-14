import { afterEach, describe, expect, test } from 'bun:test';
import { OpencodeAdapter } from './adapter';
import { collect, RUN_INPUT, types } from './test-support/collect';
import {
  happyScript,
  permissionAsked,
  SESSION_ID,
  sessionError,
  sessionIdle,
} from './test-support/events';
import {
  deadServerUrl,
  FIXTURE_VERSION,
  type FixtureOptions,
  type FixtureServer,
  startFixtureServer,
} from './test-support/fixture-server';

let fixture: FixtureServer | undefined;
afterEach(() => fixture?.stop());

function adapterFor(options: FixtureOptions): OpencodeAdapter {
  fixture = startFixtureServer(options);
  return new OpencodeAdapter({ baseUrl: fixture.url });
}

function requireFixture(): FixtureServer {
  if (fixture === undefined) throw new Error('fixture not started');
  return fixture;
}

describe('start', () => {
  test('fixture SSE run -> normalized sequence; session, prompt and directory sent', async () => {
    const adapter = adapterFor({ script: happyScript() });
    const events = await collect(adapter.start(RUN_INPUT));
    expect(types(events)).toEqual([
      'started',
      'tool:started',
      'tool:completed',
      'file_change',
      'text',
      'text',
      'usage',
      'completed',
    ]);
    expect<unknown>(events[0]).toEqual({ type: 'started', vendorSessionId: SESSION_ID });
    expect<unknown>(events.at(-1)).toEqual({ type: 'completed', finalText: 'hello' });
    const prompt = await requireFixture().waitForRequest(`/session/${SESSION_ID}/prompt_async`);
    expect<unknown>(prompt.body).toEqual({
      agent: 'build',
      parts: [{ type: 'text', text: 'say hello' }],
    });
    expect(prompt.directory).toBe('/tmp');
    expect((await requireFixture().waitForRequest('/session')).directory).toBe('/tmp');
  });

  test('session.error -> failed, iterator ends', async () => {
    const error = { name: 'ProviderAuthError', data: { providerID: 'x', message: 'no key' } };
    const adapter = adapterFor({ script: [sessionError(error), sessionIdle()] });
    const events = await collect(adapter.start(RUN_INPUT));
    expect<unknown>(events.slice(1)).toEqual([
      { type: 'failed', error: 'ProviderAuthError: no key' },
    ]);
  });

  test('stream closed before a terminal event -> failed', async () => {
    const adapter = adapterFor({ script: [{ closeStream: true }] });
    const events = await collect(adapter.start(RUN_INPUT));
    expect(types(events)).toEqual(['started', 'failed']);
    expect(events[1]).toMatchObject({ error: expect.stringContaining('event stream ended') });
  });

  test('server unreachable -> single failed event with error text, never throws', async () => {
    const adapter = new OpencodeAdapter({ baseUrl: deadServerUrl() });
    const events = await collect(adapter.start(RUN_INPUT));
    expect(types(events)).toEqual(['failed']);
    const [failure] = events;
    expect(failure?.type === 'failed' ? failure.error : '').toStartWith(
      'opencode session.create failed: ',
    );
  });

  test('event stream HTTP error -> failed', async () => {
    const adapter = adapterFor({ eventStatus: 500 });
    const events = await collect(adapter.start(RUN_INPUT));
    expect(types(events)).toEqual(['failed']);
    expect(events[0]).toMatchObject({ error: expect.stringContaining('500') });
  });

  test('prompt_async rejected -> started then failed', async () => {
    const adapter = adapterFor({ promptStatus: 400 });
    const events = await collect(adapter.start(RUN_INPUT));
    expect(types(events)).toEqual(['started', 'failed']);
  });

  test('duplicate active runId throws; runId is reusable after the run ends', async () => {
    const adapter = adapterFor({ script: [sessionIdle()] });
    const first = adapter.start(RUN_INPUT);
    expect(() => adapter.start(RUN_INPUT)).toThrow('Run run-1 is already active');
    await collect(first);
    await collect(adapter.start(RUN_INPUT));
  });
});

describe('answerPermission', () => {
  const permissionScript = [permissionAsked('per_1'), { awaitReply: 'per_1' }, sessionIdle()];

  test('allow -> POST permissions route with once, run continues', async () => {
    const adapter = adapterFor({ script: permissionScript });
    const events = await collect(adapter.start(RUN_INPUT), async (event) => {
      if (event.type === 'permission_request')
        await adapter.answerPermission('run-1', event.permissionId, 'allow');
    });
    expect(types(events)).toEqual(['started', 'permission_request', 'completed']);
    const reply = await requireFixture().waitForRequest(`/session/${SESSION_ID}/permissions/per_1`);
    expect(reply.method).toBe('POST');
    expect<unknown>(reply.body).toEqual({ response: 'once' });
  });

  test('deny -> reject sent, then failed "Permission <id> denied" and the session is aborted', async () => {
    const adapter = adapterFor({ script: permissionScript });
    const events = await collect(adapter.start(RUN_INPUT), async (event) => {
      if (event.type === 'permission_request')
        await adapter.answerPermission('run-1', event.permissionId, 'deny');
    });
    expect<unknown>(events.slice(1)).toEqual([
      { type: 'permission_request', permissionId: 'per_1', tool: 'bash', detail: 'echo hello' },
      { type: 'failed', error: 'Permission per_1 denied' },
    ]);
    const reply = await requireFixture().waitForRequest(`/session/${SESSION_ID}/permissions/per_1`);
    expect<unknown>(reply.body).toEqual({ response: 'reject' });
    await requireFixture().waitForRequest(`/session/${SESSION_ID}/abort`);
  });

  test('a pending permission is dropped once the run fails, even before the iterator drains', async () => {
    const error = { name: 'UnknownError', data: { message: 'x' } };
    const adapter = adapterFor({ script: [permissionAsked('per_1'), sessionError(error)] });
    const iterator = adapter.start(RUN_INPUT)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toMatchObject({ type: 'started' });
    expect((await iterator.next()).value).toMatchObject({ type: 'permission_request' });
    expect((await iterator.next()).value).toMatchObject({ type: 'failed' });
    // Generator suspended at its last yield: cleanup has not run, the run is still registered.
    expect(() => adapter.start(RUN_INPUT)).toThrow('already active');
    await expect(adapter.answerPermission('run-1', 'per_1', 'allow')).rejects.toThrow(
      'No pending permission per_1 for run run-1',
    );
    expect((await iterator.next()).done).toBe(true);
    expect(requireFixture().requests.filter((r) => r.path.includes('/permissions/'))).toEqual([]);
  });

  test('unknown run, unknown id and duplicate answers throw', async () => {
    const adapter = adapterFor({ script: permissionScript });
    const message = (id: string, run = 'run-1') => `No pending permission ${id} for run ${run}`;
    await expect(adapter.answerPermission('nope', 'per_1', 'allow')).rejects.toThrow(
      message('per_1', 'nope'),
    );
    await collect(adapter.start(RUN_INPUT), async (event) => {
      if (event.type !== 'permission_request') return;
      await expect(adapter.answerPermission('run-1', 'per_x', 'allow')).rejects.toThrow(
        message('per_x'),
      );
      await adapter.answerPermission('run-1', 'per_1', 'allow');
      await expect(adapter.answerPermission('run-1', 'per_1', 'allow')).rejects.toThrow(
        message('per_1'),
      );
    });
    const replies = requireFixture().requests.filter((r) => r.path.includes('/permissions/'));
    expect(replies).toHaveLength(1);
  });
});

describe('cancel', () => {
  const blocked = [permissionAsked('per_1'), { awaitReply: 'never' }];

  test('cancel(runId) aborts the session and ends the iterator without a terminal event', async () => {
    const adapter = adapterFor({ script: blocked });
    const events = await collect(adapter.start(RUN_INPUT), async (event) => {
      if (event.type === 'permission_request') await adapter.cancel('run-1');
    });
    expect(types(events)).toEqual(['started', 'permission_request']);
    await requireFixture().waitForRequest(`/session/${SESSION_ID}/abort`);
    await expect(adapter.answerPermission('run-1', 'per_1', 'allow')).rejects.toThrow(
      'No pending permission',
    );
  });

  test('input.signal abort behaves like cancel; pre-aborted signal yields nothing', async () => {
    const adapter = adapterFor({ script: blocked });
    const controller = new AbortController();
    const events = await collect(
      adapter.start({ ...RUN_INPUT, signal: controller.signal }),
      (event) => {
        if (event.type === 'permission_request') controller.abort();
      },
    );
    expect(types(events)).toEqual(['started', 'permission_request']);
    await requireFixture().waitForRequest(`/session/${SESSION_ID}/abort`);
    const aborted = AbortSignal.abort();
    expect(await collect(adapter.start({ ...RUN_INPUT, runId: 'run-2', signal: aborted }))).toEqual(
      [],
    );
  });

  test('cancel frees the runId at once (FakeAdapter parity), before the old iterator drains', async () => {
    const adapter = adapterFor({ script: blocked });
    const first = adapter.start(RUN_INPUT);
    await adapter.cancel('run-1');
    const second = adapter.start(RUN_INPUT);
    expect(await collect(first)).toEqual([]);
    // The old iterator's cleanup must not unregister the new run.
    await adapter.cancel('run-1');
    expect(await collect(second)).toEqual([]);
    const pre = adapter.start({ ...RUN_INPUT, runId: 'run-3', signal: AbortSignal.abort() });
    adapter.start({ ...RUN_INPUT, runId: 'run-3' });
    expect(await collect(pre)).toEqual([]);
  });

  test('cancel of an unknown run is a no-op', async () => {
    const adapter = adapterFor({});
    await adapter.cancel('nope');
    expect(requireFixture().requests).toEqual([]);
  });
});

describe('healthcheck', () => {
  test('returns the server version string', async () => {
    const adapter = adapterFor({});
    expect(await adapter.healthcheck()).toBe(FIXTURE_VERSION);
  });

  test('unreachable server rejects with a clear error', async () => {
    const adapter = new OpencodeAdapter({ baseUrl: deadServerUrl() });
    await expect(adapter.healthcheck()).rejects.toThrow('opencode healthcheck failed');
  });

  test('empty version rejects', async () => {
    const adapter = adapterFor({ version: '' });
    await expect(adapter.healthcheck()).rejects.toThrow('opencode healthcheck failed');
  });
});

test('id is opencode', () => {
  expect(new OpencodeAdapter({ baseUrl: 'http://127.0.0.1:1' }).id).toBe('opencode');
});
