import { describe, expect, test } from 'bun:test';
import { DOMAIN_EVENT_TYPES, DomainEventSchema, type DomainEventType } from './events';

const NOW = '2026-10-08T12:00:00.000Z';
const EVENT_ID = '0b8f1c1e-4a1f-4c3a-9d2e-5f6a7b8c9d0e';
const RUN_ID = 'run-1';

const DIRECTIVE = {
  id: 'd1',
  issuedBy: { kind: 'human', id: 'u1' },
  text: 'Ship login',
  status: 'issued',
  priority: 'normal',
  capabilityTags: ['code'],
};

const TASK = {
  id: 't1',
  directiveId: 'd1',
  projectId: 'p1',
  status: 'planned',
  acceptance: ['login returns JWT'],
  capabilityTags: ['code'],
};

const WORKER = { runId: RUN_ID, workerId: 'w1', label: 'explore' };

type Sample = { kind: string; id: string; payload: Record<string, unknown> };

const SAMPLES: Record<DomainEventType, Sample> = {
  'directive.created': { kind: 'directive', id: 'd1', payload: { directive: DIRECTIVE } },
  'task.created': { kind: 'task', id: 't1', payload: { task: TASK } },
  'task.assigned': {
    kind: 'task',
    id: 't1',
    payload: { taskId: 't1', assigneeAgentId: 'programming' },
  },
  'task.status_changed': {
    kind: 'task',
    id: 't1',
    payload: { taskId: 't1', status: 'in_progress' },
  },
  'run.started': {
    kind: 'run',
    id: RUN_ID,
    payload: { runId: RUN_ID, taskId: 't1', agentId: 'programming', adapterId: 'opencode' },
  },
  'run.progress': {
    kind: 'run',
    id: RUN_ID,
    payload: { runId: RUN_ID, seq: 2, adapterEvent: { type: 'text', text: 'Working...' } },
  },
  'run.permission_requested': {
    kind: 'run',
    id: RUN_ID,
    payload: { runId: RUN_ID, permissionId: 'perm-1', tool: 'bash', detail: 'rm -rf build' },
  },
  'run.completed': { kind: 'run', id: RUN_ID, payload: { runId: RUN_ID } },
  'run.failed': { kind: 'run', id: RUN_ID, payload: { runId: RUN_ID, error: 'adapter crashed' } },
  'run.escalated': { kind: 'run', id: RUN_ID, payload: { runId: RUN_ID, escalatedTo: 'cto' } },
  'agent.status_changed': {
    kind: 'agent',
    id: 'programming',
    payload: { agentId: 'programming', status: 'working', runId: RUN_ID },
  },
  'result.recorded': {
    kind: 'result',
    id: 'r1',
    payload: {
      result: { id: 'r1', runId: RUN_ID, summary: 'Done.', artifacts: [], verdict: 'pass' },
    },
  },
  'decision.requested': {
    kind: 'decision',
    id: 'dec1',
    payload: {
      decision: { 
        id: 'dec1', 
        runId: RUN_ID, 
        question: 'Allow bash?', 
        options: ['allow', 'deny'],
        createdAt: NOW 
      },
    },
  },
  'decision.answered': {
    kind: 'decision',
    id: 'dec1',
    payload: { decisionId: 'dec1', runId: RUN_ID, answer: 'allow', answeredBy: 'u1' },
  },
  'office.state_updated': {
    kind: 'office',
    id: 'office',
    payload: {
      version: 7,
      changed: [
        {
          agentId: 'programming',
          deskId: 'f2-programming',
          pose: 'sitting',
          status: 'working',
          activityLabel: 'Running tests',
        },
      ],
    },
  },
  'worker.spawned': { kind: 'run', id: RUN_ID, payload: WORKER },
  'worker.despawned': { kind: 'run', id: RUN_ID, payload: WORKER },
};

function buildEvent(type: string, sample: Sample): Record<string, unknown> {
  return {
    eventId: EVENT_ID,
    type,
    aggregate: { kind: sample.kind, id: sample.id },
    payload: sample.payload,
    actor: { kind: 'system', id: 'agent-runtime' },
    createdAt: NOW,
    attempts: 0,
  };
}

const AGENT_EVENT = buildEvent('agent.status_changed', SAMPLES['agent.status_changed']);
const WORKER_EVENT = buildEvent('worker.spawned', SAMPLES['worker.spawned']);

describe('DomainEvent catalog', () => {
  test('catalog matches plan section 11 plus worker events', () => {
    expect([...DOMAIN_EVENT_TYPES]).toEqual([
      'directive.created',
      'task.created',
      'task.assigned',
      'task.status_changed',
      'run.started',
      'run.progress',
      'run.permission_requested',
      'run.completed',
      'run.failed',
      'run.escalated',
      'agent.status_changed',
      'result.recorded',
      'decision.requested',
      'decision.answered',
      'office.state_updated',
      'worker.spawned',
      'worker.despawned',
    ]);
  });

  for (const type of DOMAIN_EVENT_TYPES) {
    test(`${type} round-trips`, () => {
      const event = buildEvent(type, SAMPLES[type]);
      expect<unknown>(DomainEventSchema.parse(event)).toEqual(event);
    });
  }

  test('dispatchedAt is optional and must be ISO when present', () => {
    const dispatched = { ...AGENT_EVENT, dispatchedAt: NOW };
    expect<unknown>(DomainEventSchema.parse(dispatched)).toEqual(dispatched);
    expect(DomainEventSchema.safeParse({ ...AGENT_EVENT, dispatchedAt: 'later' }).success).toBe(
      false,
    );
  });

  test('unknown type is rejected', () => {
    expect(DomainEventSchema.safeParse({ ...AGENT_EVENT, type: 'agent.danced' }).success).toBe(
      false,
    );
  });

  test('payload must match its type', () => {
    const wrongPayload = { ...AGENT_EVENT, payload: WORKER_EVENT.payload };
    expect(DomainEventSchema.safeParse(wrongPayload).success).toBe(false);
  });

  test('aggregate kind must match its type', () => {
    const wrongAggregate = { ...AGENT_EVENT, aggregate: { kind: 'run', id: RUN_ID } };
    expect(DomainEventSchema.safeParse(wrongAggregate).success).toBe(false);
  });

  test('eventId must be a uuid', () => {
    expect(DomainEventSchema.safeParse({ ...AGENT_EVENT, eventId: 'nope' }).success).toBe(false);
  });

  test('worker payload requires runId, workerId, label', () => {
    for (const key of ['runId', 'workerId', 'label'] as const) {
      const { [key]: _removed, ...payload } = WORKER;
      for (const type of ['worker.spawned', 'worker.despawned']) {
        const event = { ...WORKER_EVENT, type, payload };
        expect(DomainEventSchema.safeParse(event).success).toBe(false);
      }
    }
  });

  test('parsed worker event narrows on type', () => {
    const event = DomainEventSchema.parse(WORKER_EVENT);
    if (event.type !== 'worker.spawned') {
      throw new Error(`expected worker.spawned, got ${event.type}`);
    }
    expect(event.payload.workerId).toBe('w1');
  });
});
