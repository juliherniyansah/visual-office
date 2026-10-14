import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DomainEvent } from '@redhunter/shared';
import { type Socket as ClientSocket, io as connectSocket } from 'socket.io-client';
import { createApp } from '../app';
import { createEventDispatcher, type EventDispatcher } from '../events/dispatcher';
import { createOutbox, type Outbox } from '../events/outbox';
import { createRealtimeGateway, type GatewayOptions, OFFICE_NAMESPACE } from '../realtime/gateway';
import { closeHttpServer, createHttpServer, listen } from '../server';
import type { TestDatabase } from './database';
import { silentLogger } from './events';

export const TEST_JWT_SECRET = 'realtime-test-secret-0123456789abcd';
export const ALLOWED_ORIGIN = 'http://office.allowed.test';
export const FOREIGN_ORIGIN = 'http://evil.foreign.test';
const CONNECT_TIMEOUT_MS = 2_000;

export interface Harness {
  readonly baseUrl: string;
  readonly outbox: Outbox;
  readonly dispatcher: EventDispatcher;
  readonly gateway: ReturnType<typeof createRealtimeGateway>;
  connect(options?: ConnectOptions): ClientSocket;
  close(): Promise<void>;
}

export interface HarnessOptions {
  readonly dispatchEnabled?: boolean;
  readonly canSubscribeRun?: GatewayOptions['canSubscribeRun'];
}

export interface ConnectOptions {
  readonly token?: unknown;
  readonly origin?: string;
  readonly transport?: 'websocket' | 'polling';
  readonly namespace?: string;
  readonly reconnection?: boolean;
}

export async function startHarness(
  db: TestDatabase,
  options: HarnessOptions = {},
): Promise<Harness> {
  const outbox = createOutbox({ models: db.models, onEmitted: () => dispatcher.notify() });
  const server: Server = createHttpServer(
    createApp({ models: db.models, jwtSecret: TEST_JWT_SECRET, outbox }),
  );
  const gateway = createRealtimeGateway(server, {
    jwtSecret: TEST_JWT_SECRET,
    corsOrigins: [ALLOWED_ORIGIN],
    logger: silentLogger,
    ...(options.canSubscribeRun === undefined ? {} : { canSubscribeRun: options.canSubscribeRun }),
  });
  const dispatcher = createEventDispatcher({
    models: db.models,
    sinks: [gateway.deliver],
    enabled: options.dispatchEnabled ?? true,
    logger: silentLogger,
  });
  await listen(server, { port: 0, host: '127.0.0.1' });
  dispatcher.start();
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const clients: ClientSocket[] = [];

  function connect(connectOptions: ConnectOptions = {}): ClientSocket {
    const client = connectSocket(`${baseUrl}${connectOptions.namespace ?? OFFICE_NAMESPACE}`, {
      auth: connectOptions.token === undefined ? {} : { token: connectOptions.token },
      transports: [connectOptions.transport ?? 'websocket'],
      reconnection: connectOptions.reconnection ?? false,
      forceNew: true,
      timeout: CONNECT_TIMEOUT_MS,
      extraHeaders: { origin: connectOptions.origin ?? ALLOWED_ORIGIN },
    });
    clients.push(client);
    return client;
  }

  async function close(): Promise<void> {
    for (const client of clients) {
      client.close();
    }
    await dispatcher.stop();
    await gateway.close();
    await closeHttpServer(server);
  }

  return { baseUrl, outbox, dispatcher, gateway, connect, close };
}

// Resolves 'connected' or the connect_error message; never hangs.
export function connectOutcome(client: ClientSocket): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), CONNECT_TIMEOUT_MS + 500);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve('connected');
    });
    client.once('connect_error', (err: Error) => {
      clearTimeout(timer);
      resolve(`connect_error:${err.message}`);
    });
  });
}

export function collectEvents(client: ClientSocket): DomainEvent[] {
  const received: DomainEvent[] = [];
  client.on('event', (event: DomainEvent) => received.push(event));
  return received;
}
