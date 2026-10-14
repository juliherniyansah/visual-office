import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import {
  SYSTEM_ACTOR,
  seedTask,
  startWorkContext,
  type WorkContext,
} from '../test-support/work';
import { createRun } from '../services/runs';
import { createResyncHandler } from './resync';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientSocket } from 'socket.io-client';

let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([
    ctx.db.models.Directive.deleteMany({}),
    ctx.db.models.Task.deleteMany({}),
    ctx.db.models.Run.deleteMany({}),
    ctx.db.models.Agent.deleteMany({}),
    ctx.db.models.Event.deleteMany({}),
  ]);
});

describe('createResyncHandler', () => {
  test('sends office_state snapshot on resync event', async () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    const resyncHandler = createResyncHandler(ctx.deps);

    io.on('connection', (socket) => {
      socket.on('resync', () => resyncHandler.handle(socket));
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Invalid server address');
    }

    const client = ClientSocket(`http://localhost:${address.port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    const officeStatePromise = new Promise<any>((resolve) => {
      client.on('office_state', resolve);
    });

    client.emit('resync');

    const officeState = await officeStatePromise;
    expect(officeState).toBeDefined();
    expect(officeState.floors).toBeDefined();
    expect(officeState.drones).toBeDefined();

    client.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  test('sends runs and agents snapshots', async () => {
    const taskId = await seedTask(ctx.deps, 'assigned');
    await createRun(ctx.deps, {
      taskId,
      adapterId: 'opencode',
      actor: SYSTEM_ACTOR,
    });

    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    const resyncHandler = createResyncHandler(ctx.deps);

    io.on('connection', (socket) => {
      socket.on('resync', () => resyncHandler.handle(socket));
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Invalid server address');
    }

    const client = ClientSocket(`http://localhost:${address.port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });

    const runsPromise = new Promise<any[]>((resolve) => {
      client.on('runs_snapshot', resolve);
    });

    client.emit('resync');

    const runs = await runsPromise;
    expect(runs).toBeDefined();
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBeGreaterThan(0);

    client.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });
});
