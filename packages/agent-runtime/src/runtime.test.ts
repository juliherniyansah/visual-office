import { describe, expect, test } from 'bun:test';
import { type AdapterEvent, PromptSnapshotSchema, type RunStatus } from '@redhunter/shared';
import { AuthorizationError } from './authorize';
import { PolicyOverrideError } from './policy';
import { composePrompt } from './prompt/composer';
import { promptInputFromHermes } from './prompt/from-hermes';
import { backoffDelayMs, UnknownAdapterError } from './runtime';
import { COMPLETED, FAILED, SequenceAdapter, ThrowingAdapter } from './test-support/adapters';
import {
  createHarness,
  DEFAULT_POLICY,
  makeRequest,
  STUB_BASE,
  STUB_CONTEXT,
} from './test-support/harness';
import { TEST_NOW } from './test-support/in-memory';

const HAPPY: AdapterEvent[] = [
  { type: 'started', vendorSessionId: 'ses-1' },
  { type: 'file_change', path: 'src/login.ts', kind: 'modified' },
  { type: 'usage', inputTokens: 100, outputTokens: 20, costUsd: 0.01 },
  { type: 'file_change', path: 'src/login.ts', kind: 'modified' },
  { type: 'usage', inputTokens: 5, outputTokens: 1 },
  COMPLETED,
];

const path = (...statuses: RunStatus[]): unknown[] =>
  statuses.slice(1).map((to, index) => ({ runId: 'run-1', from: statuses[index], to }));

describe('AgentRuntime success', () => {
  test('walks queued -> composing -> executing -> verifying -> succeeded', async () => {
    const h = createHarness(new SequenceAdapter([HAPPY]));
    const outcome = await h.runtime.execute(makeRequest());
    expect(outcome.run.status).toBe('succeeded');
    expect(outcome.attempts).toBe(1);
    expect<unknown>(h.runs.transitions).toEqual(
      path('queued', 'composing', 'executing', 'verifying', 'succeeded'),
    );
    expect(h.logger.entries.map((entry) => entry.fields?.to)).toEqual([
      'composing',
      'executing',
      'verifying',
      'succeeded',
    ]);
  });

  test('emits the lifecycle events in order', async () => {
    const h = createHarness(new SequenceAdapter([HAPPY]));
    await h.runtime.execute(makeRequest());
    expect(h.sink.types()).toEqual([
      'run.started',
      'agent.status_changed',
      'agent.status_changed',
      ...HAPPY.map(() => 'run.progress' as const),
      'result.recorded',
      'run.completed',
      'agent.status_changed',
    ]);
    expect(h.sink.agentStatuses()).toEqual(['thinking', 'working', 'idle']);
    expect(h.sink.payloadsOf('run.started')).toEqual([
      { runId: 'run-1', taskId: 'task-1', agentId: 'programming', adapterId: 'opencode' },
    ]);
    expect(h.sink.payloadsOf('run.progress')).toEqual(
      HAPPY.map((adapterEvent, seq) => ({ runId: 'run-1', seq, adapterEvent })),
    );
    expect(h.sink.payloadsOf('agent.status_changed')[0]).toEqual({
      agentId: 'programming',
      status: 'thinking',
      runId: 'run-1',
    });
    expect(h.sink.events.every((event) => event.actor.id === 'programming')).toBe(true);
  });

  test('records result, writes Hermes experience and stores run metadata', async () => {
    const h = createHarness(new SequenceAdapter([HAPPY]));
    const outcome = await h.runtime.execute(makeRequest());
    const result = {
      id: 'id-1',
      runId: 'run-1',
      summary: 'Fixed the bug.',
      artifacts: ['src/login.ts'],
      verdict: 'pass',
    };
    expect<unknown>(outcome.result).toEqual(result);
    expect<unknown>(h.sink.payloadsOf('result.recorded')).toEqual([{ result }]);
    expect<unknown>(h.experience.rows).toEqual([
      {
        id: 'exp-1',
        agentId: 'programming',
        taskType: 'bugfix',
        outcome: 'pass',
        lessons: ['Completed bugfix in 1 attempt(s)'],
        runId: 'run-1',
      },
    ]);
    const run = h.runs.get('run-1');
    expect(run?.vendorSessionId).toBe('ses-1');
    expect(run?.usage).toEqual({ inputTokens: 105, outputTokens: 21, costUsd: 0.01 });
    expect(run?.startedAt).toBe(TEST_NOW.toISOString());
    expect(run?.endedAt).toBe(TEST_NOW.toISOString());
  });

  test('stores the composed prompt snapshot and sends its text to the adapter', async () => {
    const adapter = new SequenceAdapter([[COMPLETED]]);
    const h = createHarness(adapter);
    await h.runtime.execute(makeRequest());
    const expected = composePrompt(promptInputFromHermes(STUB_CONTEXT, STUB_BASE, DEFAULT_POLICY));
    const snapshot = h.runs.get('run-1')?.promptSnapshot;
    expect(PromptSnapshotSchema.parse(snapshot)).toEqual({
      text: expected.text,
      layers: [...expected.layers],
      hash: expected.hash,
    });
    expect(snapshot?.text).toContain('memory one');
    expect(snapshot?.text).toContain('lesson one');
    const input = adapter.inputs[0];
    expect(input?.prompt).toBe(expected.text);
    expect(input?.policy).toEqual(DEFAULT_POLICY);
    expect(input?.runId).toBe('run-1');
    expect(input?.agentId).toBe('programming');
    expect(input?.cwd).toBe('/srv/repos/redhunter');
    expect(input?.signal).toBeInstanceOf(AbortSignal);
    expect(h.promptSource.calls[0]?.budget).toBe(DEFAULT_POLICY.budgetTokens);
  });

  test('without taskType the experience uses "general"', async () => {
    const h = createHarness(new SequenceAdapter([[COMPLETED]]));
    const request = makeRequest();
    await h.runtime.execute({ ...request, task: { ...request.task, taskType: undefined } });
    expect(h.experience.rows[0]?.taskType).toBe('general');
  });

  test('verify receives the completion and acceptance; its evidence becomes the lessons', async () => {
    const seen: unknown[] = [];
    const h = createHarness(new SequenceAdapter([HAPPY]), {
      verify: (completion, request) => {
        seen.push({ completion, acceptance: request.task.acceptance });
        return { verdict: 'pass', evidence: ['tests pass: 12/12', ''] };
      },
    });
    await h.runtime.execute(makeRequest());
    expect(seen).toEqual([
      {
        completion: { finalText: 'Fixed the bug.', artifacts: ['src/login.ts'] },
        acceptance: ['tests pass'],
      },
    ]);
    expect(h.experience.rows[0]?.lessons).toEqual(['tests pass: 12/12']);
  });
});

describe('AgentRuntime retry and escalation', () => {
  test('failing adapter retries exactly maxRetries times then escalates to the manager', async () => {
    const adapter = new SequenceAdapter([[FAILED]]);
    const h = createHarness(adapter);
    const outcome = await h.runtime.execute(makeRequest());
    expect(adapter.starts).toBe(3);
    expect(outcome.attempts).toBe(3);
    expect(h.backoffs).toEqual([1, 2]);
    expect(outcome.run.status).toBe('escalated');
    expect<unknown>(h.runs.transitions).toEqual(
      path('queued', 'composing', 'executing', 'escalated'),
    );
    expect(h.sink.payloadsOf('run.escalated')).toEqual([{ runId: 'run-1', escalatedTo: 'coo' }]);
    expect(h.decisions.rows).toEqual([
      {
        id: 'id-1',
        runId: 'run-1',
        question: 'Run run-1 escalated to coo after 3 attempt(s): tests red',
        options: ['retry', 'reassign', 'cancel'],
        createdAt: expect.any(String),
      },
    ]);
    expect<unknown>(h.sink.payloadsOf('decision.requested')).toEqual([
      { decision: h.decisions.rows[0] },
    ]);
    expect(h.sink.types()).not.toContain('result.recorded');
    expect(h.sink.types()).not.toContain('run.completed');
    expect(h.sink.types()).not.toContain('run.failed');
    expect(h.experience.rows).toEqual([]);
    expect(h.runs.get('run-1')?.error).toBe('tests red');
    expect(h.sink.agentStatuses().at(-1)).toBe('idle');
    expect(h.sink.payloadsOf('run.progress').map((p) => p.seq)).toEqual([0, 1, 2]);
  });

  test.each([0, 1, 4])('maxRetries %i -> %i + 1 attempts', async (maxRetries) => {
    const adapter = new SequenceAdapter([[FAILED]]);
    const h = createHarness(adapter);
    await h.runtime.execute(makeRequest({ agentPolicy: { ...DEFAULT_POLICY, maxRetries } }));
    expect(adapter.starts).toBe(maxRetries + 1);
    expect(h.backoffs).toHaveLength(maxRetries);
  });

  test('a throwing adapter is retried the same way', async () => {
    const adapter = new ThrowingAdapter();
    const h = createHarness(adapter);
    const outcome = await h.runtime.execute(makeRequest());
    expect(adapter.starts).toBe(3);
    expect(outcome.run.status).toBe('escalated');
    expect(h.decisions.rows[0]?.question).toBe(
      'Run run-1 escalated to coo after 3 attempt(s): spawn failed #3',
    );
  });

  test('an adapter that ends without a terminal event counts as a failed attempt', async () => {
    const adapter = new SequenceAdapter([[{ type: 'text', text: 'hm' }]]);
    const h = createHarness(adapter);
    const outcome = await h.runtime.execute(makeRequest());
    expect(adapter.starts).toBe(3);
    expect(outcome.run.error).toBe('Adapter ended without a terminal event');
  });

  test('success on the second attempt stops retrying', async () => {
    const adapter = new SequenceAdapter([[FAILED], [COMPLETED]]);
    const h = createHarness(adapter);
    const outcome = await h.runtime.execute(makeRequest());
    expect(adapter.starts).toBe(2);
    expect(h.backoffs).toEqual([1]);
    expect(outcome.run.status).toBe('succeeded');
    expect(h.experience.rows[0]?.lessons).toEqual(['Completed bugfix in 2 attempt(s)']);
  });

  test.each([
    ['first entry', ['cto', 'human'], 'cto'],
    ['skips the agent itself', ['programming', 'cto', 'human'], 'cto'],
    ['empty chain -> human', [], 'human'],
  ] as const)('escalation target: %s', async (_label, escalationChain, expected) => {
    const h = createHarness(new SequenceAdapter([[FAILED]]));
    await h.runtime.execute(
      makeRequest({
        agentPolicy: { ...DEFAULT_POLICY, maxRetries: 0, escalationChain: [...escalationChain] },
      }),
    );
    expect(h.sink.payloadsOf('run.escalated')[0]?.escalatedTo).toBe(expected);
  });

  test('verify failure escalates from verifying without retry (retry on verify is T10)', async () => {
    const adapter = new SequenceAdapter([[COMPLETED]]);
    const h = createHarness(adapter, {
      verify: () => ({ verdict: 'fail', evidence: ['tests: 3 failed'] }),
    });
    const outcome = await h.runtime.execute(makeRequest());
    expect(adapter.starts).toBe(1);
    expect(outcome.run.status).toBe('escalated');
    expect<unknown>(h.runs.transitions).toEqual(
      path('queued', 'composing', 'executing', 'verifying', 'escalated'),
    );
    expect(h.decisions.rows[0]?.question).toBe(
      'Run run-1 escalated to coo after 1 attempt(s): Verification failed: tests: 3 failed',
    );
    expect(h.experience.rows).toEqual([]);
  });

  test('default backoff is exponential from 1 s', () => {
    expect([1, 2, 3].map(backoffDelayMs)).toEqual([1000, 2000, 4000]);
  });
});

describe('AgentRuntime guards', () => {
  test.each(['ceo', 'coo', 'cto'] as const)(
    '%s may not run an adapter: AuthorizationError, nothing persisted',
    async (agentId) => {
      const adapter = new SequenceAdapter([[COMPLETED]]);
      const h = createHarness(adapter);
      await expect(h.runtime.execute(makeRequest({ agentId }))).rejects.toBeInstanceOf(
        AuthorizationError,
      );
      expect(h.runs.get('run-1')).toBeUndefined();
      expect(h.sink.events).toEqual([]);
      expect(adapter.starts).toBe(0);
    },
  );

  test('policy override by a non-manager is rejected before anything happens', async () => {
    const h = createHarness(new SequenceAdapter([[COMPLETED]]));
    const request = makeRequest({
      policyOverride: { override: { maxRetries: 9 }, actor: { kind: 'agent', id: 'programming' } },
    });
    await expect(h.runtime.execute(request)).rejects.toBeInstanceOf(PolicyOverrideError);
    expect(h.runs.get('run-1')).toBeUndefined();
    expect(h.sink.events).toEqual([]);
  });

  test('manager override is applied (maxRetries 0, budget)', async () => {
    const adapter = new SequenceAdapter([[FAILED]]);
    const h = createHarness(adapter);
    await h.runtime.execute(
      makeRequest({
        policyOverride: {
          override: { maxRetries: 0, budgetTokens: 9000 },
          actor: { kind: 'agent', id: 'cto' },
        },
      }),
    );
    expect(adapter.starts).toBe(1);
    expect(h.promptSource.calls[0]?.budget).toBe(9000);
    expect(adapter.inputs[0]?.policy?.budgetTokens).toBe(9000);
  });

  test('unknown adapter id throws UnknownAdapterError before creating the run', async () => {
    const h = createHarness(new SequenceAdapter([[COMPLETED]]));
    const error = await h.runtime.execute(makeRequest({ adapterId: 'codex' })).catch((e) => e);
    expect(error).toBeInstanceOf(UnknownAdapterError);
    expect((error as Error).message).toBe('No adapter registered for codex');
    expect(h.runs.get('run-1')).toBeUndefined();
  });

  test('composing failure fails the run without starting the adapter', async () => {
    const adapter = new SequenceAdapter([[COMPLETED]]);
    const h = createHarness(adapter, {
      promptSource: {
        load: async () => {
          throw new Error('hermes down');
        },
      },
    });
    const outcome = await h.runtime.execute(makeRequest());
    expect(outcome.run.status).toBe('failed');
    expect(outcome.run.error).toBe('hermes down');
    expect<unknown>(h.runs.transitions).toEqual(path('queued', 'composing', 'failed'));
    expect(h.sink.payloadsOf('run.failed')).toEqual([{ runId: 'run-1', error: 'hermes down' }]);
    expect(h.sink.agentStatuses()).toEqual(['thinking', 'idle']);
    expect(adapter.starts).toBe(0);
  });
});
