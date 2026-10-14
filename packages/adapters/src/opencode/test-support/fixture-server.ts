import { type RawEvent, SESSION_ID, serverConnected } from './events';

// Step `awaitReply` pauses the script until POST /session/:id/permissions/<id> arrives;
// `closeStream` ends every open SSE stream. The script starts once prompt_async is received.
export type FixtureStep =
  | RawEvent
  | { readonly awaitReply: string }
  | { readonly closeStream: true };

export interface FixtureOptions {
  readonly script?: readonly FixtureStep[];
  readonly eventStatus?: number;
  readonly promptStatus?: number;
  readonly version?: string;
}

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly directory: string | undefined;
  readonly body: unknown;
}

export interface SseCounts {
  readonly opened: number;
  // Client side only (fetch aborted / body cancelled); a script `closeStream` does not count.
  readonly closedByClient: number;
}

export interface FixtureServer {
  readonly url: string;
  readonly requests: RecordedRequest[];
  sseCounts(): SseCounts;
  waitForRequest(path: string, timeoutMs?: number): Promise<RecordedRequest>;
  // Resolves once every SSE connection opened so far was closed by the client.
  waitForClientClose(timeoutMs?: number): Promise<SseCounts>;
  stop(): void;
}

export const FIXTURE_VERSION = '9.9.9-fixture';
const PERMISSION_ROUTE = /^\/session\/[^/]+\/permissions\/([^/]+)$/;
const encoder = new TextEncoder();

export function startFixtureServer(options: FixtureOptions = {}): FixtureServer {
  const requests: RecordedRequest[] = [];
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const sse = { opened: 0, closedByClient: 0 };
  const replies = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  const waiters = new Set<() => void>();
  const replyFor = (id: string): ReturnType<typeof Promise.withResolvers<void>> => {
    const existing = replies.get(id) ?? Promise.withResolvers<void>();
    replies.set(id, existing);
    return existing;
  };
  const send = (event: unknown): void => {
    for (const stream of streams)
      stream.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  const closeStreams = (): void => {
    const open = [...streams];
    streams.clear();
    for (const stream of open) stream.close();
  };
  const runScript = async (): Promise<void> => {
    for (const step of options.script ?? []) {
      if ('awaitReply' in step) await replyFor(step.awaitReply).promise;
      else if ('closeStream' in step) closeStreams();
      else send(step);
    }
  };

  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    idleTimeout: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const text = request.method === 'GET' ? '' : await request.text();
      const header = request.headers.get('x-opencode-directory');
      requests.push({
        method: request.method,
        path: url.pathname,
        directory:
          url.searchParams.get('directory') ??
          (header === null ? undefined : decodeURIComponent(header)),
        body: text === '' ? undefined : JSON.parse(text),
      });
      wakeWaiters();
      return route(request.method, url.pathname);
    },
  });

  function route(method: string, path: string): Response {
    if (method === 'GET' && path === '/global/health') {
      return Response.json({ healthy: true, version: options.version ?? FIXTURE_VERSION });
    }
    if (method === 'GET' && path === '/event') return openStream();
    if (method === 'POST' && path === '/session') {
      return Response.json({ id: SESSION_ID, title: 'fixture', version: FIXTURE_VERSION });
    }
    if (method === 'POST' && path.endsWith('/prompt_async')) {
      const status = options.promptStatus ?? 204;
      if (status === 204) void runScript();
      return status === 204
        ? new Response(null, { status })
        : Response.json({ name: 'BadRequest' }, { status });
    }
    const permissionId = PERMISSION_ROUTE.exec(path)?.[1];
    if (method === 'POST' && permissionId !== undefined) {
      replyFor(permissionId).resolve();
      return Response.json(true);
    }
    if (method === 'POST' && path.endsWith('/abort')) return Response.json(true);
    return new Response('not found', { status: 404 });
  }

  function openStream(): Response {
    if (options.eventStatus !== undefined)
      return new Response('boom', { status: options.eventStatus });
    let own: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        own = controller;
        streams.add(controller);
        sse.opened++;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(serverConnected())}\n\n`));
      },
      // Bun calls cancel() when the client drops the connection, never after controller.close().
      cancel() {
        if (own !== undefined) streams.delete(own);
        sse.closedByClient++;
        wakeWaiters();
      },
    });
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
  }

  function wakeWaiters(): void {
    for (const wake of [...waiters]) wake();
  }

  // Bounded so a missing request/close fails the test fast instead of hanging it.
  async function waitUntil<T>(
    check: () => T | undefined,
    failure: string,
    timeoutMs: number,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = check();
      if (found !== undefined) return found;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(failure);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, left);
        function done(): void {
          clearTimeout(timer);
          waiters.delete(done);
          resolve();
        }
        waiters.add(done);
      });
    }
  }

  const sseCounts = (): SseCounts => ({ ...sse });

  return {
    url: `http://127.0.0.1:${server.port}`,
    requests,
    sseCounts,
    waitForRequest: (path, timeoutMs = 1000) =>
      waitUntil(
        () => requests.find((request) => request.path === path),
        `Fixture never received ${path}`,
        timeoutMs,
      ),
    waitForClientClose: (timeoutMs = 1000) =>
      waitUntil(
        () => (sse.opened > 0 && sse.closedByClient === sse.opened ? sseCounts() : undefined),
        `SSE not closed by client: ${JSON.stringify(sse)}`,
        timeoutMs,
      ),
    stop: () => {
      closeStreams();
      void server.stop(true);
    },
  };
}

// URL of a port that was just released: connections are refused.
export function deadServerUrl(): string {
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
  const url = `http://127.0.0.1:${server.port}`;
  void server.stop(true);
  return url;
}
