import { describe, expect, test } from 'bun:test';
import { type DomainEvent, DomainEventSchema } from '@redhunter/shared';
import { agentRoom, OFFICE_ROOM, roomsForEvent, runRoom } from './rooms';

const ENVELOPE = {
  eventId: '6f1c3f6e-8a43-4a43-9a43-1c2d3e4f5a6b',
  actor: { kind: 'system', id: 'test' },
  createdAt: '2026-10-09T00:00:00.000Z',
  attempts: 0,
} as const;

function event(fields: Record<string, unknown>): DomainEvent {
  return DomainEventSchema.parse({ ...ENVELOPE, ...fields });
}

describe('roomsForEvent', () => {
  test('every event goes to the office room', () => {
    const statusChanged = event({
      type: 'task.status_changed',
      aggregate: { kind: 'task', id: 't1' },
      payload: { taskId: 't1', status: 'in_progress' },
    });
    expect(roomsForEvent(statusChanged)).toEqual([OFFICE_ROOM]);
  });

  test('agent events also go to agent:<id>, and to run:<id> when they carry a runId', () => {
    const status = event({
      type: 'agent.status_changed',
      aggregate: { kind: 'agent', id: 'cto' },
      payload: { agentId: 'cto', status: 'working', runId: 'r9' },
    });
    expect(roomsForEvent(status)).toEqual([OFFICE_ROOM, agentRoom('cto'), runRoom('r9')]);
  });

  test('run.started carries both agentId and runId', () => {
    const started = event({
      type: 'run.started',
      aggregate: { kind: 'run', id: 'r1' },
      payload: { runId: 'r1', taskId: 't1', agentId: 'programming', adapterId: 'codex' },
    });
    expect(roomsForEvent(started)).toEqual([OFFICE_ROOM, 'agent:programming', 'run:r1']);
  });

  test('runId nested in result/decision payloads routes to run:<id>', () => {
    const recorded = event({
      type: 'result.recorded',
      aggregate: { kind: 'result', id: 'res1' },
      payload: {
        result: { id: 'res1', runId: 'r2', summary: 'ok', artifacts: [], verdict: 'pass' },
      },
    });
    const requested = event({
      type: 'decision.requested',
      aggregate: { kind: 'decision', id: 'd1' },
      payload: { decision: { id: 'd1', runId: 'r3', question: 'q?', options: ['a'], createdAt: '2026-10-09T00:00:00.000Z' } },
    });
    expect(roomsForEvent(recorded)).toEqual([OFFICE_ROOM, 'run:r2']);
    expect(roomsForEvent(requested)).toEqual([OFFICE_ROOM, 'run:r3']);
  });

  test('task.assigned routes to the assignee agent room', () => {
    const assigned = event({
      type: 'task.assigned',
      aggregate: { kind: 'task', id: 't1' },
      payload: { taskId: 't1', assigneeAgentId: 'iot' },
    });
    expect(roomsForEvent(assigned)).toEqual([OFFICE_ROOM, 'agent:iot']);
  });
});
