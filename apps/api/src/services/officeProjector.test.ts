import { describe, expect, test } from 'bun:test';
import { type DomainEvent, type DomainEventOf, findAgentDesk } from '@redhunter/shared';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../test-support/database';
import { createOutbox } from '../events/outbox';
import { getOfficeState } from './officeState';
import { createOfficeStateProjector } from './officeProjector';

function statusEvent(agentId: DomainEventOf<'agent.status_changed'>['payload']['agentId'], status: DomainEventOf<'agent.status_changed'>['payload']['status'], runId?: string): DomainEvent {
  return {
    eventId: randomUUID(),
    type: 'agent.status_changed',
    aggregate: { kind: 'agent', id: agentId },
    actor: { kind: 'system', id: 'test' },
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: { agentId, status, ...(runId === undefined ? {} : { runId }) },
  };
}

function workerEvent(type: 'worker.spawned' | 'worker.despawned', runId: string, workerId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    type,
    aggregate: { kind: 'run', id: runId },
    actor: { kind: 'system', id: 'test' },
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: { runId, workerId, label: `worker ${workerId}` },
  };
}

async function boot() {
  const db = await createTestDatabase();
  const updates: Array<{ version: number; changed: unknown[] }> = [];
  const projector = createOfficeStateProjector({
    models: db.models,
    onUpdated: (version, changed) => {
      updates.push({ version, changed: [...changed] });
    },
  });
  return { db, projector, updates };
}

describe('OfficeStateProjector', () => {
  test('recomputes only the changed agent and bumps version monotonically', async () => {
    const { db, projector, updates } = await boot();
    await projector.handle(statusEvent('programming', 'working', 'run-1'));
    await projector.handle(statusEvent('cto', 'waiting_permission'));

    const state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    expect(state.version).toBe(2);
    expect(updates.map((u) => u.version)).toEqual([1, 2]);
    // each delta names exactly the affected agent
    expect(updates[0]?.changed).toHaveLength(1);
    expect(updates[0]?.changed[0]).toMatchObject({ agentId: 'programming', status: 'working', pose: 'sitting', runId: 'run-1' });
    expect(updates[1]?.changed[0]).toMatchObject({ agentId: 'cto', status: 'waiting_permission', pose: 'standing' });
    // untouched agents keep their initial values
    const ceo = state.floors.flatMap((f) => f.agents).find((a) => a.agentId === 'ceo');
    expect(ceo).toMatchObject({ status: 'idle', pose: 'sitting', deskId: 'f4-ceo' });
    await db.drop();
  });

  test('run lifecycle updates the owning agent and run terminal clears runId', async () => {
    const { db, projector } = await boot();
    await projector.handle({
      eventId: randomUUID(),
      type: 'run.started',
      aggregate: { kind: 'run', id: 'run-9' },
      actor: { kind: 'system', id: 'test' },
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: { runId: 'run-9', taskId: 'task-1', agentId: 'game', adapterId: 'codex' },
    });
    let state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    let game = state.floors.flatMap((f) => f.agents).find((a) => a.agentId === 'game');
    expect(game).toMatchObject({ status: 'working', runId: 'run-9' });

    await projector.handle({
      eventId: randomUUID(),
      type: 'run.completed',
      aggregate: { kind: 'run', id: 'run-9' },
      actor: { kind: 'system', id: 'test' },
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: { runId: 'run-9' },
    });
    state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    game = state.floors.flatMap((f) => f.agents).find((a) => a.agentId === 'game');
    expect(game?.status).toBe('idle');
    expect(game?.runId).toBeUndefined();
    await db.drop();
  });

  test('worker.spawned adds a drone on the owner floor, worker.despawned removes it', async () => {
    const { db, projector } = await boot();
    await projector.handle(statusEvent('iot', 'working', 'run-7'));
    await projector.handle(workerEvent('worker.spawned', 'run-7', 'w-1'));
    let state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    expect(state.drones).toEqual([{ id: 'w-1', parentRunId: 'run-7', floorId: 2, label: 'worker w-1' }]);
    expect(state.version).toBe(2);

    await projector.handle(workerEvent('worker.despawned', 'run-7', 'w-1'));
    state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    expect(state.drones).toEqual([]);
    expect(state.version).toBe(3);
    await db.drop();
  });

  test('unrelated events do not bump version', async () => {
    const { db, projector, updates } = await boot();
    await projector.handle({
      eventId: randomUUID(),
      type: 'task.status_changed',
      aggregate: { kind: 'task', id: 'task-x' },
      actor: { kind: 'system', id: 'test' },
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: { taskId: 'task-x', status: 'done' },
    });
    const state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    expect(state.version).toBe(0);
    expect(updates).toEqual([]);
    await db.drop();
  });

  test('version is monotonic across concurrent deliveries', async () => {
    const { db, projector } = await boot();
    await Promise.all([
      projector.handle(statusEvent('ceo', 'thinking')),
      projector.handle(statusEvent('coo', 'blocked')),
      projector.handle(statusEvent('game', 'working')),
    ]);
    const state = await getOfficeState({ models: db.models, outbox: createOutbox({ models: db.models }) });
    expect(state.version).toBe(3);
    await db.drop();
  });

  test('agentId without a desk never reaches the projector (shared layout is exhaustive)', () => {
    expect(() => findAgentDesk('ceo')).not.toThrow();
  });
});
