import { afterEach, expect, test } from 'bun:test';
import { OpencodeAdapter } from './adapter';
import { collect, RUN_INPUT, types } from './test-support/collect';
import { permissionAsked, SESSION_ID, sessionError, sessionIdle } from './test-support/events';
import {
  type FixtureOptions,
  type FixtureServer,
  startFixtureServer,
} from './test-support/fixture-server';

const ABORT_PATH = `/session/${SESSION_ID}/abort`;
// Batas tunggu untuk asersi "request TIDAK datang"; localhost menjawab jauh di bawah ini.
const NO_REQUEST_WAIT_MS = 50;

let fixture: FixtureServer | undefined;
afterEach(() => fixture?.stop());

function setup(options: FixtureOptions): { adapter: OpencodeAdapter; server: FixtureServer } {
  const server = startFixtureServer(options);
  fixture = server;
  return { adapter: new OpencodeAdapter({ baseUrl: server.url }), server };
}

function abortRequests(server: FixtureServer): number {
  return server.requests.filter((request) => request.path === ABORT_PATH).length;
}

async function expectNoAbortRequest(server: FixtureServer): Promise<void> {
  await expect(server.waitForRequest(ABORT_PATH, NO_REQUEST_WAIT_MS)).rejects.toThrow(
    `Fixture never received ${ABORT_PATH}`,
  );
}

test('completed run closes its SSE connection from the client side', async () => {
  const { adapter, server } = setup({ script: [sessionIdle()] });
  expect(types(await collect(adapter.start(RUN_INPUT)))).toEqual(['started', 'completed']);
  expect(await server.waitForClientClose()).toEqual({ opened: 1, closedByClient: 1 });
});

test('failed run (session.error) closes its SSE connection', async () => {
  const error = { name: 'UnknownError', data: { message: 'x' } };
  const { adapter, server } = setup({ script: [sessionError(error)] });
  expect(types(await collect(adapter.start(RUN_INPUT)))).toEqual(['started', 'failed']);
  expect(await server.waitForClientClose()).toEqual({ opened: 1, closedByClient: 1 });
});

test('cancelled run closes its SSE connection while a read is pending', async () => {
  const { adapter, server } = setup({
    script: [permissionAsked('per_1'), { awaitReply: 'never' }],
  });
  const events = await collect(adapter.start(RUN_INPUT), async (event) => {
    if (event.type === 'permission_request') await adapter.cancel('run-1');
  });
  expect(types(events)).toEqual(['started', 'permission_request']);
  expect(await server.waitForClientClose()).toEqual({ opened: 1, closedByClient: 1 });
});

test('normal completion never aborts the session', async () => {
  const { adapter, server } = setup({ script: [sessionIdle()] });
  await collect(adapter.start(RUN_INPUT));
  // The iterator awaits its cleanup, so any abort POST would already be recorded here.
  expect(abortRequests(server)).toBe(0);
  expect(server.requests.map((request) => `${request.method} ${request.path}`)).toEqual([
    'POST /session',
    'GET /event',
    `POST /session/${SESSION_ID}/prompt_async`,
  ]);
});

test('aborting the input signal after completion causes no session abort', async () => {
  const { adapter, server } = setup({ script: [sessionIdle()] });
  const controller = new AbortController();
  const events = await collect(adapter.start({ ...RUN_INPUT, signal: controller.signal }));
  expect(types(events)).toEqual(['started', 'completed']);
  controller.abort();
  await expectNoAbortRequest(server);
  expect(abortRequests(server)).toBe(0);
});

test('aborting the signal of a finished run does not cancel a new run with the same runId', async () => {
  const { adapter, server } = setup({ script: [sessionIdle()] });
  const controller = new AbortController();
  await collect(adapter.start({ ...RUN_INPUT, signal: controller.signal }));
  const second = adapter.start(RUN_INPUT);
  controller.abort();
  expect(types(await collect(second))).toEqual(['started', 'completed']);
  expect(abortRequests(server)).toBe(0);
});
