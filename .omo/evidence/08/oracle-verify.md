VERDICT: confirmed

# T8 oracle verification (independent, 1 round)

## Baseline (all green, rerun by me)
- `bun test packages/adapters`: 46 pass / 0 fail (55 consecutive reruns, 0 flakes)
- `bun test packages/shared`: 99 pass; `bun run typecheck`: 6/6 exit 0; `bunx biome check .`: 138 files, clean
- Contract: `AgentAdapter`/`AdapterEvent` (8 variants, fields match plan section 8) + `AdapterEventSchema` exported via `packages/shared/src/index.ts` (`export * from './adapters'`); adapters imports types only from `@redhunter/shared`.

## Acceptance
(i) FakeAdapter ordered replay: PASS (reverse/skip mutants killed). (ii) env allow-list + strip: PASS (probe: child env = HOME,LANG,PATH,TERM only; `anthropic_auth_token`, `Websocket_Auth_File_Descriptor`, `ANTHROPIC_AUTH_TOKEN` via opts.env and parent env all absent; SECRET_X absent). (iii) SIGTERM to group, SIGKILL after 5000 ms via injected timer: PASS (probe: timer ms=5000, child ignoring TERM stays alive until timer fired, then SIGKILL). (iv) leak test present and kills mutants. (v) types exported from shared: PASS.

## Defects
None.

## Mutation sweep (restored each time; no `.bak` left; sha256 of 10 production/test files identical before/after)
| # | Site | Mutant | Result |
|---|------|--------|--------|
| 1a | allow-list | inherit all process.env | killed (3 fail) |
| 1b | allow-list | drop HOME | killed (4) |
| 1c | allow-list | ignore opts.env | killed (2) |
| 2a | forbidden strip | filter removed | killed (1) |
| 2b | forbidden strip | case-sensitive | killed (1) |
| 2c | forbidden strip | extra/inherited order swapped | killed (1) |
| 2d | forbidden list | drop WEBSOCKET name | killed (1) |
| 3a | SIGKILL escalation | no-op timer body | killed (2) |
| 3b | grace | 5000 -> 1000 | killed (2) |
| 3c | SIGTERM | removed | killed (4) |
| 3d | group kill | pid instead of -pid | killed (5) |
| 3e | timer clear | removed | killed (2) |
| 4a | Fake ordering | reverse | killed (1; first anchor pattern had a mismatch, rerun OK) |
| 4b | Fake ordering | skip first | killed (14) |
| 5a | permission gating | no pause | killed (5) |
| 5b | deny continues | never fails | killed (2) |
| 5c | allow fails | inverted | killed (4) |
| 5d | deny non-terminal | no return after failed | killed (1) |
18/18 killed.

## Adversarial probes (all as expected)
opts.env name with `=` / empty name -> SpawnError invalid_env; cwd `/`, relative, missing, file -> invalid_cwd; missing binary -> SpawnError `not_found`; pre-aborted signal -> `aborted`; abort mid-run -> SIGTERM exit; cancel twice -> same exit, single SIGTERM; exit 7 -> exitCode 7 (no reject); CRLF / no trailing newline -> ["a","b"]; large output covered by existing test.

## Notepad-only (no rejection)
- Case-insensitive strip also drops lowercase `anthropic_auth_token` (documented fail-closed, harmless).
- FakeAdapter cancel ends iterator without terminal event (documented design).
- Vendor API keys must be injected via `opts.env` by T11/T12; large child output must be drained by caller (documented).
- No cancel-before-spawn API exists on spawnChild (cancel only via handle/signal); pre-aborted signal covers it.
