VERDICT: rejected

T11 RH-ADAPTER-001 oracle verify round 2. Test-only mutation sweep, 12 mutants: 10 killed, 2 survived (both PUBLIC).
Method: backup in /tmp/opencode/t11-oracle-r2/orig, one mutation at a time, `bun test packages/adapters/src/opencode`, restore, cmp. All 7 mutated prod files byte-identical after sweep.
Note: first M3+M27 and M27+M15 runs were accidentally parallel (contaminated); both re-run alone, results below are the clean ones.

## Round-1 survivors (re-run)
| id | file:line | change | result | public |
|---|---|---|---|---|
| M3 | event-mapper.ts:118 | drop completed-tool dedupe | KILLED (3: event-mapper.dedupe x3) | yes |
| M27 | run-state.ts:60 | drop `#streamClosed = #closeStream()` in stop() | KILLED (3: cleanup SSE-close x3) | yes |
| M15 | adapter.ts:53 | drop abort-listener removal | KILLED (2: late abort no session abort, same-runId new run not cancelled) | yes |
| M22 | run.ts:101 | drop `!isCompleted` guard | KILLED (3: normal completion never aborts, late abort x2) | yes |

## New mutants
| id | file:line | change | result | public |
|---|---|---|---|---|
| A | event-mapper.ts:119 | exitCode read for any state, not only `completed` | SURVIVED (59 pass) | yes |
| B | run-state.ts:119 | allow -> `always` instead of `once` | KILLED (allow -> once test) | yes |
| C | adapter.ts:65 | unknown-permission message changed | KILLED (3) | yes |
| D | event-mapper.ts:29 | session filter lets session-less events through | SURVIVED (59 pass) | yes |
| E | adapter.ts:32 | duplicate runId message changed | KILLED (2) | yes |
| F | server.ts:34 | opts.env spread after OPENCODE_CONFIG_CONTENT | KILLED (config cannot be overridden) | yes |
| G | adapter.ts:89 | healthcheck failure prefix changed | KILLED (2) | yes |
| H | event-mapper.ts:176 | drop cache.write from inputTokens | KILLED (usage test) | yes |

## Survivors (block pass rule)
- A (PUBLIC): `error`-state tool part with integer `state.metadata.exit` would emit `exitCode` on the `completed` tool event. Existing test "error state completes without exitCode" (event-mapper.test.ts:104) uses an error fixture with NO metadata, so it cannot see the mutant. Spec baseline says error-state tool emits completed WITHOUT exitCode. Fix (test-only): add `metadata: { exit: 1 }` to the error fixture, keep expectation without exitCode.
- D (PUBLIC): events with no sessionID (non-error) are ignored today (line 29). Mutant forwards them: a session-less `session.idle` would emit a bogus `completed`, session-less `permission.asked` a bogus request. "events of other sessions and noise" test (event-mapper.test.ts:189) only has other-session events and noise that maps to nothing anyway. Fix (test-only): add session-less `session.idle`, `permission.asked`, tool part, `message.updated` (properties without sessionID) to that test, expect []. Keep session-less `session.error` fail-closed test (line 182).

## Acceptance checklist
- [x] Focused tests: 59 pass / 1 skip / 0 fail, run 3x, stable.
- [x] Full `bun test packages/adapters packages/agent-runtime packages/shared`: 557 pass / 1 skip / 0 fail.
- [x] `bun run typecheck`: all workspaces exit 0.
- [x] `bunx biome check .`: 205 files, clean.
- [x] pre.sha: only `test-support/fixture-server.ts` differs (allowed, SSE close observer). All other prod files identical.
- [x] Prod sha16 baselines: runtime 61e9e1237b6e85ef, attempt 3ea8b938965d8e47, mappers d413bd8c001c3f63 (prompt composer baseline bf926606e379e504 not re-hashed this round; file untouched by sweep).
- [x] Live smoke skipped unless `LIVE_OPENCODE=1` (`test.skipIf(!IS_LIVE)`), not run.
- [x] Only foreign `opencode serve` is pid 7271 (port 4097); no stray adapter servers.
- [x] 0 `*.bak` under packages/apps; only `.env.example` in apps.
- [x] Mongo `redhunter_test*` leftovers: `[]`.
- [x] No repo file changed permanently, no tests/prod added, no .omo plans/ledger/notepads touched.
- [ ] Mutation pass rule (no surviving public-behavior mutant): FAILED, A and D.

## Result
Round-1 fixes confirmed (4/4 killed). Two new public-behavior gaps found in event-mapper tests. Test-only fixes above; prod code needs no change. Re-verify with A and D after fix.
