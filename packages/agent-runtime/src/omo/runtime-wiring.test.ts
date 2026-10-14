import { describe, expect, test } from 'bun:test';
import type { AdapterEvent } from '@redhunter/shared';
import { SequenceAdapter } from '../test-support/adapters';
import { createHarness, makeRequest } from '../test-support/harness';
import { verifyCompletion } from './verify';

const completed = (finalText: string): AdapterEvent[] => [
  { type: 'file_change', path: 'src/login.ts', kind: 'modified' },
  { type: 'completed', finalText },
];

describe('AgentRuntime with omo verify injected via AgentRuntimeDeps.verify', () => {
  test('acceptance met -> succeeded; per-item evidence becomes the Hermes lessons', async () => {
    const adapter = new SequenceAdapter([completed('All tests pass.')]);
    const h = createHarness(adapter, { verify: verifyCompletion });
    const outcome = await h.runtime.execute(makeRequest());
    expect(outcome.run.status).toBe('succeeded');
    expect(outcome.result?.verdict).toBe('pass');
    expect(h.sink.types()).toContain('result.recorded');
    expect(h.experience.rows[0]?.lessons).toEqual(['met: "tests pass"']);
  });

  test('acceptance unmet -> escalated without retry; evidence in the decision', async () => {
    const adapter = new SequenceAdapter([completed('Fixed the bug.')]);
    const h = createHarness(adapter, { verify: verifyCompletion });
    const outcome = await h.runtime.execute(makeRequest());
    expect(outcome.run.status).toBe('escalated');
    expect(adapter.starts).toBe(1);
    expect(h.decisions.rows[0]?.question).toBe(
      'Run run-1 escalated to coo after 1 attempt(s): Verification failed: ' +
        'unmet: "tests pass" (missing: tests, pass)',
    );
    expect(h.sink.types()).not.toContain('result.recorded');
    expect(h.experience.rows).toEqual([]);
  });
});
