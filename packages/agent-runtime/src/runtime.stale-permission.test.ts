import { describe, expect, test } from 'bun:test';
import type {
  AdapterEvent,
  AdapterId,
  AdapterRunInput,
  AgentAdapter,
  PermissionDecision,
} from '@redhunter/shared';
import { COMPLETED, FAILED } from './test-support/adapters';
import { createHarness, makeRequest } from './test-support/harness';

const PERMISSION: AdapterEvent = {
  type: 'permission_request',
  permissionId: 'perm-1',
  tool: 'bash',
  detail: 'rm -rf dist',
};

type FirstAttemptEnd = 'failed' | 'throws' | 'ends';

// Attempt 1 requests a permission and then dies WITHOUT waiting for an answer (crash, throw or
// a stream end). Attempt 2 blocks on a gate so the test can inspect the runtime mid-retry.
class CrashAfterPermissionAdapter implements AgentAdapter {
  readonly id: AdapterId = 'opencode';
  readonly answers: { runId: string; permissionId: string; decision: PermissionDecision }[] = [];
  starts = 0;
  readonly #gate = Promise.withResolvers<void>();
  readonly #retryStarted = Promise.withResolvers<void>();

  constructor(private readonly end: FirstAttemptEnd) {}

  get retryStarted(): Promise<void> {
    return this.#retryStarted.promise;
  }

  release(): void {
    this.#gate.resolve();
  }

  start(_input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    this.starts += 1;
    return this.starts === 1 ? this.#first() : this.#retry();
  }

  async *#first(): AsyncGenerator<AdapterEvent> {
    yield PERMISSION;
    if (this.end === 'failed') yield FAILED;
    if (this.end === 'throws') throw new Error('adapter crashed');
  }

  async *#retry(): AsyncGenerator<AdapterEvent> {
    yield { type: 'text', text: 'retrying' };
    this.#retryStarted.resolve();
    await this.#gate.promise;
    yield COMPLETED;
  }

  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    this.answers.push({ runId, permissionId, decision });
  }

  async cancel(): Promise<void> {}
}

describe.each<FirstAttemptEnd>(['failed', 'throws', 'ends'])(
  'AgentRuntime stale permission after the attempt %s',
  (end) => {
    test('retry attempt resets the agent from waiting_permission to working', async () => {
      const adapter = new CrashAfterPermissionAdapter(end);
      const h = createHarness(adapter);
      const pending = h.runtime.execute(makeRequest());
      await adapter.retryStarted;

      expect(adapter.starts).toBe(2);
      expect(h.sink.agentStatuses()).toEqual([
        'thinking',
        'working',
        'waiting_permission',
        'working',
      ]);
      adapter.release();
      expect((await pending).run.status).toBe('succeeded');
      expect(h.sink.agentStatuses().at(-1)).toBe('idle');
    });

    test('stale answer during the retry throws and never reaches the adapter', async () => {
      const adapter = new CrashAfterPermissionAdapter(end);
      const h = createHarness(adapter);
      const pending = h.runtime.execute(makeRequest());
      await adapter.retryStarted;

      const statusesBefore = h.sink.agentStatuses();
      const error = await h.runtime.answerPermission('run-1', 'perm-1', 'allow').catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('No pending permission perm-1 for run run-1');
      expect(adapter.answers).toEqual([]);
      expect(h.sink.agentStatuses()).toEqual(statusesBefore);

      adapter.release();
      expect((await pending).run.status).toBe('succeeded');
    });
  },
);

describe('AgentRuntime stale permission at escalation', () => {
  test('last attempt dies with a pending permission: escalated, agent idle, answer rejected', async () => {
    const adapter = new CrashAfterPermissionAdapter('failed');
    const h = createHarness(adapter);
    const outcome = await h.runtime.execute(
      makeRequest({ agentPolicy: { ...makeRequest().agentPolicy, maxRetries: 0 } }),
    );
    expect(outcome.run.status).toBe('escalated');
    expect(h.sink.agentStatuses().at(-1)).toBe('idle');
    await expect(h.runtime.answerPermission('run-1', 'perm-1', 'allow')).rejects.toThrow();
    expect(adapter.answers).toEqual([]);
  });
});

describe('AgentRuntime stale permission during backoff', () => {
  test('answer between attempts (attempt 1 dead, retry not started) throws and is not forwarded', async () => {
    const adapter = new CrashAfterPermissionAdapter('failed');
    const gate = Promise.withResolvers<void>();
    const backoffEntered = Promise.withResolvers<void>();
    const h = createHarness(adapter, {
      backoff: async () => {
        backoffEntered.resolve();
        await gate.promise;
      },
    });
    const pending = h.runtime.execute(makeRequest());
    await backoffEntered.promise;

    expect(adapter.starts).toBe(1);
    await expect(h.runtime.answerPermission('run-1', 'perm-1', 'allow')).rejects.toThrow(
      'No pending permission perm-1 for run run-1',
    );
    expect(adapter.answers).toEqual([]);

    gate.resolve();
    await adapter.retryStarted;
    adapter.release();
    expect((await pending).run.status).toBe('succeeded');
  });
});
