import { authorize, AuthorizationError } from '/home/programer/work/visual-office/packages/agent-runtime/src/authorize.ts';
import { createHarness, makeRequest } from '/home/programer/work/visual-office/packages/agent-runtime/src/test-support/harness.ts';
import { SequenceAdapter, COMPLETED, FAILED } from '/home/programer/work/visual-office/packages/agent-runtime/src/test-support/adapters.ts';

const results: string[] = [];
const check = (name: string, ok: boolean, extra = ''): void => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
};

// authorize
check('ceo createDirective', authorize('ceo', 'createDirective') === true);
check('coo assignTask', authorize('coo', 'assignTask') === true);
check('cto assignTask', authorize('cto', 'assignTask') === true);
check('programming runAdapter', authorize('programming', 'runAdapter') === true);
check('game runAdapter', authorize('game', 'runAdapter') === true);
check('iot runAdapter', authorize('iot', 'runAdapter') === true);
check('ai_development runAdapter', authorize('ai_development', 'runAdapter') === true);
check('ceo runAdapter denied', authorize('ceo', 'runAdapter') === false);
check('programming createDirective denied', authorize('programming', 'createDirective') === false);
check('unknown agent denied', authorize('ghost', 'runAdapter') === false);
check('unknown action denied', authorize('ceo', 'nuke') === false);

// success flow
{
  const h = createHarness(new SequenceAdapter([[COMPLETED]]));
  const out = await h.runtime.execute(makeRequest());
  const types = h.sink.events.map((e) => e.type);
  check('success status', out.run.status === 'succeeded', out.run.status);
  check('success result.recorded', types.includes('result.recorded'));
  check('success experience row', h.experience.rows.length === 1);
  check('success transitions', h.runs.transitions.map((t) => t.to).join(',') === 'composing,executing,verifying,succeeded', h.runs.transitions.map((t) => t.to).join(','));
  check('no run.status_changed', !types.includes('run.status_changed'));
  console.log('success events:', types.join(' '));
}

// failure -> escalate
{
  const h = createHarness(new SequenceAdapter([[FAILED]]));
  const out = await h.runtime.execute(makeRequest());
  const types = h.sink.events.map((e) => e.type);
  check('fail escalated', out.run.status === 'escalated', out.run.status);
  check('fail attempts=3', out.attempts === 3, String(out.attempts));
  check('fail backoffs 1,2', h.backoffs.join(',') === '1,2', h.backoffs.join(','));
  check('fail run.escalated', types.includes('run.escalated'));
  check('fail decision.requested', types.includes('decision.requested'));
  check('fail decision row', h.decisions.rows.length === 1);
  check('fail no experience', h.experience.rows.length === 0);
  const esc = h.sink.events.find((e) => e.type === 'run.escalated');
  console.log('escalated payload:', JSON.stringify(esc?.payload));
}

// unauthorized agent
{
  const h = createHarness(new SequenceAdapter([[COMPLETED]]));
  let threw: unknown;
  try {
    await h.runtime.execute(makeRequest({ agentId: 'ceo' }));
  } catch (e) {
    threw = e;
  }
  check('ceo execute throws AuthorizationError', threw instanceof AuthorizationError);
  check('unauthorized nothing persisted', h.runs.transitions.length === 0 && h.sink.events.length === 0);
}

console.log(results.join('\n'));
console.log(results.some((r) => r.startsWith('FAIL')) ? 'QA_FAIL' : 'QA_OK');
