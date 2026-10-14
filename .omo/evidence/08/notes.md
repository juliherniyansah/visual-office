# T8 Adapter contract, FakeAdapter, spawnChild

## Files
- NEW `packages/shared/src/adapters.ts` (40 LOC): `PERMISSION_DECISIONS`, `PermissionDecisionSchema`,
  `AdapterRunInputSchema` (+ `AdapterRunInput` with non-serializable `signal?: AbortSignal`),
  `AgentAdapter` interface. Exported from `packages/shared/src/index.ts`.
- NEW `packages/shared/src/adapters.test.ts` (25 tests).
- NEW `packages/adapters/src/fake.ts` (126 LOC), `fake.test.ts` (14 tests).
- NEW `packages/adapters/src/spawn.ts` (192 LOC), `spawn.test.ts` (20 tests), `spawn.env.test.ts` (11 tests).
- NEW `packages/adapters/src/index.test.ts` (barrel, 1 test).
- MOD `packages/adapters/src/index.ts` (exports FakeAdapter + spawn API; no vendor code).
- MOD `packages/adapters/package.json`: `test: bun test`, dependency `@redhunter/shared: workspace:*`.
- MOD `bun.lock`: +3 lines (adapters workspace dependency block). `bun install` was needed to link
  `@redhunter/shared` into `packages/adapters/node_modules`; no new third-party packages
  ("Checked 151 installs ... (no changes)").

## Decisions
- `AdapterEventSchema`/`AdapterEvent` already existed from T2 (`packages/shared/src/schemas/adapter-event.ts`,
  used by `run_events` and `run.progress`). Reused, NOT duplicated; `adapters.test.ts` pins the
  8 variants in plan order with full-field round-trips and rejects (file untouched, sha unchanged).
- `AdapterRunInput` fields: `runId`, `agentId` (AgentId enum), `cwd`, `prompt`, optional `policy`
  (OmoPolicy), `outputSchema` (JSON-Schema object), `resumeVendorSessionId`; `signal` only on the TS type.
- FakeAdapter: default id `opencode`; script steps are events or `{event, delayMs}`; sleep injected,
  never called without delays (deterministic, no timers by default). `permission_request` is yielded then
  replay pauses until `answerPermission`; `allow` continues, `deny` yields
  `{type:'failed', error:'Permission <id> denied'}` and ends. Answer for unknown run / non-pending
  permission rejects `No pending permission <pid> for run <rid>`. `cancel()` / `signal.abort()` end the
  iterator with no terminal event; repeated/unknown cancel is a no-op. Second concurrent `start()` for
  the same runId throws; run released when the iterator finishes or consumer breaks.
- spawnChild uses `Bun.spawn` (`env` replaces process env entirely; verified by probe).
  - Env = DEFAULT_ENV_ALLOW_LIST (`PATH, HOME, LANG, TERM, TMPDIR`) from parent, then `opts.env` overrides,
    then FORBIDDEN names dropped last whatever the source. Forbidden match is case-insensitive:
    Linux env names are case-sensitive so `anthropic_auth_token` is a distinct var, stripped anyway
    (fail closed). Explicit env names must match `^[A-Za-z_][A-Za-z0-9_]*$` and values must not contain
    NUL, else `SpawnError('invalid_env')` before spawning (probe showed Bun accepts key `A=B` and
    would emit `ANTHROPIC_AUTH_TOKEN=secret=x` smuggling the forbidden name).
  - cwd: must be absolute, exist, be a directory, and its realpath must not be `/` (`/`, `//`,
    `<dir>/../../..`, symlink to `/` all rejected) -> `SpawnError('invalid_cwd')`. Closes T5 open item
    (repoPath `/` accepted at API layer; rejected at spawn).
  - `detached: true` (setsid) so the child leads its own process group; cancel signals `-pid`.
    cancel = SIGTERM to group, then SIGKILL after `DEFAULT_KILL_GRACE_MS = 5000` via injectable
    `setTimer(fire, ms) => clear`. Timer cleared on exit. Idempotent (single SIGTERM, same promise).
    Cancel after exit is a no-op returning the exit.
  - On leader exit the group is SIGKILLed (reaps leftover grandchildren; ESRCH/EPERM ignored).
  - `exited` resolves `{exitCode, signal}`; nonzero exit does not reject.
  - ENOENT (PATH lookup or absolute path) -> `SpawnError('not_found')`; other spawn errors
    (EACCES etc.) -> `spawn_failed`; synchronous Bun throw so no unhandled 'error' event.
  - Pre-aborted `signal` -> `SpawnError('aborted')` before spawning; later abort -> cancel().
  - stdout/stderr: line iterators; streaming UTF-8 decoder; `\n` split, trailing `\r` dropped;
    final line without newline emitted. stdin is `ignore` (plan: Claude adapter closes stdin).

## Deviations
- Prompt said `packages/shared/src/adapters.ts` holds `AdapterEvent` + `AdapterEventSchema`: they stay in
  the existing T2 module (re-exported from the same barrel), to avoid two sources of truth.
- `buildChildEnv` is internal (not exported) — only `spawnChild` is the public surface.
- No `inheritEnv` option (YAGNI): vendor keys are passed explicitly through `opts.env`.
- Large-output test uses 100k lines; "drain your pipes" documented on ChildHandle.

## TDD RED receipts (`red.txt`)
- shared: 3 fail (`PermissionDecisionSchema`/`AdapterRunInputSchema` = z.never stub); event-schema pins
  passed at RED because the schema pre-existed (regression pins, by design).
- fake: 13/13 fail against empty stub. spawn: 29/29 fail against throwing stub (`not implemented`).

## Mutation sweep (`mutation.txt`)
- 36 mutants over spawn.ts (allow-list, explicit env, forbidden strip, case, SIGKILL escalation,
  SIGTERM, grace value, timer clear, detached, group reap, idempotency, group vs pid, abort, cwd rules,
  ENOENT mapping, CRLF, tail line, streaming decoder) and fake.ts (order, drop events, default id,
  delay, gate allow, deny, permission id, cancel, concurrent start, release, abort, post-delay cancel).
- 36 killed, 0 survived. Each restored from `.bak` with sha256 compare (all OK). 0 `.bak` left.
- Flake check: 10 consecutive runs of `bun test packages/adapters` -> 46 pass every time.

## Verification
- `bun test packages/adapters packages/shared`: 145 pass, 0 fail (`test.txt`, `junit.xml` with names).
- `bun run typecheck`: 6/6 workspaces exit 0. `bunx biome check .`: 138 files, no fixes.

## Cleanup receipt
- No stray processes: `pgrep -f "sleep 30.808"` empty (tests also assert this in `afterAll`).
- Test temp dirs (`/tmp/rh-t8-*`) removed in `afterAll`; 0 left.
- 0 `.bak` files. No DBs touched. No git. Scratch kept: `/tmp/opencode/t8/` and
  `/tmp/opencode/t8probe/` (Bun behaviour probes, mutation runner).
