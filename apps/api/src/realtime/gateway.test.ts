import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { DomainEvent } from '@redhunter/shared';
import { SignJWT, UnsecuredJWT } from 'jose';
import type { Socket as ClientSocket } from 'socket.io-client';
import { JWT_AUDIENCE, JWT_ISSUER, signAccessToken } from '../auth/token';
import { createTestDatabase, type TestDatabase } from '../test-support/database';
import { agentStatusInput, runCompletedInput, waitUntil } from '../test-support/events';
import {
  collectEvents,
  connectOutcome,
  FOREIGN_ORIGIN,
  type Harness,
  type HarnessOptions,
  startHarness,
  TEST_JWT_SECRET,
} from '../test-support/realtime';

const USER_ID = '65f0c0ffee0000000000abcd';
const DELIVERY_BUDGET_MS = 500;

let db: TestDatabase;
let harness: Harness | undefined;

async function boot(options: HarnessOptions = {}): Promise<Harness> {
  harness = await startHarness(db, options);
  return harness;
}

function viewerToken(): Promise<string> {
  return signAccessToken({ sub: USER_ID, role: 'viewer' }, TEST_JWT_SECRET);
}

async function connected(h: Harness): Promise<ClientSocket> {
  const client = h.connect({ token: await viewerToken() });
  expect(await connectOutcome(client)).toBe('connected');
  return client;
}

function claimsBuilder(): SignJWT {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'owner' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(USER_ID)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 60);
}

const secretKey = new TextEncoder().encode(TEST_JWT_SECRET);

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.models.Event.deleteMany({});
});

afterEach(async () => {
  await harness?.close();
  harness = undefined;
});

describe('handshake authentication', () => {
  test('rejects a connection without a token with connect_error', async () => {
    const h = await boot();
    expect(await connectOutcome(h.connect())).toBe('connect_error:unauthorized');
  });

  test('rejects malformed, alg=none, expired, wrong-audience and non-string tokens', async () => {
    const h = await boot();
    const now = Math.floor(Date.now() / 1000);
    const badTokens: unknown[] = [
      'not-a-jwt',
      '',
      new UnsecuredJWT({ role: 'owner' })
        .setSubject(USER_ID)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(now + 60)
        .encode(),
      await claimsBuilder()
        .setIssuedAt(now - 7200)
        .setExpirationTime(now - 3600)
        .sign(secretKey),
      await claimsBuilder().setAudience('someone-else').sign(secretKey),
      await claimsBuilder().sign(new TextEncoder().encode('wrong-secret-0123456789abcdefghij')),
      12345,
      { token: 'nested' },
    ];
    for (const token of badTokens) {
      const outcome = await connectOutcome(h.connect({ token }));
      expect(outcome).toBe('connect_error:unauthorized');
    }
  });

  test('rejects connections to the default namespace even with a valid token', async () => {
    const h = await boot();
    const client = h.connect({ token: await viewerToken(), namespace: '/' });
    expect(await connectOutcome(client)).toBe('connect_error:unauthorized');
  });

  test('rejects a foreign Origin on websocket and polling transports', async () => {
    const h = await boot();
    const token = await viewerToken();
    for (const transport of ['websocket', 'polling'] as const) {
      const outcome = await connectOutcome(h.connect({ token, origin: FOREIGN_ORIGIN, transport }));
      expect(outcome).toStartWith('connect_error:');
    }
    const preflight = await fetch(`${h.baseUrl}/socket.io/?EIO=4&transport=polling`, {
      headers: { origin: FOREIGN_ORIGIN },
    });
    expect(preflight.status).toBe(403);
    expect(await connectOutcome(h.connect({ token, transport: 'polling' }))).toBe('connected');
  });
});

describe('delivery', () => {
  test(`emit() reaches a connected office client within ${DELIVERY_BUDGET_MS} ms`, async () => {
    const h = await boot();
    const client = await connected(h);
    const received = collectEvents(client);

    const started = Date.now();
    const event = await h.outbox.emit(agentStatusInput('cto'));
    await waitUntil(() => received.length === 1, DELIVERY_BUDGET_MS);
    expect(Date.now() - started).toBeLessThanOrEqual(DELIVERY_BUDGET_MS);
    expect(received[0]).toEqual(event);
  });

  test('EVENTS_DISPATCH=off stores the event but delivers nothing', async () => {
    const h = await boot({ dispatchEnabled: false });
    const client = await connected(h);
    const received = collectEvents(client);
    await h.outbox.emit(agentStatusInput());
    await Bun.sleep(400);
    expect(received).toHaveLength(0);
    expect(await db.models.Event.countDocuments({ dispatchedAt: null })).toBe(1);
  });

  test('connectionStateRecovery restores rooms and replays events missed during a short drop', async () => {
    const h = await boot();
    const client = h.connect({ token: await viewerToken(), reconnection: true });
    expect(await connectOutcome(client)).toBe('connected');
    const received = collectEvents(client);
    const before = await h.outbox.emit(agentStatusInput('ceo'));
    await waitUntil(() => received.length === 1);

    const reconnected = new Promise<void>((resolve) => client.once('connect', () => resolve()));
    client.io.engine.close();
    await waitUntil(() => !client.connected);
    const missed = await h.outbox.emit(agentStatusInput('coo'));
    await reconnected;

    expect(client.recovered).toBe(true);
    await waitUntil(() => received.length === 2);
    expect(received.map((event) => event.eventId)).toEqual([before.eventId, missed.eventId]);
  });
});

describe('room subscriptions', () => {
  test('subscribe:agent joins agent:<id> and only matching agent events arrive there', async () => {
    const h = await boot();
    const client = await connected(h);
    const scoped: DomainEvent[] = [];
    client.on('agent:event', (event: DomainEvent) => scoped.push(event));

    expect(await client.emitWithAck('subscribe:agent', 'cto')).toEqual({ ok: true });
    await h.outbox.emit(agentStatusInput('coo'));
    const match = await h.outbox.emit(agentStatusInput('cto'));
    await waitUntil(() => scoped.length === 1);
    await Bun.sleep(100);
    expect(scoped.map((event) => event.eventId)).toEqual([match.eventId]);

    expect(await client.emitWithAck('unsubscribe:agent', 'cto')).toEqual({ ok: true });
    await h.outbox.emit(agentStatusInput('cto'));
    await Bun.sleep(150);
    expect(scoped).toHaveLength(1);
  });

  test('subscribe:run joins run:<id> and receives run-scoped events', async () => {
    const h = await boot();
    const client = await connected(h);
    const scoped: DomainEvent[] = [];
    client.on('run:event', (event: DomainEvent) => scoped.push(event));

    expect(await client.emitWithAck('subscribe:run', 'run-42')).toEqual({ ok: true });
    await h.outbox.emit(runCompletedInput('run-7'));
    const match = await h.outbox.emit(runCompletedInput('run-42'));
    await waitUntil(() => scoped.length === 1);
    await Bun.sleep(100);
    expect(scoped.map((event) => event.eventId)).toEqual([match.eventId]);
  });

  test('canSubscribeRun=false denies the run room', async () => {
    const h = await boot({ canSubscribeRun: (runId) => runId !== 'secret-run' });
    const client = await connected(h);
    expect(await client.emitWithAck('subscribe:run', 'secret-run')).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await client.emitWithAck('subscribe:run', 'open-run')).toEqual({ ok: true });
  });

  test('invalid subscribe payloads are refused without dropping the connection', async () => {
    const h = await boot();
    const client = await connected(h);
    const badAgents: unknown[] = ['janitor', 42, null, { agentId: 'cto' }, ['cto'], ''];
    for (const payload of badAgents) {
      expect(await client.emitWithAck('subscribe:agent', payload)).toEqual({
        ok: false,
        error: 'invalid payload',
      });
    }
    for (const payload of [42, '', 'x'.repeat(200), { runId: 'r' }]) {
      expect(await client.emitWithAck('subscribe:run', payload)).toEqual({
        ok: false,
        error: 'invalid payload',
      });
    }
    client.emit('subscribe:agent', 'cto');
    client.emit('subscribe:run');
    expect(client.connected).toBe(true);
    const received = collectEvents(client);
    await h.outbox.emit(agentStatusInput());
    await waitUntil(() => received.length === 1);
  });
});
