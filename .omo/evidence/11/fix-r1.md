# T11 fix round 1 (oracle-verify.md: REJECTED, 4 surviving mutants)

Result: test-only round. All 4 mutants are now killed. **No production code changed**: `sha256sum -c` against the
pre-fix baseline (`/tmp/opencode/t11fix/pre.sha`) shows every `packages/adapters/src/opencode/*.ts` OK. The only
changed pre-existing file is the test helper `test-support/fixture-server.ts`, which gains an SSE close observer.

## Defects -> tests

| Defect | Mutant (oracle id) | New test(s) | File |
|---|---|---|---|
| D1 completed-tool dedupe | M3 `event-mapper.ts:118` `this.#first(tool:${callId}:completed)` -> `true` | repeated completed updates for one callID emit exactly one completed tool event; completed then error for one callID emits exactly one completed tool event; completed dedupe is per callID: another call still completes | `event-mapper.dedupe.test.ts` |
| D2 SSE leak | M27 `run-state.ts:60` drop `this.#streamClosed = this.#closeStream()` | completed run closes its SSE connection from the client side; failed run (session.error) closes its SSE connection; cancelled run closes its SSE connection while a read is pending | `adapter.cleanup.test.ts` |
| D3 listener leak / late abort | M15 `adapter.ts:53` drop `input.signal?.removeEventListener('abort', onAbort)` | aborting the input signal after completion causes no session abort; aborting the signal of a finished run does not cancel a new run with the same runId | `adapter.cleanup.test.ts` |
| D4 abort after completion | M22 `run.ts:101` drop `if (!isCompleted)` | normal completion never aborts the session (abort count 0 + exact request log `POST /session`, `GET /event`, `POST .../prompt_async`) | `adapter.cleanup.test.ts` |

D2 observer: `FixtureServer.sseCounts()` returns `{opened, closedByClient}`, and `waitForClientClose(timeoutMs = 1000)`
resolves when `closedByClient === opened > 0`. `closedByClient` is incremented only in the SSE body
`ReadableStream.cancel()`. Probe `/tmp/opencode/t11fix/probe-cancel.ts` confirmed that Bun fires `cancel()` on a
client-side fetch abort (`{"opened":1,"closedByClient":1}`) and does NOT fire it when the script step `closeStream`
closes the stream server-side (`{"opened":1,"closedByClient":0}`). So the counter only reflects client-side closure.

## Red on mutant (command: `python3 /tmp/opencode/t11fix/mut.py`, restores each file from /tmp backup in `finally`)

```
M3 event-mapper.ts KILLED ['0 pass', '3 fail']
    (fail) repeated completed updates for one callID emit exactly one completed tool event
    (fail) completed then error for one callID emits exactly one completed tool event
    (fail) completed dedupe is per callID: another call still completes
M27 run-state.ts KILLED ['3 pass', '3 fail']
    (fail) completed run closes its SSE connection from the client side      (SSE not closed by client: {"opened":1,"closedByClient":0})
    (fail) failed run (session.error) closes its SSE connection
    (fail) cancelled run closes its SSE connection while a read is pending
M15 adapter.ts KILLED ['4 pass', '2 fail']
    (fail) aborting the input signal after completion causes no session abort
    (fail) aborting the signal of a finished run does not cancel a new run with the same runId
M22 run.ts KILLED ['3 pass', '3 fail']
    (fail) normal completion never aborts the session
    (fail) aborting the input signal after completion causes no session abort
    (fail) aborting the signal of a finished run does not cancel a new run with the same runId
```

After the sweep, `cmp` against the /tmp backups showed all 4 production files RESTORED, and `sha256sum -c` passed for
every production file.

## Green on original

- `bun test packages/adapters/src/opencode/event-mapper.dedupe.test.ts`: 3 pass, 0 fail.
- `bun test packages/adapters/src/opencode/adapter.cleanup.test.ts`: 6 pass, 0 fail.
- `bun run typecheck`: 6/6 exit 0.
- `bun test packages/adapters packages/agent-runtime packages/shared`: 557 pass, 1 skip (live smoke), 0 fail (was 548/1/0; +9).
- `bunx biome check .`: clean (205 files).
- `bun test packages/adapters/src/opencode` 5x: 59 pass / 1 skip / 0 fail every run.

Timing: "no request" assertions wait 50 ms (`NO_REQUEST_WAIT_MS`) through `waitForRequest(..., 50)`, which is
event-driven and rejects at the deadline. No other sleeps. Positive waits are event-driven and bounded at 1 s.

## Final LOC (`packages/adapters/src/opencode/`)

adapter.cleanup.test.ts 88, adapter.lifecycle.test.ts 123, adapter.test.ts 244, adapter.ts 127, client.ts 44,
config.test.ts 28, config.ts 24, event-mapper.dedupe.test.ts 51, event-mapper.test.ts 218, event-mapper.ts 188,
index.ts 10, live.smoke.test.ts 63, raw.ts 33, run-state.ts 147, run.ts 115, server.test.ts 109, server.ts 87,
types.ts 19, test-support/collect.ts 40, test-support/events.ts 126, test-support/fake-binary.ts 29,
test-support/fixture-server.ts 197 (was 161). All < 250.
