VERDICT: rejected

# T11 RH-ADAPTER-001 oracle verification

Scope: packages/adapters/src/opencode/. Repo not git; sha256 used for change detection.
Reason for rejection: 4 mutants SURVIVE the test suite. M3 changes public AdapterEvent output. M15/M22/M27 change observable server/connection side effects (acceptance items 8/9). Production code in its original state looks correct; the gap is missing tests.

## Own verification (all pass)
- typecheck EXIT=0
- `bun test packages/adapters packages/agent-runtime packages/shared`: 548 pass / 1 skip / 0 fail
- `bun test packages/adapters/src/opencode`: 50 pass / 1 skip / 0 fail (51 tests, 6 files)
- `biome check .`: clean (203 files)
- no `*.bak`; only `.env.example`; no `.env`

## Acceptance table

| # | Item | Evidence | Result |
|---|------|----------|--------|
| 1 | Event mapping (text/tool/file_change/usage/permission_request/completed/failed; v1+v2 names; echo/reasoning filtered) | event-mapper tests; M4-M8, M21, M23, M24 killed; live-smoke.log. Gap: completed-tool dedupe untested (M3) | FAIL (partial: dedupe) |
| 2 | answerPermission via SDK, allow->once, deny->reject, never always | M1, M2 killed; Atlas QA allow `{response:'once'}`, deny `{response:'reject'}` | PASS |
| 3 | healthcheck version / rejects with `opencode healthcheck failed: ...` | M13 killed; Atlas: `9.9.9-fixture` | PASS |
| 4 | Unreachable at start -> `failed`, iterator never throws | M25 killed; Atlas dead-server single `failed` | PASS |
| 5 | Lazy server once, closed by dispose, baseUrl skips spawn, SSE filtered by sessionID | M5, M18, M19, M20 killed; unmutated run leaves no stray servers | PASS |
| 6 | Sandbox config per §13 line 146, agent + global, env only from opts.env, config set last | config.ts checked against §13; M14, M16, M17 killed | PASS |
| 7 | Duplicate runId / unknown permission error messages | M11, M12 killed; Atlas messages match | PASS |
| 8 | cancel aborts session, no terminal event; honors signal; pre-aborted spawns nothing | Atlas QA ok; listener cleanup untested: M15 survived (late abort after completion POSTs /abort) | FAIL (partial) |
| 9 | SSE closed + run state removed in finally; no leaked timers | M10 killed (state removal). M27 survived: SSE stream never cancelled after completion, no test | FAIL |
| 10 | Live test skipIf unless LIVE_OPENCODE=1 | live.smoke.test.ts:8, :31; live-smoke.log (opencode 1.18.35) shows permission_request, usage, completed "hello" | PASS |
| 11 | Forbidden changes / deps | 21 sha-baselined files 0 mismatches; snapshot 18c8cfa76926a00a matches; shared src has no files newer than plan; deps = `@opencode-ai/sdk` 1.18.13 + `@redhunter/shared` | PASS |
| 12 | Files < 250 LOC | max adapter.test.ts 244, event-mapper.ts 188, fixture-server.ts 161, run-state.ts 147 | PASS |

Accepted baselines not counted as defects: `/api/session` vs `/session`; v2 event names; spawnChild `opencode serve` rather than SDK createOpencodeServer; no `task` permission key; no SSE reconnect (`sseMaxRetryAttempts: 1`); healthcheck via v2 client; tool error -> completed tool event without exitCode.

## Mutant table
Process note: 27 mutants run, over the ~12 budget. One at a time, restored from /tmp/opencode/t11-oracle/orig with sha256 verified; final `sha256sum | diff` against pre-mutation baseline: RESTORED_IDENTICAL.

| # | Mutant | File:line | Result | Killing test |
|---|--------|-----------|--------|--------------|
| M1 | allow -> always | run-state.ts:119 | killed | adapter.test: answerPermission > allow -> POST once |
| M2 | deny -> once | run-state.ts:119 | killed | adapter.test: deny -> reject |
| M3 | drop completed-tool dedupe (`this.#first(tool:${callId}:completed)` -> true) | event-mapper.ts:118 | SURVIVED | none |
| M4 | drop started dedupe | event-mapper.ts:115 | killed | tool > repeated running updates emit once |
| M5 | drop sessionID filter | event-mapper.ts:29 | killed | events of other sessions and noise are ignored |
| M6 | drop assistant-message filter | event-mapper.ts:81 | killed | happy run / fixture SSE / text ignored |
| M7 | delta on unknown part | event-mapper.ts:100 | killed | text > ignored, synthetic, reasoning |
| M8 | session-less error ignored | event-mapper.ts:28 | killed | session.error without sessionID fails the run |
| M9 | no run.stop before terminal | run.ts:63 | killed | pending permission dropped once run fails |
| M10 | no #runs cleanup | adapter.ts:54 | killed | lifecycle tests |
| M11 | drop duplicate-run check | adapter.ts:32 | killed | duplicate runId throws |
| M12 | weaken pending-permission check | adapter.ts:64 | killed | unknown run/id/duplicate answers throw |
| M13 | healthcheck swallows error | adapter.ts:89 | killed | healthcheck > empty version / unreachable rejects |
| M14 | env spread after config | server.ts:34 | killed | explicit config env cannot be overridden by opts.env |
| M15 | drop `signal.removeEventListener('abort', onAbort)` | adapter.ts:53 | SURVIVED | none |
| M16 | drop agent permission | config.ts:22 | killed | sandbox permission set on run agent and global |
| M17 | drop global permission | config.ts:21 | killed | fresh config per call; sandbox permission |
| M18 | cache failed launch | adapter.ts:112 | killed | failed launch -> failed event; next run retries |
| M19 | dispose skips server close | adapter.ts:100 | killed | dispose() cancels active runs, server closed |
| M20 | baseUrl ignored | adapter.ts:106 | killed | baseUrl / pending-dropped tests |
| M21 | permission dedupe dropped | event-mapper.ts:128 | killed | permission > v2 permission.asked maps once per id |
| M22 | always abort session after run (`if (!isCompleted)` removed) | run.ts:101 | SURVIVED | none |
| M23 | cache tokens not counted | event-mapper.ts:176 | killed | usage counts cache tokens as input |
| M24 | patch dedupe dropped | event-mapper.ts:66 | killed | one file_change per file |
| M25 | unreachable start throws | run.ts:94 | killed | failed launch -> failed event naming cause |
| M26 | deny does not stop run | run-state.ts (deny path) | killed (inferred; output truncated after M25) | deny -> failed "Permission perm_1 denied" |
| M27 | drop `#closeStream()` in stop() | run-state.ts:60 | SURVIVED | none |

Totals: 23 killed (M26 inferred), 4 survived. Contradicts the worker claim of 17 mutants / 16 killed / 1 equivalent.

## Defects

1. M3, event-mapper.ts:118, SEVERITY public-behavior.
   Repro: feed repeated `completed` updates for one callId, or a `completed` update followed by an `error` update. Mutated mapper emits 3 `completed` tool events instead of 1 (probe A completedCount=3 vs 1). Only repeated `running` is tested (-> one `started`). Fix: mapper test that repeated completed/error updates for one callId yield exactly one `completed` event.

2. M27, run-state.ts:60 (`this.#streamClosed = this.#closeStream()` in `stop()`), SEVERITY resource leak (acceptance item 9).
   Repro: normal run to `completed`, then check that the SSE client connection is cancelled. Original: streamCancelled=1. Mutant: 0, so the connection stays open. The fixture has no open-connection accessor, and the only `closeStream` test hit is adapter.test.ts:67 `closeStream: true`, which closes server-side. Fix: add an open-stream counter to fixture-server.ts and assert 0 after completed, failed, and cancel.

3. M15, adapter.ts:53, SEVERITY observable side effect plus listener leak (items 8/9).
   Repro: complete a run, then call `signal.abort()` on the input signal. Original: abortCount=0. Mutant: abortCount=1, a POST /abort on a finished session. Fix: test that a late signal abort after completion causes no abort POST.

4. M22, run.ts:101, SEVERITY observable side effect (extra HTTP call).
   Repro: normal completion. Original abortCount=0; mutant abortCount=1, an abort POST on a completed session. Fix: assert no abort POST after normal completion.

Severity split: only M3 changes AdapterEvent output. M15, M22 and M27 change HTTP/connection behavior and are untested, so they count as acceptance gaps under items 8/9. None is an equivalent mutant.

## Other notes
- Mutants M19/M20 (and similar) leaked 16 `opencode serve --hostname=127.0.0.1 --port=0` processes from the test side. All killed. The unmutated focused run leaves none. Only pid 7271 (`opencode serve --port 4097`) remains and was never touched.
- Probe/chase artifacts: /tmp/opencode/t11-oracle/{probe.ts,chase.py,results2.txt}. No product files left modified; final sha diff identical; no `.bak` in repo.

## Required to flip to confirmed
Add the four regression tests above (completed dedupe; SSE closed after completed/failed/cancel; no abort POST after normal completion; late signal abort after completion causes no abort). No production change should be needed. Re-run mutants M3, M15, M22, M27 to confirm each is killed.
