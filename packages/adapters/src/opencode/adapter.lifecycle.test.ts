import { afterEach, expect, test } from 'bun:test';
import { OpencodeAdapter } from './adapter';
import { buildServerConfig } from './config';
import type { LaunchServerOptions } from './server';
import { collect, RUN_INPUT, types } from './test-support/collect';
import { permissionAsked, SESSION_ID, sessionIdle } from './test-support/events';
import { type FixtureServer, startFixtureServer } from './test-support/fixture-server';

let fixture: FixtureServer | undefined;
afterEach(() => fixture?.stop());

interface LaunchSpy {
  readonly calls: LaunchServerOptions[];
  closes: number;
  failNext: boolean;
  launch(options: LaunchServerOptions): Promise<{ url: string; close(): Promise<void> }>;
}

function launchSpy(url: string): LaunchSpy {
  const spy: LaunchSpy = {
    calls: [],
    closes: 0,
    failNext: false,
    async launch(options) {
      spy.calls.push(options);
      if (spy.failNext) {
        spy.failNext = false;
        throw new Error('opencode server exited with code 3');
      }
      return { url, close: async () => void spy.closes++ };
    },
  };
  return spy;
}

test('server is launched lazily once, with sandbox config + env, shared by runs, closed by dispose', async () => {
  fixture = startFixtureServer({ script: [sessionIdle()] });
  const spy = launchSpy(fixture.url);
  const env = { OPENAI_API_KEY: 'k' };
  const adapter = new OpencodeAdapter({
    launch: spy.launch,
    env,
    serverCwd: '/srv',
    agentName: 'worker',
  });
  expect(spy.calls).toHaveLength(0);
  await collect(adapter.start(RUN_INPUT));
  await collect(adapter.start({ ...RUN_INPUT, runId: 'run-2' }));
  expect(await adapter.healthcheck()).toBeString();
  expect(spy.calls).toHaveLength(1);
  expect<unknown>(spy.calls[0]).toEqual({ cwd: '/srv', config: buildServerConfig('worker'), env });
  const prompt = await fixture.waitForRequest(`/session/${SESSION_ID}/prompt_async`);
  expect(prompt.body).toMatchObject({ agent: 'worker' });
  await adapter.dispose();
  await adapter.dispose();
  expect(spy.closes).toBe(1);
});

test('failed launch -> failed event naming the cause; next run retries the launch', async () => {
  fixture = startFixtureServer({ script: [sessionIdle()] });
  const spy = launchSpy(fixture.url);
  spy.failNext = true;
  const adapter = new OpencodeAdapter({ launch: spy.launch });
  const events = await collect(adapter.start(RUN_INPUT));
  expect<unknown>(events).toEqual([
    {
      type: 'failed',
      error: 'opencode server failed to start: opencode server exited with code 3',
    },
  ]);
  expect(types(await collect(adapter.start(RUN_INPUT)))).toEqual(['started', 'completed']);
  expect(spy.calls).toHaveLength(2);
});

test('pre-aborted run never launches a server', async () => {
  const spy = launchSpy('http://127.0.0.1:1');
  const adapter = new OpencodeAdapter({ launch: spy.launch });
  expect(await collect(adapter.start({ ...RUN_INPUT, signal: AbortSignal.abort() }))).toEqual([]);
  expect(spy.calls).toHaveLength(0);
});

test('dispose() cancels active runs: iterator ends, session aborted, server closed', async () => {
  fixture = startFixtureServer({ script: [permissionAsked('per_1'), { awaitReply: 'never' }] });
  const spy = launchSpy(fixture.url);
  const adapter = new OpencodeAdapter({ launch: spy.launch });
  const events = await collect(adapter.start(RUN_INPUT), async (event) => {
    if (event.type === 'permission_request') await adapter.dispose();
  });
  expect(types(events)).toEqual(['started', 'permission_request']);
  await fixture.waitForRequest(`/session/${SESSION_ID}/abort`);
  expect(spy.closes).toBe(1);
});

test('permission reply failure fails the run closed and rethrows', async () => {
  fixture = startFixtureServer({ script: [permissionAsked('per_1'), { awaitReply: 'never' }] });
  const live = fixture;
  const adapter = new OpencodeAdapter({ baseUrl: live.url });
  let replyError: unknown;
  const events = await collect(adapter.start(RUN_INPUT), async (event) => {
    if (event.type !== 'permission_request') return;
    live.stop();
    replyError = await adapter
      .answerPermission('run-1', 'per_1', 'allow')
      .catch((error: unknown) => error);
  });
  expect(String(replyError)).toContain('opencode permission reply failed');
  expect(types(events)).toEqual(['started', 'permission_request', 'failed']);
  expect(events.at(-1)).toMatchObject({
    error: expect.stringContaining('permission reply failed'),
  });
});

test('cancel never throws when the session abort request fails', async () => {
  fixture = startFixtureServer({ script: [permissionAsked('per_1'), { awaitReply: 'never' }] });
  const live = fixture;
  const adapter = new OpencodeAdapter({ baseUrl: live.url });
  const events = await collect(adapter.start(RUN_INPUT), async (event) => {
    if (event.type !== 'permission_request') return;
    live.stop();
    await adapter.cancel('run-1');
  });
  expect(types(events)).toEqual(['started', 'permission_request']);
});
