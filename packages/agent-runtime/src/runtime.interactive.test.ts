import { describe, expect, test } from 'bun:test';
import type { AdapterEvent, AdapterId, AdapterRunInput, AgentAdapter } from '@redhunter/shared';
import { RunNotActiveError } from './runtime';
import { COMPLETED, SequenceAdapter } from './test-support/adapters';
import { createHarness, makeRequest } from './test-support/harness';

const PERMISSION: AdapterEvent = {
  type: 'permission_request',
  permissionId: 'perm-1',
  tool: 'bash',
  detail: 'rm -rf dist',
};

// answerPermission lets the stream finish (run reaches its terminal state) BEFORE it returns,
// so any status written after forwarding the answer would land after the final 'idle'.
class FinishOnAnswerAdapter implements AgentAdapter {
  readonly id: AdapterId = 'opencode';
  readonly #answer = Promise.withResolvers<void>();

  // Set by the test: resolves once the runtime reached its terminal status.
  waitForRunEnd: () => Promise<void> = () => Promise.resolve();

  start(_input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    const answer = this.#answer.promise;
    return (async function* () {
      yield PERMISSION;
      await answer;
      yield COMPLETED;
    })();
  }

  async answerPermission(): Promise<void> {
    this.#answer.resolve();
    await this.waitForRunEnd();
  }

  async cancel(): Promise<void> {}
}

const task = (status: 'started' | 'completed', label: string): AdapterEvent => ({
  type: 'tool',
  name: 'task',
  input: { subagent_type: label },
  status,
});

describe('AgentRuntime permission flow', () => {
  test('permission_request: decision row + events, run stays executing, agent waiting_permission', async () => {
    const adapter = new SequenceAdapter([[PERMISSION, COMPLETED]]);
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    await h.sink.waitFor('decision.requested');

    expect(h.runs.get('run-1')?.status).toBe('executing');
    expect(h.decisions.rows).toEqual([
      {
        id: 'id-1',
        runId: 'run-1',
        question: 'Allow bash: rm -rf dist?',
        options: ['allow', 'deny'],
        createdAt: expect.any(String),
      },
    ]);
    expect(h.sink.payloadsOf('run.permission_requested')).toEqual([
      { runId: 'run-1', permissionId: 'perm-1', tool: 'bash', detail: 'rm -rf dist' },
    ]);
    expect<unknown>(h.sink.payloadsOf('decision.requested')).toEqual([
      { decision: h.decisions.rows[0] },
    ]);
    expect(h.sink.agentStatuses()).toEqual(['thinking', 'working', 'waiting_permission']);
    expect(h.sink.types().slice(-4)).toEqual([
      'run.progress',
      'run.permission_requested',
      'decision.requested',
      'agent.status_changed',
    ]);

    // Run stays executing for the whole wait: no repository writes besides the two before it.
    const beforeAnswer: unknown[] = [
      { runId: 'run-1', from: 'queued', to: 'composing' },
      { runId: 'run-1', from: 'composing', to: 'executing' },
    ];
    expect<unknown>(h.runs.transitions).toEqual(beforeAnswer);
    await h.runtime.answerPermission('run-1', 'perm-1', 'allow');
    expect<unknown>(h.runs.transitions).toEqual(beforeAnswer);
    expect(h.runs.get('run-1')?.status).toBe('executing');
    expect(adapter.answers).toEqual([
      { runId: 'run-1', permissionId: 'perm-1', decision: 'allow' },
    ]);
    const outcome = await pending;
    expect(outcome.run.status).toBe('succeeded');
    expect<unknown>(h.runs.transitions.map((t) => t.to)).toEqual([
      'composing',
      'executing',
      'verifying',
      'succeeded',
    ]);
    expect(h.sink.agentStatuses()).toEqual([
      'thinking',
      'working',
      'waiting_permission',
      'working',
      'idle',
    ]);
  });

  test('a second answer for the same permission throws and is not forwarded again', async () => {
    const adapter = new SequenceAdapter([[PERMISSION, COMPLETED]]);
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    await h.sink.waitFor('decision.requested');
    await h.runtime.answerPermission('run-1', 'perm-1', 'allow');
    await expect(h.runtime.answerPermission('run-1', 'perm-1', 'allow')).rejects.toThrow(
      'No pending permission perm-1 for run run-1',
    );
    expect(adapter.answers).toHaveLength(1);
    expect((await pending).run.status).toBe('succeeded');
  });

  test('agent is working before the answer is forwarded, idle after the run ends', async () => {
    const adapter = new FinishOnAnswerAdapter();
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    adapter.waitForRunEnd = () => pending.then(() => undefined);
    await h.sink.waitFor('decision.requested');

    await h.runtime.answerPermission('run-1', 'perm-1', 'allow');
    const statuses = h.sink.agentStatuses();
    expect(statuses).toEqual(['thinking', 'working', 'waiting_permission', 'working', 'idle']);
    expect(statuses.at(-1)).toBe('idle');
    expect(statuses.lastIndexOf('working')).toBeGreaterThan(statuses.indexOf('waiting_permission'));
    expect(statuses.lastIndexOf('working')).toBeLessThan(statuses.lastIndexOf('idle'));
    expect((await pending).run.status).toBe('succeeded');
  });

  test('deny makes the adapter fail, which goes through retry', async () => {
    const adapter = new SequenceAdapter([[PERMISSION, COMPLETED], [COMPLETED]]);
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    await h.sink.waitFor('decision.requested');
    await h.runtime.answerPermission('run-1', 'perm-1', 'deny');
    const outcome = await pending;
    expect(adapter.starts).toBe(2);
    expect(outcome.run.status).toBe('succeeded');
  });

  test('answerPermission for an unknown run throws RunNotActiveError', async () => {
    const h = createHarness(new SequenceAdapter([[COMPLETED]]));
    const error = await h.runtime.answerPermission('nope', 'perm-1', 'allow').catch((e) => e);
    expect(error).toBeInstanceOf(RunNotActiveError);
    expect((error as Error).message).toBe('Run nope is not active');
  });

  test('answerPermission for a permission that is not pending throws and keeps status', async () => {
    const adapter = new SequenceAdapter([[PERMISSION, COMPLETED]]);
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    await h.sink.waitFor('decision.requested');
    await expect(h.runtime.answerPermission('run-1', 'perm-x', 'allow')).rejects.toThrow(
      'No pending permission perm-x for run run-1',
    );
    expect(adapter.answers).toEqual([]);
    expect(h.sink.agentStatuses().at(-1)).toBe('waiting_permission');
    await h.runtime.answerPermission('run-1', 'perm-1', 'allow');
    await pending;
  });
});

describe('AgentRuntime pause', () => {
  test('pause while waiting for permission: paused, adapter cancelled, no retry, agent blocked', async () => {
    const adapter = new SequenceAdapter([[PERMISSION, COMPLETED]]);
    const h = createHarness(adapter);
    const pending = h.runtime.execute(makeRequest());
    await h.sink.waitFor('decision.requested');

    await h.runtime.pause('run-1');
    const outcome = await pending;

    expect(outcome.run.status).toBe('paused');
    expect(adapter.cancels).toEqual(['run-1']);
    expect(adapter.starts).toBe(1);
    expect(h.runs.transitions.at(-1)).toEqual({ runId: 'run-1', from: 'executing', to: 'paused' });
    expect(h.sink.agentStatuses().at(-1)).toBe('blocked');
    expect(h.sink.types()).not.toContain('run.failed');
    expect(h.sink.types()).not.toContain('run.escalated');
    await expect(h.runtime.pause('run-1')).rejects.toBeInstanceOf(RunNotActiveError);
  });

  test('pause of an unknown run throws RunNotActiveError', async () => {
    const h = createHarness(new SequenceAdapter([[COMPLETED]]));
    await expect(h.runtime.pause('nope')).rejects.toBeInstanceOf(RunNotActiveError);
  });
});

describe('AgentRuntime workers', () => {
  test('task tool started/completed -> worker.spawned/worker.despawned', async () => {
    const script = [task('started', 'explore'), task('completed', 'explore'), COMPLETED];
    const h = createHarness(new SequenceAdapter([script]));
    await h.runtime.execute(makeRequest());
    expect(h.sink.payloadsOf('worker.spawned')).toEqual([
      { runId: 'run-1', workerId: 'id-1', label: 'explore' },
    ]);
    expect(h.sink.payloadsOf('worker.despawned')).toEqual([
      { runId: 'run-1', workerId: 'id-1', label: 'explore' },
    ]);
    const types = h.sink.types();
    expect(types.indexOf('worker.spawned')).toBeLessThan(types.indexOf('worker.despawned'));
  });

  test('non-task tools spawn nothing', async () => {
    const bash: AdapterEvent = { type: 'tool', name: 'bash', input: {}, status: 'started' };
    const h = createHarness(new SequenceAdapter([[bash, COMPLETED]]));
    await h.runtime.execute(makeRequest());
    expect(h.sink.types()).not.toContain('worker.spawned');
  });

  test('workers still open when the attempt ends are despawned', async () => {
    const h = createHarness(new SequenceAdapter([[task('started', 'oracle'), COMPLETED]]));
    await h.runtime.execute(makeRequest());
    expect(h.sink.payloadsOf('worker.despawned')).toEqual([
      { runId: 'run-1', workerId: 'id-1', label: 'oracle' },
    ]);
  });
});
