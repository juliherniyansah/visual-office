# T11 fix round 2 (oracle-verify-r2.md: REJECTED, survivors A and D, both PUBLIC)

Test-only round. **No production change.** `event-mapper.ts` is byte-identical to the pre-round backup
(`cmp /tmp/opencode/t11fix2/event-mapper.ts` OK). `sha256sum -c /tmp/opencode/t11fix/pre.sha` flags only
`test-support/fixture-server.ts` (the round-1 observer, as allowed).

## Defects

- **A** `event-mapper.ts:119`: exitCode is read from `state.metadata.exit` only for `status === 'completed'`. A mutant
  that reads it for any state survived because the error-state fixture had no metadata.
  Baseline: an error-state tool emits a `completed` tool event WITHOUT `exitCode`.
- **D** `event-mapper.ts:29`: events without a sessionID (except `session.error`, which fails closed) are ignored. A
  mutant that forwards them survived because no fixture was session-less.

## Tests added: `packages/adapters/src/opencode/event-mapper.filter.test.ts` (138 LOC, 17 tests)

`describe('error-state tool never carries exitCode')`:
- `test.each` error state with `metadata.exit` = integer 1, integer 0, non-integer 1.5, string "1" -> `completed`
  with no `exitCode` key (`toEqual` without the key, plus `'exitCode' in event === false`).
- Control: the same metadata on a `completed` state yields `exitCode: 1`, which proves the fixture carries a live
  exit.
- Error first, then completed with exit 0: the single `completed` event has no exitCode.
- A running state with `metadata.exit` gives a `started` event without exitCode.

`describe('events without a sessionID are ignored (only session.error fails closed)')`:
- `test.each` over session.idle, permission.asked (v2), permission.updated (v1), tool part, patch part and
  step-finish part. Each case builds a session-less copy with `withoutSession()`, which deletes `sessionID` at
  every level `sessionOf()` reads (properties, part, info). It then asserts:
  1. The valid event JSON contains `"sessionID"` and the session-less copy does not, so sessionID is the only
     difference.
  2. Control: the valid event maps to the expected types (`completed`, `permission_request`, `tool`+`tool`,
     `file_change`, `usage`).
  3. The session-less copy maps to `[]`.
- session.idle with an empty-string sessionID maps to `[]`.
- A session-less `message.updated` does not register the assistant message. Control: with sessionID, the following
  text part emits `text`; without it, `[]`.
- A session-less `message.part.delta` adds no text (control emits `text: 'hi'`).
- A fully session-less run (assistant, text, permission.asked, idle) yields `[]`.
- The existing fail-closed session-less `session.error` test (event-mapper.test.ts) is untouched.

## RED proof (`python3 /tmp/opencode/t11fix2/mut.py`, in-place mutants, restored in `finally`, then `cmp` OK)

| mutant | change | old suites (event-mapper + dedupe) | new filter test |
|---|---|---|---|
| A | `const exit = asRecord(state.metadata)?.exit;` (any state) | SURVIVED 19/0 | **KILLED** 14 pass / 3 fail |
| A2 | `status !== 'running' ? ...exit` | SURVIVED 19/0 | **KILLED** 14 pass / 3 fail |
| D | `if (session !== undefined && session !== this.#sessionId) return [];` | SURVIVED 19/0 | **KILLED** 8 pass / 9 fail |
| D2 | filter line removed entirely | KILLED 18/1 | **KILLED** 7 pass / 10 fail |
| D3 | let `undefined` and `''` through | SURVIVED 19/0 | **KILLED** 7 pass / 10 fail |

Failing tests under A: error state with metadata.exit integer 1, integer 0, and error-first-then-completed.
Under D: all 6 session-less `test.each` cases, plus message.updated, message.part.delta and the whole-run test.
D3 additionally fails the empty-sessionID test. Full output: `/tmp/opencode/t11fix2/mut.out`.
After the sweep: `restored True`, `cmp` OK.

## Verify (from /home/programer/work/visual-office)

- `rtk bun run typecheck`: 6/6 `Exited with code 0`.
- `bun test packages/adapters packages/agent-runtime packages/shared`: **574 pass / 1 skip / 0 fail** (was 557, +17).
- `rtk bunx biome check .`: clean (206 files).
- `bun test packages/adapters/src/opencode` 5x: 76 pass / 1 skip / 0 fail every run.
- `sha256sum -c /tmp/opencode/t11fix/pre.sha`: only `test-support/fixture-server.ts` FAILED (expected).
- `/usr/bin/find packages -name "*.bak" -not -path "*/node_modules/*"`: 0. No new `.env`.
- `mongosh mongodb://127.0.0.1:27017` listDatabases filter `/^redhunter_test/`: `[]`.
- No `opencode serve --port=0` process left; the foreign pid 7271 was untouched.
