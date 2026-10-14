import { describe, expect, test } from 'bun:test';
import { RUN_STATUSES, type RunStatus } from '@redhunter/shared';
import {
  assertRunTransition,
  InvalidRunTransitionError,
  isTerminalRunStatus,
  RUN_TRANSITIONS,
  RunStateMachine,
} from './state-machine';
import { InMemoryRunRepository, makeRun, RecordingLogger } from './test-support/in-memory';

// Mirror of apps/api/src/services/transitions.ts RUN_TRANSITIONS (cannot import apps from packages).
const EXPECTED: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ['composing', 'paused', 'failed'],
  composing: ['executing', 'paused', 'failed'],
  executing: ['verifying', 'paused', 'failed', 'escalated'],
  verifying: ['succeeded', 'paused', 'failed', 'escalated'],
  paused: ['queued', 'composing', 'executing', 'verifying', 'failed', 'escalated'],
  succeeded: [],
  failed: [],
  escalated: [],
};

const ALL_PAIRS = RUN_STATUSES.flatMap((from) => RUN_STATUSES.map((to) => [from, to] as const));

describe('RUN_TRANSITIONS', () => {
  test('equals the apps/api graph exactly', () => {
    expect<unknown>(RUN_TRANSITIONS).toEqual(EXPECTED);
  });

  test('happy path of plan section 4 is legal', () => {
    const path: RunStatus[] = ['queued', 'composing', 'executing', 'verifying', 'succeeded'];
    for (let i = 1; i < path.length; i += 1) {
      expect(() =>
        assertRunTransition(path[i - 1] as RunStatus, path[i] as RunStatus),
      ).not.toThrow();
    }
  });

  test.each(ALL_PAIRS)('%s -> %s legal iff listed', (from, to) => {
    const legal = EXPECTED[from].includes(to);
    if (legal) {
      expect(() => assertRunTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertRunTransition(from, to)).toThrow(InvalidRunTransitionError);
    }
  });

  test('terminal statuses are succeeded, failed, escalated', () => {
    expect(RUN_STATUSES.filter(isTerminalRunStatus)).toEqual(['succeeded', 'failed', 'escalated']);
  });
});

describe('InvalidRunTransitionError', () => {
  test('carries from/to and a clear message', () => {
    const error = new InvalidRunTransitionError('succeeded', 'executing');
    expect(error.name).toBe('InvalidRunTransitionError');
    expect(error.from).toBe('succeeded');
    expect(error.to).toBe('executing');
    expect(error.message).toBe('Invalid run transition succeeded -> executing');
  });
});

describe('RunStateMachine', () => {
  test('reports a legal transition to the repository (CAS) and logs it', async () => {
    const runs = new InMemoryRunRepository();
    const logger = new RecordingLogger();
    await runs.create(makeRun({ id: 'r1', status: 'queued' }));
    const machine = new RunStateMachine({ runs, logger });

    await machine.transition('r1', 'queued', 'composing');

    expect(runs.get('r1')?.status).toBe('composing');
    expect(runs.transitions).toEqual([{ runId: 'r1', from: 'queued', to: 'composing' }]);
    expect(logger.entries).toEqual([
      { message: 'run transition', fields: { runId: 'r1', from: 'queued', to: 'composing' } },
    ]);
  });

  test('passes the patch through to the repository', async () => {
    const runs = new InMemoryRunRepository();
    await runs.create(makeRun({ id: 'r1', status: 'executing' }));
    const machine = new RunStateMachine({ runs });

    await machine.transition('r1', 'executing', 'failed', { error: 'boom' });

    expect(runs.get('r1')?.error).toBe('boom');
  });

  test('illegal transition throws before touching the repository or the log', async () => {
    const runs = new InMemoryRunRepository();
    const logger = new RecordingLogger();
    await runs.create(makeRun({ id: 'r1', status: 'succeeded' }));
    const machine = new RunStateMachine({ runs, logger });

    await expect(machine.transition('r1', 'succeeded', 'executing')).rejects.toBeInstanceOf(
      InvalidRunTransitionError,
    );
    expect(runs.transitions).toEqual([]);
    expect(logger.entries).toEqual([]);
  });

  test('a stale "from" is rejected by the repository CAS and is not logged', async () => {
    const runs = new InMemoryRunRepository();
    const logger = new RecordingLogger();
    await runs.create(makeRun({ id: 'r1', status: 'executing' }));
    const machine = new RunStateMachine({ runs, logger });

    await expect(machine.transition('r1', 'queued', 'composing')).rejects.toBeInstanceOf(
      InvalidRunTransitionError,
    );
    expect(runs.get('r1')?.status).toBe('executing');
    expect(logger.entries).toEqual([]);
  });

  test('default logger is a silent no-op', async () => {
    const runs = new InMemoryRunRepository();
    await runs.create(makeRun({ id: 'r1', status: 'queued' }));
    await new RunStateMachine({ runs }).transition('r1', 'queued', 'failed', { error: 'x' });
    expect(runs.get('r1')?.status).toBe('failed');
  });
});
