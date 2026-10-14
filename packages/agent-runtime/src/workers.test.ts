import { describe, expect, test } from 'bun:test';
import type { AdapterEvent } from '@redhunter/shared';
import { sequentialIds } from './test-support/in-memory';
import { WorkerTracker, workerLabel } from './workers';

const taskTool = (status: 'started' | 'completed', input: unknown = {}): AdapterEvent => ({
  type: 'tool',
  name: 'task',
  input,
  status,
});

describe('workerLabel', () => {
  test.each([
    ['subagent_type wins', { subagent_type: 'explore', description: 'find x' }, 'explore'],
    ['description fallback', { description: 'find x' }, 'find x'],
    ['empty strings ignored', { subagent_type: '', description: '' }, 'task'],
    ['non-object input', 'oops', 'task'],
    ['null input', null, 'task'],
  ])('%s', (_label, input, expected) => {
    expect(workerLabel(input)).toBe(expected);
  });
});

describe('WorkerTracker', () => {
  test('task started spawns, task completed despawns the same worker', () => {
    const tracker = new WorkerTracker(sequentialIds('w'));
    expect(tracker.observe(taskTool('started', { subagent_type: 'explore' }))).toEqual({
      kind: 'spawned',
      worker: { workerId: 'w-1', label: 'explore' },
    });
    expect(tracker.observe(taskTool('completed', { subagent_type: 'explore' }))).toEqual({
      kind: 'despawned',
      worker: { workerId: 'w-1', label: 'explore' },
    });
  });

  test('completion matches the oldest open worker with the same label', () => {
    const tracker = new WorkerTracker(sequentialIds('w'));
    tracker.observe(taskTool('started', { subagent_type: 'explore' }));
    tracker.observe(taskTool('started', { subagent_type: 'oracle' }));
    tracker.observe(taskTool('started', { subagent_type: 'explore' }));
    expect(tracker.observe(taskTool('completed', { subagent_type: 'oracle' }))).toEqual({
      kind: 'despawned',
      worker: { workerId: 'w-2', label: 'oracle' },
    });
    expect(tracker.observe(taskTool('completed', { subagent_type: 'explore' }))).toEqual({
      kind: 'despawned',
      worker: { workerId: 'w-1', label: 'explore' },
    });
  });

  test('completion without a label match falls back to the oldest open worker', () => {
    const tracker = new WorkerTracker(sequentialIds('w'));
    tracker.observe(taskTool('started', { subagent_type: 'explore' }));
    tracker.observe(taskTool('started', { subagent_type: 'oracle' }));
    expect(tracker.observe(taskTool('completed', {}))?.worker.workerId).toBe('w-1');
  });

  test('completion with no open worker and non-task tools are ignored', () => {
    const tracker = new WorkerTracker(sequentialIds('w'));
    expect(tracker.observe(taskTool('completed'))).toBeUndefined();
    expect(
      tracker.observe({ type: 'tool', name: 'bash', input: {}, status: 'started' }),
    ).toBeUndefined();
    expect(tracker.observe({ type: 'text', text: 'task' })).toBeUndefined();
  });

  test('drain returns open workers oldest first and empties the tracker', () => {
    const tracker = new WorkerTracker(sequentialIds('w'));
    tracker.observe(taskTool('started', { subagent_type: 'a' }));
    tracker.observe(taskTool('started', { subagent_type: 'b' }));
    expect(tracker.drain()).toEqual([
      { workerId: 'w-1', label: 'a' },
      { workerId: 'w-2', label: 'b' },
    ]);
    expect(tracker.drain()).toEqual([]);
  });
});
