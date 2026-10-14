VERDICT: rejected

# Todo 9 (RH-OMO-001): independent oracle verification

Verifier: oracle (fresh eyes). Date: 2026-10-10. Scope: `packages/agent-runtime` todo 9 against plan lines 308-312 plus sections 4, 5, 7 and 13, and Atlas's expanded acceptance list.

## Summary

All acceptance bullets pass in the scenarios the plan names, and baseline gates are green. I am rejecting on one production defect and one related test gap, both in the permission flow. Both are small and bounded:

- **D1 (production):** when an attempt ends (`failed`, a throw, or an end without a terminal event) while a permission is still pending, the runtime keeps `pendingPermission`. Two results follow during the retry attempt. First, the agent keeps showing `waiting_permission` even though the adapter is working. Second, `answerPermission` with the stale id is accepted and forwarded to the new attempt's adapter, which has no pending permission. That bypasses the guard "a permission that is not pending throws and is not forwarded to the adapter".
- **T1 (test gap, PASS-rule survivor M08):** the permission test checks `run.status === 'executing'` only once, at the moment it waits. A mutant that writes `executing -> paused -> executing` through the repository while a permission is pending survives the whole agent-runtime suite. That breaks "run STAYS executing" and "`paused` ONLY via `runtime.pause`". My QA script kills it.

Everything else below is confirmed. A re-verification only needs to cover D1 and T1.

## Baseline gates

| Gate | Command | Result |
|---|---|---|
| Tests | `bun test packages/agent-runtime packages/shared` | `392 pass / 0 fail / 1 snapshots, 1582 expect() calls / 22 files` EXIT=0 |
| Typecheck | `bun run typecheck` | all workspaces `Exited with code 0` (agent-runtime, api, hermes, adapters, ...) |
| Biome | `bunx biome check .` | `Checked 173 files in 78ms. No fixes applied.` EXIT=0 |
| No `run.status_changed` | `grep -rn "run\.status_changed" packages apps --include=*.ts` | only the comment at `state-machine.ts:41`; no emitter, not in the catalog |
| No apps/api import | `grep -rnE "apps/|@redhunter/api" packages/agent-runtime/src package.json` | only comments; package.json deps = shared, hermes (+ adapters dev) |
| No `any` | grep for `: any`, `as any`, `<any>`, `any[]` in agent-runtime src | none; Biome `noExplicitAny` clean |
| RUN_TRANSITIONS mirror | `diff` of apps/api `transitions.ts` vs `state-machine.ts` tables | identical (DIFF=0) |
| T6/T7/T8 untouched | `sha256sum prompt/{budget,composer,layers,constitution}.ts` | budget `c8486a3b…670d`, composer `bf926606…3d3`, layers `9ddd2d28…5feb`, constitution `21deac35…69df`: all match expected |
| Leftover test DBs | `mongosh --quiet --eval "...filter(n=>n.startsWith('redhunter_test'))"` | `[]` (checked before and after the sweep) |

## Acceptance checklist

Evidence script: `/tmp/opencode/t9-oracle/qa.ts` → `qa.txt` (`TOTAL 81 FAIL 0`). Edge probes: `edges.ts`/`edges.txt` and `edges2.ts`/`edges2.txt`.

| # | Acceptance bullet | Result | Evidence |
|---|---|---|---|
| 1 | FakeAdapter success → `succeeded`, `result.recorded`, Hermes experience row | PASS | atlas-qa (25/25) and repo `runtime.integration.test.ts` (real HermesStore). Also re-observed in qa.ts `perm allow: run succeeded`, `transitions :: composing,executing,verifying,succeeded` |
| 2 | Failing adapter → `maxRetries` retries with backoff, then `escalated` to a manager; `run.escalated {runId, escalatedTo}`, `decision.requested`, decisions row; no experience | PASS | `failure: run.escalated payload` = `{"runId":"run-1","escalatedTo":"coo"}`; `override cto maxRetries 4 -> 5 attempts, backoffs 1..4`; `backoffDelayMs 1,2,3 = 1000,2000,4000`; `perm deny: no experience` |
| 3 | authorize matrix; deny-by-default; typed AuthorizationError; unauthorized call persists nothing | PASS | `authorize full matrix incl. prototype keys` (10 agents × 7 actions incl. `toString`, `constructor`, `''`, `RUNADAPTER`); `execute by ceo/coo/cto/ghost -> AuthorizationError, nothing persisted` (no run row, events, decisions or experience) |
| 4 | Policy: default < override; manager-only override; re-validated; non-manager non-empty override throws PolicyOverrideError | PASS | coo/cto overrides applied. `agent:programming`, `agent:ceo`, `human:coo`, `human:owner-1` and `system:cto` all throw `PolicyOverrideError` with nothing persisted. Empty override from a non-manager falls back to defaults. Invalid override and invalid base both throw `ZodError` with no run row |
| 5a | permission_request → decisions row, `decision.requested`, `run.permission_requested`; run stays `executing`; agent `waiting_permission` | PASS (snapshot) / see T1 | decision `{"question":"Allow bash: rm -rf build?","options":["allow","deny"]}`; statuses `thinking,working,waiting_permission`; run `executing` |
| 5b | `answerPermission` resumes; agent back to `working`; mismatched id throws and is not forwarded | PASS for the in-attempt case; **FAIL for the cross-attempt case (D1)** | in-attempt: `wrong permissionId throws`, `NOT forwarded :: []`, statuses `…,waiting_permission,working,idle`. Cross-attempt: see D1 |
| 6 | `paused` only via `runtime.pause` (abort + cancel); no 30-min timeout | PASS (production) / see T1 | pause while a permission is pending, mid-stream, and during composing: `paused`, `adapter.cancel` called, agent `blocked`, no retry. No timer of 60 s or more is armed while waiting (setTimeout spy). The only `30-min` mention is the comment at `runtime.ts:166` |
| 7 | `tool` named `task` → `worker.spawned`; completion → `worker.despawned` (FIFO by label; drained at end) | PASS | 3 spawned (`oracle,explore,oracle`); `bash` and `Task` (wrong case) ignored; completion despawns the first `oracle` (FIFO); the rest are drained before `result.recorded` |
| 8 | Run state machine; typed InvalidRunTransitionError; transitions logged; CAS through repo; log only after repo success | PASS | illegal `queued->succeeded` → typed error, repo and log untouched. CAS mismatch is rejected and not logged. The log entry carries `{"runId","from","to"}`. Terminal → `queued` is illegal |
| 9 | Verify fail → escalated with evidence, no retry | PASS | question `"…after 1 attempt(s): Verification failed: missing test; lint red"`; path `composing,executing,verifying,escalated`; no experience |
| 10 | Unknown adapter → UnknownAdapterError, no run row | PASS | no run row, events or decisions |
| 11 | No `run.status_changed`, no apps/api import, no `any` | PASS | gates table above |

## Defects

### D1: stale `pendingPermission` survives a failed attempt (production, `runtime.ts`)

- Where: `runtime.ts:188-212` (retry loop) together with `runtime.ts:157-163` (`answerPermission`) and `runtime.ts:305` (set only, never cleared on attempt end).
- Repro: `/tmp/opencode/t9-oracle/edges2.ts`. The adapter's attempt 1 yields `permission_request perm-1`, then `failed`; attempt 2 runs. Output:
  ```
  during attempt 2: run executing | agent statuses thinking,working,waiting_permission
  stale answerPermission(perm-1) during attempt 2: accepted | forwarded to adapter: ["perm-1"]
  final: succeeded attempts 2 | statuses thinking,working,waiting_permission,working,idle
  ```
- Impact, all on public ports and events:
  1. The `agent.status_changed` stream shows `waiting_permission` for the whole retry attempt even though the agent is working. This is wrong for the 3D view and dashboards.
  2. An operator answering the now-stale decision row is accepted, and the answer goes to the new attempt's adapter. With FakeAdapter, or any adapter that validates, this rejects only after the runtime has already emitted `working`. If a vendor reuses a permission id, an old approval would be applied to a new request.
- Expected: when an attempt ends, any pending permission is dropped. A later `answerPermission(perm-1)` should throw without forwarding, and the retry attempt should emit `working`.
- Suggested fix (about 3 lines): after `runAttempt` returns, or before each retry, if `active.pendingPermission !== undefined`, set it to `undefined` and emit `agent.status_changed working` when continuing. Add one regression test, for example the `edges2.ts` scenario using a small custom adapter.
- Not hit by the deny path: deny is answered through `answerPermission`, which clears the field before the adapter yields `failed`. Only a crash, throw or stream end while a permission is pending triggers D1. Real vendor adapters (todos 11 and 12) and the todo 18 timeout make this path realistic.

### T1: permission "stays executing" is asserted only as a snapshot (test gap; survivor M08)

- Where: `runtime.interactive.test.ts:28`, which checks `expect(h.runs.get('run-1')?.status).toBe('executing')` only at the wait point.
- Survivor: mutant M08 inserts `#move('paused')` and then `#move('executing')` into `#requestPermission`. The repository gets two extra CAS writes (the run row is `paused` for a moment), yet the agent-runtime suite still passes. This breaks "run STAYS executing" and "`paused` ONLY via `runtime.pause`".
- Fix: add one assertion to the existing test, for example `expect(h.runs.transitions.map((t) => t.to)).toEqual(['composing', 'executing'])` at the wait point. That would kill M08. The realistic variant M08b (paused until answered) is already killed by the suite (2 failing tests).

## Mutation sweep

Runner: `/tmp/opencode/t9-oracle/mutate.ts` → `mutate.txt`, plus `mutate2.ts` for M08b. Each mutant applied exact single-occurrence replacements, then ran `bun test packages/agent-runtime` and my `qa.ts`. Original bytes were restored after each mutant and checked by sha256.

| id | target | repo suite | oracle qa.ts | restored |
|---|---|---|---|---|
| M01 | retry count off-by-one (`<` vs `<=`) | KILLED (8) | KILLED | sha256 OK |
| M02 | backoff `2^retry` instead of `2^(retry-1)` | KILLED (1) | KILLED (1) | sha256 OK |
| M03 | escalation target no longer skips self | KILLED (1) | KILLED (1) | sha256 OK |
| M04 | authorize: executive entry removed | KILLED (2) | KILLED (1) | sha256 OK |
| M05 | deny-by-default flipped for unknown agent | KILLED (3) | KILLED (2) | sha256 OK |
| M06 | permission guard: any id accepted while pending | KILLED (1) | KILLED | sha256 OK |
| M07 | permission → agent `blocked` instead of `waiting_permission` | KILLED (2) | KILLED (3) | sha256 OK |
| **M08** | **permission round-trips run through `paused`** | **SURVIVED** | KILLED (1) | sha256 OK |
| M08b | permission → `paused` until answered | KILLED (2) | KILLED (5) | sha256 OK |
| M09 | answerPermission does not restore `working` | KILLED (1) | KILLED (1) | sha256 OK |
| M10 | pause does not call `adapter.cancel` | KILLED (1) | KILLED (1) | sha256 OK |
| M11 | abort check after attempt removed | KILLED (1) | KILLED (5) | sha256 OK |
| M12 | state machine logs before repo CAS | KILLED (1) | KILLED (2) | sha256 OK |
| M13 | worker completion LIFO instead of FIFO | KILLED (1) | KILLED (1) | sha256 OK |
| M14 | open workers not drained at attempt end | KILLED (1) | KILLED (1) | sha256 OK |
| M15 | experience row also written on escalation | KILLED (3) | KILLED (2) | sha256 OK |
| M16 | authorization checked after run row persisted | KILLED (3) | KILLED (4) | sha256 OK |
| M17 | manager check ignores actor kind (`human:coo` accepted) | KILLED (2) | KILLED (2) | sha256 OK |

Score against the repo suite: 17 of 18 killed. M08 survived, and it changes public repository writes against the acceptance (see T1).

## Restoration (sha256)

| file | sha256 after sweep (equals before) |
|---|---|
| packages/agent-runtime/src/runtime.ts | 527ac6810f28f351f04eb3d78deea23d9c70448749053082a565d4dbe1698984 |
| packages/agent-runtime/src/authorize.ts | 50e0deab9693b6ff2528da666f012712bc47c871429ab5e1510b2a8a30cdc252 |
| packages/agent-runtime/src/state-machine.ts | a4c9ae218e4abf8342ed60e4f76e8ae1bde5872f0022774e57183f7cdc38fe20 |
| packages/agent-runtime/src/workers.ts | 5e2543a440101dfe4575b8531d233ad891526f910382cdfa6babd2aaa5f852ac |
| packages/agent-runtime/src/attempt.ts | 3ea8b938965d8e47bdd6b1b0243db421d623270510304abc82948a2ca55e37d4 |
| packages/agent-runtime/src/policy.ts | 9bb7dc99a3af1a0fabace28f42e9cb22a58f3f12ab6ed377877cd7e77a0d4535 |

Whole-tree check: sha256 of all 56 `*.ts` files under `packages/agent-runtime/src` and `packages/shared/src` was taken before the sweep (`/tmp/opencode/t9-oracle/sha-before.txt`) and compared after; `diff` EXIT=0. A `*.bak`/`*.orig` scan of the repo found nothing.

## Informational (not grounds for rejection)

- **Pause during backoff:** the runtime still calls `adapter.start` with an already-aborted signal (`edges.txt`: `paused attempts 2 starts 2 aborted-signal-on-2nd-start true`). The final state is correct (`paused`), and `spawnChild` throws `SpawnError('aborted')` before spawning. Optional improvement: check `signal.aborted` before each `start`.
- **Known accepted notes, not contested:** `runtime.ts` is 334 LOC; retries stay inside one runId; humans and owners cannot override the policy (deferred to T13); verify-fail does not retry; `#fail` returns `attempts: 0`; `attempt.ts` and `run-events.ts` are not exported; the hermes profile layer is not mapped; the T7 snapshot hash was not re-hashed (optional, skipped).
- After a successful permission answer the decision row remains unanswered (no `answer`/`answeredBy`). Closing decisions belongs to the T13 API layer, so this is not a T9 defect.

## Re-verification scope (single pass)

1. D1 fixed, with one regression test using the `edges2.ts` scenario. `edges2.ts` should then print `rejected` and forward `[]`, and statuses should show `working` during attempt 2.
2. T1: M08 killed by the agent-runtime suite.
3. `bun test packages/agent-runtime packages/shared`, `bun run typecheck` and `bunx biome check .` still green; prompt sha256 values unchanged.
