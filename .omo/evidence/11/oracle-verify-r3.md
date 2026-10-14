VERDICT: confirmed

# T11 RH-ADAPTER-001 — oracle verification round 3 (final)

Baseline: `bun test packages/adapters/src/opencode` = 76 pass / 1 skip (live smoke) / 0 fail.
Method: sequential single-file mutation (runner `/tmp/opencode/t11-oracle-r3/mut.py`), backup in
`/tmp/opencode/t11-oracle-r3/orig/`, full opencode test suite per mutant, restore + `cmp` after each.
Raw output: `/tmp/opencode/t11-oracle-r3/mut.out`.

## Mutants

| id | file:line | mutation | result | scope |
|----|-----------|----------|--------|-------|
| A  | event-mapper.ts:119 | exitCode read from metadata.exit for any status (error carries exitCode) | KILLED (3 fail, filter.test) | public |
| D  | event-mapper.ts:29 | sessionID-less events processed instead of ignored | KILLED (9 fail, filter.test) | public |
| N1 | run-state.ts:119 | deny -> `once` instead of `reject` | KILLED (deny test) | public (request to server) |
| N2 | run-state.ts:128-129 | deny no longer fails run ("Permission <id> denied" dropped) | KILLED | public (events) |
| N3 | adapter.ts:36 | pre-aborted `input.signal` ignored | KILLED (3 fail) | public (signal honored) |
| N4 | run.ts:94 | failure error text replaced by constant | KILLED (unreachable/SSE/launch tests) | public (failed event) |
| N5 | config.ts:13 | sandbox `webfetch: deny` -> `ask` | KILLED (config test) | public (sandbox) |
| N6 | client.ts:25 | healthcheck accepts empty version | KILLED | public (healthcheck) |
| N7 | event-mapper.ts:160 | finalText join `\n` -> `` | KILLED | public (completed.finalText) |
| N8 | adapter.ts:95 | dispose() no longer cancels active runs | KILLED | public (dispose/cleanup) |
| N9 | event-mapper.ts:41 | session.idle emits no `completed` | KILLED (14 fail) | public |

Survivors: none. Notepad-only: none.

## Plan §8 / todo 11 acceptance check
- Fixture SSE -> normalized AdapterEvent sequence: covered (adapter.test, event-mapper tests).
- answerPermission POSTs `/session/{id}/permissions/{permissionID}` with once/reject: covered (N1/N2 killed).
- healthcheck returns version; empty/unreachable rejects: covered (N6).
- Unreachable server -> single `failed` event, iterator never throws: covered (N4).
- Lazy shared server, closed by dispose; failed launch not cached: covered (lifecycle tests, N8).
- Sandbox permission on agent + global default: covered (N5).
- Live smoke gated by LIVE_OPENCODE=1 (skipped here, as expected).
- Deviations all match accepted baselines (`/session` route, v2 names, spawnChild env allow-list,
  no `task` key, no SSE reconnect, v2 health client, error-state tool without exitCode). Nothing else off.

## Hygiene
- Production files: `cmp` identical to backup after every mutant; `sha256sum -c pre.sha` only
  test-support/fixture-server.ts FAILED (expected, round-2 test helper change).
- `*.bak` = 0; no `.env` created; `redhunter_test*` Mongo DBs = `[]`.
- Post-run suite: 76 pass / 1 skip / 0 fail. No processes left running; pid 7271 untouched.
