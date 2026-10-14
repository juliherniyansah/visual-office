import type { RunStatus, TaskStatus } from '@redhunter/shared';
import { InvalidTransitionError } from './errors';

// Plan section 4 chain; any non-terminal state may pause, fail or escalate (sections 4, 25).
export const RUN_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ['composing', 'paused', 'failed'],
  composing: ['executing', 'paused', 'failed'],
  executing: ['verifying', 'paused', 'failed', 'escalated'],
  verifying: ['succeeded', 'paused', 'failed', 'escalated'],
  paused: ['queued', 'composing', 'executing', 'verifying', 'failed', 'escalated'],
  succeeded: [],
  failed: [],
  escalated: [],
};

// in_progress -> assigned: adapter crash re-queues the task for a retry run (section 25).
// Only in_progress pauses, so resume always targets in_progress.
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  planned: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled', 'escalated'],
  in_progress: ['assigned', 'paused', 'cancelled', 'done', 'escalated'],
  paused: ['in_progress', 'cancelled'],
  escalated: ['assigned', 'cancelled'],
  done: [],
  cancelled: [],
};

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!RUN_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError('run', from, to);
  }
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!TASK_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError('task', from, to);
  }
}
