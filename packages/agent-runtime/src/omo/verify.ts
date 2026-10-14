import type { Completion, RunRequest, VerifyFn, VerifyOutcome } from '../ports';
import type { StepResult } from './schemas';

export const NO_ACCEPTANCE = 'No acceptance criteria';

export interface VerifyReport {
  readonly pass: boolean;
  readonly evidence: readonly string[];
}

const WORD = /[\p{L}\p{N}]+/gu;

const keywords = (text: string): string[] => text.toLowerCase().match(WORD) ?? [];

// Rule: an acceptance item is met when every one of its words (case-insensitive, letters and
// digits only) appears as a whole word in the step output, evidence or artifact paths.
// ponytail: keyword containment, not semantic judgement; swap in an LLM/test-runner check later.
function checkItem(item: string, words: ReadonlySet<string>): { met: boolean; line: string } {
  const required = keywords(item);
  if (required.length === 0) return { met: false, line: `unmet: "${item}" (no keywords)` };
  const missing = [...new Set(required)].filter((word) => !words.has(word));
  if (missing.length === 0) return { met: true, line: `met: "${item}"` };
  return { met: false, line: `unmet: "${item}" (missing: ${missing.join(', ')})` };
}

export function verify(result: StepResult, acceptance: readonly string[]): VerifyReport {
  if (result.status === 'failed') {
    return { pass: false, evidence: [`Step ${result.stepId} failed: ${result.output}`] };
  }
  if (acceptance.length === 0) return { pass: true, evidence: [NO_ACCEPTANCE] };
  const text = [result.output, ...(result.evidence ?? []), ...(result.artifacts ?? [])].join('\n');
  const words = new Set(keywords(text));
  const checks = acceptance.map((item) => checkItem(item, words));
  return { pass: checks.every((check) => check.met), evidence: checks.map((check) => check.line) };
}

// AgentRuntimeDeps.verify: the runtime only verifies completed adapter runs.
export const verifyCompletion: VerifyFn = (
  completion: Completion,
  request: RunRequest,
): VerifyOutcome => {
  const report = verify(
    {
      stepId: request.runId,
      status: 'completed',
      output: completion.finalText,
      artifacts: completion.artifacts,
    },
    request.task.acceptance,
  );
  return { verdict: report.pass ? 'pass' : 'fail', evidence: report.evidence };
};
