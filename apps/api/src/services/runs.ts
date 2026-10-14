import { randomUUID } from 'node:crypto';
import type { AdapterId, DomainEvent, EscalationTarget, Run, RunStatus } from '@redhunter/shared';
import { toRun } from '../db/mappers';
import type { RunRecord } from '../db/models';
import type { EventInput } from '../events/outbox';
import { toDomainEvent } from '../events/outbox';
import type { ActorInput, ServiceDeps } from './deps';
import { ConflictError, InvalidTransitionError, NotFoundError } from './errors';
import { assertRunTransition } from './transitions';

export interface CreateRunInput extends ActorInput {
  readonly taskId: string;
  readonly adapterId: AdapterId;
}

export interface TransitionRunInput extends ActorInput {
  readonly runId: string;
  readonly to: RunStatus;
  readonly error?: string;
  readonly escalatedTo?: EscalationTarget;
}

const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['succeeded', 'failed', 'escalated'];
const DEFAULT_ESCALATION: EscalationTarget = 'human';

async function loadRun(deps: ServiceDeps, runId: string): Promise<RunRecord> {
  const record = await deps.models.Run.findById(runId).lean();
  if (record === null) {
    throw new NotFoundError('run', runId);
  }
  return record;
}

function timestampFields(current: RunRecord, to: RunStatus, now: Date): Partial<RunRecord> {
  return {
    ...(to === 'executing' && current.startedAt === undefined ? { startedAt: now } : {}),
    ...(TERMINAL_RUN_STATUSES.includes(to) ? { endedAt: now } : {}),
  };
}

// Only lifecycle milestones are catalog events; intermediate steps reach clients via run.progress.
function transitionEvent(run: Run, input: TransitionRunInput): EventInput | undefined {
  const base = { aggregate: { kind: 'run', id: run.id }, actor: input.actor } as const;
  switch (input.to) {
    case 'succeeded':
      return { ...base, type: 'run.completed', payload: { runId: run.id } };
    case 'failed':
      return { ...base, type: 'run.failed', payload: { runId: run.id, error: run.error ?? '' } };
    case 'escalated':
      return {
        ...base,
        type: 'run.escalated',
        payload: { runId: run.id, escalatedTo: input.escalatedTo ?? DEFAULT_ESCALATION },
      };
    default:
      return undefined;
  }
}

export async function createRun(deps: ServiceDeps, input: CreateRunInput): Promise<Run> {
  const task = await deps.models.Task.findById(input.taskId).lean();
  if (task === null) {
    throw new NotFoundError('task', input.taskId);
  }
  if (task.assigneeAgentId === undefined) {
    throw new ConflictError(`Task ${task._id} has no assignee`);
  }
  const record = await deps.models.Run.create({
    _id: randomUUID(),
    taskId: task._id,
    agentId: task.assigneeAgentId,
    adapterId: input.adapterId,
    status: 'queued',
    usage: { inputTokens: 0, outputTokens: 0 },
    createdAt: new Date(),
  });
  const run = toRun(record.toObject());
  await deps.outbox.emit({
    type: 'run.started',
    aggregate: { kind: 'run', id: run.id },
    actor: input.actor,
    payload: { runId: run.id, taskId: run.taskId, agentId: run.agentId, adapterId: run.adapterId },
  });
  return run;
}

export async function transitionRun(deps: ServiceDeps, input: TransitionRunInput): Promise<Run> {
  const current = await loadRun(deps, input.runId);
  assertRunTransition(current.status, input.to);
  const fields = {
    ...timestampFields(current, input.to, new Date()),
    ...(input.to === 'failed' && input.error !== undefined ? { error: input.error } : {}),
    status: input.to,
  };
  const updated = await deps.models.Run.findOneAndUpdate(
    { _id: current._id, status: current.status },
    { $set: fields },
    { new: true, lean: true },
  );
  if (updated === null) {
    const latest = await loadRun(deps, current._id);
    throw new InvalidTransitionError('run', latest.status, input.to);
  }
  const run = toRun(updated);
  const event = transitionEvent(run, input);
  if (event !== undefined) {
    await deps.outbox.emit(event);
  }
  return run;
}

export async function getRun(deps: ServiceDeps, runId: string): Promise<Run> {
  return toRun(await loadRun(deps, runId));
}

export async function listRunEvents(deps: ServiceDeps, runId: string): Promise<DomainEvent[]> {
  await loadRun(deps, runId);
  const rows = await deps.models.Event.find({ 'aggregate.kind': 'run', 'aggregate.id': runId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return rows.map(toDomainEvent);
}
