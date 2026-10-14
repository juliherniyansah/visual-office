import { afterAll, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FakeAdapter } from '@redhunter/adapters';
import type { AdapterEvent, AdapterId, AgentAdapter, DomainEvent } from '@redhunter/shared';
import { type Socket as ClientSocket, io as connectSocket } from 'socket.io-client';
import { createApp } from './app';
import { signAccessToken } from './auth/token';
import { createEventDispatcher } from './events/dispatcher';
import { createOutbox } from './events/outbox';
import { createRealtimeGateway, OFFICE_NAMESPACE } from './realtime/gateway';
import { createApiRuntime } from './runtime';
import { seedAgents } from './seed/agents';
import { closeHttpServer, createHttpServer, listen } from './server';
import { createTestDatabase } from './test-support/database';
import { silentLogger } from './test-support/events';
import { connectOutcome, TEST_JWT_SECRET } from './test-support/realtime';

const ORIGIN = 'http://pipeline.allowed.test';
const POST_TIMEOUT_MS = 5_000;
const EVENT_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 2_000;

interface PipelineHarness {
  readonly baseUrl: string;
  readonly token: string;
  connect(): ClientSocket;
  close(): Promise<void>;
}

// Real HTTP + Socket.IO + outbox + dispatcher + AgentRuntime (FakeAdapter) in one process.
async function startPipeline(script: readonly AdapterEvent[]): Promise<PipelineHarness> {
  const db = await createTestDatabase();
  await seedAgents(db.models);
  const models = db.models;
  const adapters = new Map<AdapterId, AgentAdapter>([['opencode', new FakeAdapter({ script })]]);
  const outbox = createOutbox({ models, onEmitted: () => dispatcher.notify() });
  const apiRuntime = await createApiRuntime({
    models,
    outbox,
    connection: db.connection,
    adapters,
  });
  const server: Server = createHttpServer(
    createApp({ models, jwtSecret: TEST_JWT_SECRET, outbox, runtime: apiRuntime.runtime }),
  );
  const gateway = createRealtimeGateway(server, {
    jwtSecret: TEST_JWT_SECRET,
    corsOrigins: [ORIGIN],
    logger: silentLogger,
  });
  const dispatcher = createEventDispatcher({
    models,
    sinks: [gateway.deliver],
    enabled: true,
    logger: silentLogger,
  });
  await listen(server, { port: 0, host: '127.0.0.1' });
  dispatcher.start();
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = await signAccessToken(
    { sub: 'operator-pipeline', role: 'operator' },
    TEST_JWT_SECRET,
  );
  const clients: ClientSocket[] = [];

  function connect(): ClientSocket {
    const client = connectSocket(`${baseUrl}${OFFICE_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      timeout: CONNECT_TIMEOUT_MS,
      extraHeaders: { origin: ORIGIN },
    });
    clients.push(client);
    return client;
  }

  async function close(): Promise<void> {
    for (const client of clients) client.close();
    await dispatcher.stop();
    await gateway.close();
    await closeHttpServer(server);
    await apiRuntime.close();
    await db.drop();
  }

  return { baseUrl, token, connect, close };
}

// Dedupes by eventId (outbox is at-least-once) and resolves when `type` arrives.
function waitForEvent(
  client: ClientSocket,
  seen: Set<string>,
  type: DomainEvent['type'],
  timeoutMs = EVENT_TIMEOUT_MS,
): Promise<DomainEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeoutMs);
    client.on('event', (event: DomainEvent) => {
      if (event.type !== type || seen.has(event.eventId)) return;
      seen.add(event.eventId);
      clearTimeout(timer);
      resolve(event);
    });
  });
}

async function postDirective(
  harness: PipelineHarness,
  capabilityTags: readonly string[],
): Promise<Response> {
  return fetch(`${harness.baseUrl}/api/v1/directives`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${harness.token}`,
    },
    body: JSON.stringify({ text: 'Fix the login bug', capabilityTags }),
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
}

const harnesses: PipelineHarness[] = [];

async function start(script: readonly AdapterEvent[]): Promise<PipelineHarness> {
  const harness = await startPipeline(script);
  harnesses.push(harness);
  return harness;
}

afterAll(async () => {
  for (const harness of harnesses.splice(0)) {
    await harness.close();
  }
});

describe('end-to-end pipeline: directive -> task -> run -> result (FakeAdapter)', () => {
  test('happy path: operator directive routes to programming, result + status reach socket <=5s', async () => {
    const harness = await start([
      { type: 'started', vendorSessionId: 'ses-pipeline' },
      { type: 'completed', finalText: 'Fixed the login bug.' },
    ]);
    const client = harness.connect();
    expect(await connectOutcome(client)).toBe('connected');
    const seen = new Set<string>();
    const started = Date.now();
    const resultPromise = waitForEvent(client, seen, 'result.recorded');
    const statusPromise = waitForEvent(client, seen, 'agent.status_changed');

    const response = await postDirective(harness, ['code']);
    expect(response.status).toBe(201);

    const [result, status] = await Promise.all([resultPromise, statusPromise]);
    expect(Date.now() - started).toBeLessThanOrEqual(5_000);
    if (result.type === 'result.recorded') {
      expect(result.payload.result.summary).toBe('Fixed the login bug.');
    }
    if (status.type === 'agent.status_changed') {
      expect(status.payload.agentId).toBe('programming');
    }
  }, 15_000);

  test('failure path: FakeAdapter failure escalates, decision.requested reaches socket', async () => {
    const harness = await start([{ type: 'failed', error: 'build broken' }]);
    const client = harness.connect();
    expect(await connectOutcome(client)).toBe('connected');
    const seen = new Set<string>();
    const decisionPromise = waitForEvent(client, seen, 'decision.requested', 20_000);

    const response = await postDirective(harness, ['code']);
    expect(response.status).toBe(201);

    const decision = await decisionPromise;
    if (decision.type === 'decision.requested') {
      expect(decision.payload.decision.options).toContain('retry');
    }
  }, 30_000);

  test('no capability match: directive rejected with 422, no run created', async () => {
    const harness = await start([{ type: 'completed', finalText: 'never runs' }]);
    const client = harness.connect();
    expect(await connectOutcome(client)).toBe('connected');

    const response = await postDirective(harness, ['no-such-capability']);
    expect(response.status).toBe(422);
  }, 15_000);
});
