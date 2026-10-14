import { describe, expect, test } from 'bun:test';
import { RUN_STATUSES, TASK_STATUSES } from '@redhunter/shared';
import { ConflictError, InvalidTransitionError } from './errors';
import {
  assertRunTransition,
  assertTaskTransition,
  RUN_TRANSITIONS,
  TASK_TRANSITIONS,
} from './transitions';

function thrownBy(action: () => void): unknown {
  try {
    action();
  } catch (err) {
    return err;
  }
  throw new Error('expected the action to throw');
}

describe('run transitions (plan section 4 and 25)', () => {
  test('table is pinned exactly', () => {
    expect<unknown>(RUN_TRANSITIONS).toEqual({
      queued: ['composing', 'paused', 'failed'],
      composing: ['executing', 'paused', 'failed'],
      executing: ['verifying', 'paused', 'failed', 'escalated'],
      verifying: ['succeeded', 'paused', 'failed', 'escalated'],
      paused: ['queued', 'composing', 'executing', 'verifying', 'failed', 'escalated'],
      succeeded: [],
      failed: [],
      escalated: [],
    });
  });

  test('covers every RunStatus and never allows a self transition', () => {
    expect(Object.keys(RUN_TRANSITIONS).sort()).toEqual([...RUN_STATUSES].sort());
    for (const status of RUN_STATUSES) {
      expect(RUN_TRANSITIONS[status]).not.toContain(status);
    }
  });

  test('happy chain queued -> composing -> executing -> verifying -> succeeded is allowed', () => {
    expect(() => assertRunTransition('queued', 'composing')).not.toThrow();
    expect(() => assertRunTransition('composing', 'executing')).not.toThrow();
    expect(() => assertRunTransition('executing', 'verifying')).not.toThrow();
    expect(() => assertRunTransition('verifying', 'succeeded')).not.toThrow();
  });

  test('succeeded -> queued is rejected with a typed InvalidTransitionError (HTTP 409 class)', () => {
    const err = thrownBy(() => assertRunTransition('succeeded', 'queued'));
    expect(err).toBeInstanceOf(InvalidTransitionError);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err).toMatchObject({ entity: 'run', from: 'succeeded', to: 'queued' });
  });

  test('terminal statuses have no exit', () => {
    for (const terminal of ['succeeded', 'failed', 'escalated'] as const) {
      for (const target of RUN_STATUSES) {
        expect(() => assertRunTransition(terminal, target)).toThrow(InvalidTransitionError);
      }
    }
  });

  test('queued cannot jump straight to succeeded', () => {
    expect(() => assertRunTransition('queued', 'succeeded')).toThrow(InvalidTransitionError);
  });
});

describe('task transitions', () => {
  test('table is pinned exactly', () => {
    expect<unknown>(TASK_TRANSITIONS).toEqual({
      planned: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'cancelled', 'escalated'],
      in_progress: ['assigned', 'paused', 'cancelled', 'done', 'escalated'],
      paused: ['in_progress', 'cancelled'],
      escalated: ['assigned', 'cancelled'],
      done: [],
      cancelled: [],
    });
  });

  test('covers every TaskStatus and never allows a self transition', () => {
    expect(Object.keys(TASK_TRANSITIONS).sort()).toEqual([...TASK_STATUSES].sort());
    for (const status of TASK_STATUSES) {
      expect(TASK_TRANSITIONS[status]).not.toContain(status);
    }
  });

  test('done -> in_progress is rejected with a typed error', () => {
    const err = thrownBy(() => assertTaskTransition('done', 'in_progress'));
    expect(err).toBeInstanceOf(InvalidTransitionError);
    expect(err).toMatchObject({ entity: 'task', from: 'done', to: 'in_progress' });
  });

  test('pause, resume and cancel follow the table', () => {
    expect(() => assertTaskTransition('in_progress', 'paused')).not.toThrow();
    expect(() => assertTaskTransition('paused', 'in_progress')).not.toThrow();
    expect(() => assertTaskTransition('paused', 'cancelled')).not.toThrow();
    expect(() => assertTaskTransition('planned', 'paused')).toThrow(InvalidTransitionError);
    // Resume always returns to in_progress, so only a started task can be paused.
    expect(() => assertTaskTransition('assigned', 'paused')).toThrow(InvalidTransitionError);
    expect(() => assertTaskTransition('cancelled', 'in_progress')).toThrow(InvalidTransitionError);
  });
});
