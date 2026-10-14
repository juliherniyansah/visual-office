VERDICT: confirmed

# Todo 9 oracle verify r3 (independent, narrow)

## Baseline / integrity
- Prod sha16 (runtime 61e9e1237b6e85ef, attempt 3ea8b938965d8e47, policy 9bb7dc99a3af1a0f, authorize 50e0deab9693b6ff, run-events 75b4da5713f181a5, workers 5e2543a440101dfe, ports d9c6fab24654e24c, state-machine a4c9ae218e4abf83) == prod-sha-pre-r3.txt, before and after all mutants.
- T7 frozen: budget c8486a3bfac4a7f1, composer bf926606e379e504, layers 9ddd2d283480b835, constitution 21deac35bda4832f. T6 frozen: hermes/store.ts dbc545903811e2d8, api/db/mappers.ts d413bd8c001c3f63. All unchanged.
- No *.bak in repo (backups only in /tmp/opencode/t9-oracle3/). Leaked redhunter_test* DBs: [].
- runtime.ts restored from /tmp/opencode/t9-oracle3/runtime.ts.orig after each mutant; sha256 prefix 61e9e1237b6e85ef verified each time.

## Mutants (hand applied, one at a time; originals pass: stale-permission 8/0, interactive 11/0)
| Mutant | Edit | Command | Result with mutant |
|---|---|---|---|
| M14 | removed attempt-end `active.pendingPermission = undefined` (runtime.ts:213-214) and inserted it right before `last = await runAttempt({` (:194) | bun test packages/agent-runtime/src/runtime.stale-permission.test.ts | 7 pass / 1 fail: "AgentRuntime stale permission during backoff > answer between attempts (attempt 1 dead, retry not started) throws and is not forwarded" (Expected promise that rejects, received resolved). Only the target test fails. |
| M5 | deleted `active.pendingPermission = undefined;` in answerPermission (:160) | bun test packages/agent-runtime/src/runtime.interactive.test.ts | 10 pass / 1 fail: "a second answer for the same permission throws and is not forwarded again" (Expected length 1, received 2). |
| M6 | swapped lines 162/163: adapter.answerPermission awaited BEFORE `#setAgentStatus(active,'working')` | same | 10 pass / 1 fail: "agent is working before the answer is forwarded, idle after the run ends" (status sequence diff). |
All three KILLED; each restored, re-run PASS, sha equal.

## Test soundness (read fully)
- Backoff test: gates via Promise.withResolvers (backoffEntered / gate / retryStarted); no sleeps; asserts exact error message, adapter.answers empty, then releases and checks run succeeds. Deterministic.
- Duplicate-answer test: asserts rejects with exact message and answers length 1; deterministic.
- Status-order test: FinishOnAnswerAdapter.answerPermission blocks until the run ended, so any ordering where 'working' is set after forwarding yields a trailing 'working' after 'idle'; asserts full status sequence plus ordering. Not tautological, no timing.

## Regression
- bun test packages/agent-runtime packages/shared: 402 pass / 0 fail, run twice, no flake.
- bun run typecheck: 6/6 Exited with code 0.
- bunx biome check .: 174 files, clean.

## Acceptance test-name presence
runtime.test.ts:74, :153; runtime.integration.test.ts:108, :69 present with expected names; authorize.test.ts has pins + AuthorizationError tests; interactive permission-flow tests (permission_request, deny -> retry, not-pending keeps status, unknown run) present (runtime.interactive.test.ts line numbers shifted by r3 additions: 48, 135, 153). 

## Findings
None. Notes: M12 remains internal/equivalent (accepted decision).
