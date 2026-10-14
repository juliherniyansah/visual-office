import { z } from 'zod';
import {
  AdapterIdSchema,
  AgentIdSchema,
  AgentStatusSchema,
  EscalationTargetSchema,
  TaskStatusSchema,
} from './enums';
import { AdapterEventSchema } from './schemas/adapter-event';
import { ActorSchema, IdSchema, IsoDateTimeSchema } from './schemas/common';
import { OfficeAgentSchema, OfficeStateVersionSchema } from './schemas/office-state';
import { DecisionSchema, DirectiveSchema, ResultSchema, TaskSchema } from './schemas/work';

export const AGGREGATE_KINDS = [
  'directive',
  'task',
  'run',
  'agent',
  'result',
  'decision',
  'office',
] as const;
export const AggregateKindSchema = z.enum(AGGREGATE_KINDS);
export type AggregateKind = z.infer<typeof AggregateKindSchema>;

// Outbox row envelope (plan section 11). `attempts` counts dispatch tries; 5 => events_dead.
const EventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  actor: ActorSchema,
  createdAt: IsoDateTimeSchema,
  dispatchedAt: IsoDateTimeSchema.optional(),
  attempts: z.number().int().nonnegative(),
});

function defineEvent<T extends string, K extends AggregateKind, P extends z.ZodRawShape>(
  type: T,
  kind: K,
  payload: P,
) {
  return EventEnvelopeSchema.extend({
    type: z.literal(type),
    aggregate: z.object({ kind: z.literal(kind), id: IdSchema }),
    payload: z.object(payload),
  });
}

const RUN_ID = { runId: IdSchema };

// Temporary OMO worker lifecycle; drives 3D drones (todos 9 and 15).
const WORKER_PAYLOAD = { ...RUN_ID, workerId: IdSchema, label: z.string().min(1) };

export const DomainEventSchema = z.discriminatedUnion('type', [
  defineEvent('directive.created', 'directive', { directive: DirectiveSchema }),
  defineEvent('task.created', 'task', { task: TaskSchema }),
  defineEvent('task.assigned', 'task', { taskId: IdSchema, assigneeAgentId: AgentIdSchema }),
  defineEvent('task.status_changed', 'task', { taskId: IdSchema, status: TaskStatusSchema }),
  defineEvent('run.started', 'run', {
    ...RUN_ID,
    taskId: IdSchema,
    agentId: AgentIdSchema,
    adapterId: AdapterIdSchema,
  }),
  defineEvent('run.progress', 'run', {
    ...RUN_ID,
    seq: z.number().int().nonnegative(),
    adapterEvent: AdapterEventSchema,
  }),
  defineEvent('run.permission_requested', 'run', {
    ...RUN_ID,
    permissionId: z.string().min(1),
    tool: z.string().min(1),
    detail: z.string(),
  }),
  defineEvent('run.completed', 'run', RUN_ID),
  defineEvent('run.failed', 'run', { ...RUN_ID, error: z.string() }),
  defineEvent('run.escalated', 'run', { ...RUN_ID, escalatedTo: EscalationTargetSchema }),
  defineEvent('agent.status_changed', 'agent', {
    agentId: AgentIdSchema,
    status: AgentStatusSchema,
    runId: IdSchema.optional(),
  }),
  defineEvent('result.recorded', 'result', { result: ResultSchema }),
  defineEvent('decision.requested', 'decision', { decision: DecisionSchema }),
  defineEvent('decision.answered', 'decision', {
    decisionId: IdSchema,
    ...RUN_ID,
    answer: z.string().min(1),
    answeredBy: IdSchema,
  }),
  defineEvent('office.state_updated', 'office', {
    version: OfficeStateVersionSchema,
    changed: z.array(OfficeAgentSchema),
  }),
  defineEvent('worker.spawned', 'run', WORKER_PAYLOAD),
  defineEvent('worker.despawned', 'run', WORKER_PAYLOAD),
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];
export type DomainEventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;

export const DOMAIN_EVENT_TYPES: readonly DomainEventType[] = Object.freeze(
  DomainEventSchema.options.map((option) => option.shape.type.value),
);
export const DomainEventTypeSchema = z.enum(DOMAIN_EVENT_TYPES);
