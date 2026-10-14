import { describe, expect, test } from 'bun:test';
import { makeRequest } from '../test-support/harness';
import type { StepResult } from './schemas';
import { NO_ACCEPTANCE, verify, verifyCompletion } from './verify';

const DONE: StepResult = {
  stepId: 's1',
  status: 'completed',
  output: 'All tests pass: 12/12. Login works with a fresh token.',
};

describe('verify', () => {
  test('all items met -> pass with one evidence line per item, in order', () => {
    expect(verify(DONE, ['tests pass', 'login works'])).toEqual({
      pass: true,
      evidence: ['met: "tests pass"', 'met: "login works"'],
    });
  });

  test('one unmet item -> fail; evidence names the missing keywords', () => {
    expect(verify(DONE, ['tests pass', 'coverage above 80 percent', 'login works'])).toEqual({
      pass: false,
      evidence: [
        'met: "tests pass"',
        'unmet: "coverage above 80 percent" (missing: coverage, above, 80, percent)',
        'met: "login works"',
      ],
    });
  });

  test('matching ignores case and punctuation', () => {
    const result = { ...DONE, output: 'TESTS: Pass!' };
    expect(verify(result, ['Tests pass.']).pass).toBe(true);
  });

  test('keywords match whole words only', () => {
    const result = { ...DONE, output: 'passport tests' };
    expect(verify(result, ['tests pass'])).toEqual({
      pass: false,
      evidence: ['unmet: "tests pass" (missing: pass)'],
    });
  });

  test('non-ASCII words are keywords', () => {
    const result = { ...DONE, output: 'Größe geprüft' };
    expect(verify(result, ['größe GEPRÜFT']).pass).toBe(true);
    expect(verify(result, ['größe ok']).pass).toBe(false);
  });

  test('result evidence and artifacts are searched too', () => {
    const result: StepResult = {
      stepId: 's1',
      status: 'completed',
      output: 'Done.',
      evidence: ['lint clean'],
      artifacts: ['src/login.ts'],
    };
    expect(verify(result, ['lint clean', 'login ts']).pass).toBe(true);
  });

  test('item without keywords is unmet (cannot be checked)', () => {
    expect(verify(DONE, ['tests pass', '!!!', ''])).toEqual({
      pass: false,
      evidence: ['met: "tests pass"', 'unmet: "!!!" (no keywords)', 'unmet: "" (no keywords)'],
    });
  });

  test('empty acceptance list -> pass with a single evidence line', () => {
    expect(verify(DONE, [])).toEqual({ pass: true, evidence: [NO_ACCEPTANCE] });
    expect(NO_ACCEPTANCE).toBe('No acceptance criteria');
  });

  test('empty output with criteria -> fail', () => {
    expect(verify({ ...DONE, output: '' }, ['tests pass']).pass).toBe(false);
  });

  test('failed step -> fail even when the output matches every item', () => {
    const failed: StepResult = { ...DONE, status: 'failed' };
    expect(verify(failed, ['tests pass'])).toEqual({
      pass: false,
      evidence: [`Step s1 failed: ${DONE.output}`],
    });
    expect(verify(failed, []).pass).toBe(false);
  });
});

describe('verifyCompletion (AgentRuntimeDeps.verify)', () => {
  test('maps completion + request acceptance to a verdict', async () => {
    const request = makeRequest();
    const pass = await verifyCompletion(
      { finalText: 'All tests pass.', artifacts: ['src/login.ts'] },
      request,
    );
    expect(pass).toEqual({ verdict: 'pass', evidence: ['met: "tests pass"'] });
    const fail = await verifyCompletion({ finalText: 'Fixed.', artifacts: [] }, request);
    expect(fail).toEqual({
      verdict: 'fail',
      evidence: ['unmet: "tests pass" (missing: tests, pass)'],
    });
  });

  test('artifacts of the completion count as searchable text', async () => {
    const request = makeRequest({
      task: { ...makeRequest().task, acceptance: ['src login ts'] },
    });
    const outcome = await verifyCompletion(
      { finalText: 'ok', artifacts: ['src/login.ts'] },
      request,
    );
    expect(outcome.verdict).toBe('pass');
  });
});
