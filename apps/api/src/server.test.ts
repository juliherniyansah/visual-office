import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { createOutbox } from './events/outbox';
import { startServer } from './server';
import { createTestDatabase, type TestDatabase } from './test-support/database';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

test('startServer listens on the requested host and exposes the http.Server for Socket.IO', async () => {
  const app = createApp({
    models: db.models,
    jwtSecret: 'server-test-secret-0123456789abcdef',
    outbox: createOutbox(db),
  });
  const server = await startServer(app, { port: 0, host: '127.0.0.1' });
  try {
    const address = server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
    const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/agents`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, error: expect.any(String) });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
