import { randomUUID } from 'node:crypto';
import {
  type Actor,
  type AgentId,
  AgentIdSchema,
  type Task,
  type TaskStatus,
} from '@redhunter/shared';
import { toTask } from '../db/mappers';
import type { TaskRecord } from '../db/models';
import type { ActorInput, ServiceDeps } from './deps';
import { InvalidTransitionError, NotFoundError } from './errors';
import { assertTaskTransition } from './transitions';

export interface CreateTaskInput extends ActorInput {
  readonly directiveId: string;
  readonly projectId: string;
  readonly acceptance: readonly string[];
}

export interface AssignTaskInput extends ActorInput {
  readonly taskId: string;
  readonly agentId: AgentId;
}

export interface TransitionTaskInput extends ActorInput {
  readonly taskId: string;
  readonly to: TaskStatus;
  // Optional precondition on the current status, stricter than TASK_TRANSITIONS (REST actions).
  readonly allowedFrom?: readonly TaskStatus[];
}

export interface TaskFilter {
  readonly status?: TaskStatus;
  readonly assigneeAgentId?: AgentId;
}

async function loadTask(deps: ServiceDeps, taskId: string): Promise<TaskRecord> {
  const record = await deps.models.Task.findById(taskId).lean();
  if (record === null) {
    throw new NotFoundError('task', taskId);
  }
  return record;
}

// Compare-and-set on the status read earlier: of two concurrent writers exactly one wins.
async function updateFromStatus(
  deps: ServiceDeps,
  current: TaskRecord,
  to: TaskStatus,
  fields: Partial<Pick<TaskRecord, 'assigneeAgentId'>> = {},
): Promise<Task> {
  const updated = await deps.models.Task.findOneAndUpdate(
    { _id: current._id, status: current.status },
    { $set: { ...fields, status: to } },
    { new: true, lean: true },
  );
  if (updated === null) {
    const latest = await loadTask(deps, current._id);
    throw new InvalidTransitionError('task', latest.status, to);
  }
  return toTask(updated);
}

async function emitStatusChanged(deps: ServiceDeps, task: Task, actor: Actor): Promise<void> {
  await deps.outbox.emit({
    type: 'task.status_changed',
    aggregate: { kind: 'task', id: task.id },
    actor,
    payload: { taskId: task.id, status: task.status },
  });
}

export async function createTask(deps: ServiceDeps, input: CreateTaskInput): Promise<Task> {
  const directive = await deps.models.Directive.findById(input.directiveId).lean();
  if (directive === null) {
    throw new NotFoundError('directive', input.directiveId);
  }
  const record = await deps.models.Task.create({
    _id: randomUUID(),
    directiveId: input.directiveId,
    projectId: input.projectId,
    status: 'planned',
    acceptance: [...input.acceptance],
    capabilityTags: directive.capabilityTags,
    createdAt: new Date(),
  });
  const task = toTask(record.toObject());
  await deps.outbox.emit({
    type: 'task.created',
    aggregate: { kind: 'task', id: task.id },
    actor: input.actor,
    payload: { task },
  });
  return task;
}

// No capability routing yet (todo 13): the caller picks the agent.
export async function assignTask(deps: ServiceDeps, input: AssignTaskInput): Promise<Task> {
  const agentId = AgentIdSchema.parse(input.agentId);
  const current = await loadTask(deps, input.taskId);
  assertTaskTransition(current.status, 'assigned');
  const task = await updateFromStatus(deps, current, 'assigned', { assigneeAgentId: agentId });
  await deps.outbox.emit({
    type: 'task.assigned',
    aggregate: { kind: 'task', id: task.id },
    actor: input.actor,
    payload: { taskId: task.id, assigneeAgentId: agentId },
  });
  return task;
}

export async function transitionTask(deps: ServiceDeps, input: TransitionTaskInput): Promise<Task> {
  const current = await loadTask(deps, input.taskId);
  if (input.allowedFrom !== undefined && !input.allowedFrom.includes(current.status)) {
    throw new InvalidTransitionError('task', current.status, input.to);
  }
  assertTaskTransition(current.status, input.to);
  const task = await updateFromStatus(deps, current, input.to);
  await emitStatusChanged(deps, task, input.actor);
  return task;
}

export async function listTasks(deps: ServiceDeps, filter: TaskFilter): Promise<Task[]> {
  const query = {
    ...(filter.status === undefined ? {} : { status: filter.status }),
    ...(filter.assigneeAgentId === undefined ? {} : { assigneeAgentId: filter.assigneeAgentId }),
  };
  const records = await deps.models.Task.find(query).sort({ createdAt: 1, _id: 1 }).lean();
  return records.map(toTask);
}
