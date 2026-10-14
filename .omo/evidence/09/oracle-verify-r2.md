VERDICT: rejected

# T9 (RH-OMO-001 AgentRuntime) round-2 independent verification

Production code: D1 is closed. T1 is closed. Rejection is for three NEW public-behavior mutant survivors
in the permission/retry paths (test-strength gaps, not production bugs). Each is a ~5-line test fix.

## Round-1 defects

### D1 (stale `pendingPermission` across attempts): CLOSED in production code
- `runtime.ts:214` clears `active.pendingPermission` right after `runAttempt` returns, before the abort check
  and before the retry/escalate/fail decision. It covers all three attempt-end shapes (adapter `failed`,
  throw, iterator end without terminal event) because `runAttempt` maps them all to a result kind.
- Retry resets agent status `waiting_permission -> working` before the next attempt (~line 191).
- Independent probe on the unmodified file (B1, not in repo; snippet below): a stale
  `answerPermission('run-1','perm-1','allow')` issued while the runtime sits in the backoff window throws
  `No pending permission perm-1 for run run-1` and the adapter receives zero answers.
- `runtime.stale-permission.test.ts` (3 ends x 2 tests + escalation test) kills M1/M2/M8/M9/M11 (table below).

### T1 (M08 survivor): CLOSED
- `runtime.interactive.test.ts:56,58` pin `h.runs.transitions` (`toEqual(beforeAnswer)`) to exactly
  `queued->composing, composing->executing` both before and after `answerPermission`, and `:65` pins the
  full `to` sequence. My mutant M3 (`executing -> paused -> executing` on permission request) is KILLED.

## Findings (blocking)

### T2: moving the attempt-end clear to the next attempt start survives (M14). Severity: medium (test gap, public behavior)
- Mutant: delete the clear at `runtime.ts:214`, add `active.pendingPermission = undefined;` right before
  `last = await runAttempt({`.
- Result: full `bun test packages/agent-runtime` stays green (0 fails).
- Real consequence of the mutant (probe B1): during the backoff window (attempt 1 dead, attempt 2 not
  started), a stale `answerPermission` is accepted and forwarded to the adapter (`answers = ["perm-1"]`,
  no error). That is the D1 symptom, just narrower.
- Why tests miss it: every stale-permission test awaits `retryStarted` (attempt 2 already running), so the
  backoff window is never probed.
- Fix: in `runtime.stale-permission.test.ts` pass `backoff` in `createHarness(adapter, { backoff })` that
  blocks on a gate, call `answerPermission` while blocked, and assert it rejects with
  `No pending permission perm-1 for run run-1` and `adapter.answers` equals `[]`.

### T3: `answerPermission` does not clear `pendingPermission` (M5) survives. Severity: medium (public behavior)
- Mutant: delete `runtime.ts:160` (`active.pendingPermission = undefined;` inside `answerPermission`).
- Result: all tests pass.
- Consequence (probe Q2): a second `answerPermission` for the same id is forwarded to the adapter again with
  no error (`answers` = 2). The original rejects it (probe P5).
- Fix: in `runtime.interactive.test.ts` after the first `answerPermission('run-1','perm-1','allow')`, assert
  a second call rejects with `No pending permission perm-1 for run run-1` and `adapter.answers` has length 1.

### T4: answer ordering `adapter.answerPermission` before `#setAgentStatus(active,'working')` (M6) survives. Severity: low-medium
- Mutant: swap the two awaits in `answerPermission`.
- Result: all tests pass. With an adapter whose `answerPermission` lets the run finish before it returns
  (probe Q1), agent statuses become `[..., waiting_permission, idle, working]`, so the agent is left
  `working` after the run ended.
- Existing FakeAdapter resolves too late to expose it.
- Fix: add a test with a gated adapter like probe Q1 and assert `agentStatuses().at(-1) === 'idle'` and
  that `working` precedes `idle`.

## Probe snippets (kept in /tmp/opencode/t9-oracle2/, not in repo)
- B1 (backoff-window stale answer): adapter attempt 1 yields `permission_request` then `FAILED`, attempt 2
  yields `COMPLETED`. `createHarness(a, { backoff: async () => { inBackoff.resolve(); await gate.promise; } })`.
  After `await inBackoff.promise` call `answerPermission`. Original: rejects, `answers=[]`. M14: no error,
  `answers=["perm-1"]`.
- Q1 / Q2: `probe2.test.ts` (gated adapter whose `answerPermission` resolves the gate before returning).

## Mutant table (own mutants, independent of worker's sets; `/tmp/opencode/t9-oracle2/mut.py`)
Runner: copy from `orig/runtime.ts`, mutate, `bun test packages/agent-runtime`, restore, compare sha256.
14 mutants (2 over the ~12 budget; M13 and M14 added late for the statuses / backoff window).

| id | description | result |
|---|---|---|
| M1 | remove attempt-end clear (214) | KILLED (3) |
| M2 | remove retry-start status reset to `working` | KILLED (3) |
| M3 | permission request does `paused -> executing` round-trip (T1/M08 shape) | KILLED (1) |
| M4 | drop mismatch check in `answerPermission` | KILLED (4) |
| M5 | `answerPermission` does not clear pending | **SURVIVED (public: duplicate answer forwarded) -> T3** |
| M6 | forward answer to adapter before status reset | **SURVIVED (public: final status `working` after `idle`) -> T4** |
| M7 | `answerPermission` skips `working` status | KILLED (1) |
| M8 | clear only when attempt `failed` | KILLED (1) |
| M9 | clear only when attempt not `failed` | KILLED (2) |
| M10 | never set `pendingPermission` | KILLED (3) |
| M11 | retry resets agent to `thinking` instead of `working` | KILLED (3) |
| M12 | clear moved after the abort/pause early-return | SURVIVED, INTERNAL (not blocking): `runtime.ts:147` `finally` removes the run from `#active` once `#paused` returns, so a stale id is unobservable afterwards. The only window is the awaits inside `#paused` (`runtime.ts:296`), after the pause already aborted the adapter run. Too narrow to pin; listed for completeness. |
| M13 | permission sets agent `blocked` instead of `waiting_permission` | KILLED (5) |
| M14 | attempt-end clear moved to next attempt start | **SURVIVED (public: stale answer in backoff window forwarded) -> T2** |

All 14 restores verified: `runtime.ts` sha256 back to `61e9e1237b6e85efd3fc5d37ad2c4d1a442782cead796d52e65de3e6af5fa46f`.

## Regression / acceptance spot-check
- Post-restore `bun test packages/agent-runtime packages/shared`: 399 pass, 0 fail (23 files).
- Baseline (before mutation): same 399 pass; `bun run typecheck` 6 packages exit 0; `biome check .` 174 files clean.
- Acceptance tests present by name: `runtime.test.ts:74` records result + Hermes experience;
  `runtime.test.ts:153` / `runtime.integration.test.ts:108` maxRetries -> escalated to manager with decision;
  `runtime.integration.test.ts:69` success -> `result.recorded` + experience row; `authorize.test.ts` deny path;
  `runtime.interactive.test.ts:22-47` permission decision row + `decision.requested`;
  `runtime.interactive.test.ts:140-152` `task` tool -> `worker.spawned` / `worker.despawned`.
- Accepted decisions not reopened: in-run retry vs plan section 25, no human/owner policy override, verify
  failure escalates without retry, `#fail` returns attempts 0, runtime.ts ~339 LOC, `attempt.ts` and
  `run-events.ts` not exported from index, T7 snapshot hash unrecorded.

## Frozen files / environment
- `packages/agent-runtime/src/prompt/{budget,composer,layers,constitution}.ts` hashes prefixes
  c8486a3bfac4a7f1, bf926606e379e504, 9ddd2d283480b835, 21deac35bda4832f: match.
- `packages/hermes/src/store.ts` prefix dbc545903811e2d8: match. `apps/api/src/db/mappers.ts` prefix
  d413bd8c001c3f63: match.
- Mongo leak check (`redhunter_test*` databases): `[]`.
- The 8 baseline-hashed src files match `baseline.sha` (`diff` printed SAME). No `*.bak`. Temporary
  `zz-probe.test.ts` removed from the repo.

## What a round 3 needs
Add the three tests above (T2, T3, T4). No production change is needed. Expected: M14, M5 and M6 become
KILLED. Re-run the sweep for those three only.
