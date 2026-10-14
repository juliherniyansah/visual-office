VERDICT: confirmed. T12 meets all four acceptance items; 17/18 mutants killed; the 1 survivor (M1) is equivalent, with no public-behavior change.
| id | file:line | mutation | killed/survived | public-behavior? |
|---|---|---|---|---|
| M1 | headless/run.ts:~50 | drop `if (isFinished) return;` after terminal yield | SURVIVED | n (equivalent: runCli stop() then next stopReason/until check returns) |
| M2 | headless/run.ts exitError | `exitCode === 0` -> `=== 1` | killed (2) | y |
| M3 | headless/run.ts mapLine | malformed JSON line throws instead of skip | killed (2) | y |
| M4 | headless/run.ts finally | drop `launch?.cleanup()` | killed (1) | y |
| M5 | headless/adapter.ts healthcheck | ignore exitCode | killed (1) | y |
| M6 | headless/adapter.ts start | no duplicate-runId throw | killed (1) | y |
| M7 | headless/adapter.ts start | ignore pre-aborted signal | killed (1) | y |
| M8 | codex/event-mapper.ts | `status === 'declined'` negated | killed (5) | y |
| M9 | codex/event-mapper.ts usage | input_tokens -> cached_input_tokens | killed (1) | y |
| M10 | codex/event-mapper.ts | `error` line becomes terminal failed | killed (2) | y |
| M11 | claude/event-mapper.ts | subagent (non-main) text emitted | killed (1) | y |
| M12 | claude/event-mapper.ts usage | drop cache_read_input_tokens | killed (1) | y |
| M13 | claude/event-mapper.ts | file_change emitted on is_error tool_result | killed (1) | y |
| M14 | codex/config.ts | approval_policy on-request -> never | killed (2) | y |
| M15 | claude/settings.ts | drop WebFetch from deny | killed (1) | y |
| M16 | claude/settings.ts argv | drop `--disallowedTools "Bash(rm -rf*)"` | killed (2) | y |
| M17 | headless/files.ts | overwrite-refusal returns instead of throwing | killed (2) | y |
| M18 | codex/config.ts argv | no `--` guard for prompts starting with `-` | killed (1) | y |
DEFECTS: none.
Restoration: sha256sum -c of all 23 scoped files (headless/codex/claude incl. fixtures and tests) = 23 OK after the sweep. No .bak or scratch files left in the workspace; harness and backups are under /tmp/opencode only.

## Baseline (fresh run, 2026-10-11)
- `bun run typecheck`: exit 0 (all workspaces).
- `bun test packages/adapters/src/codex` 27 pass / 0 fail; `.../claude` 17 pass / 0 fail; `.../headless` 13 pass / 0 fail (total 57).
- `bun test packages/adapters`: 181 pass / 1 skip / 0 fail.
- `bunx biome check .`: 227 files, no fixes.

## Acceptance
1. Fixtures parse to expected events: codex/event-mapper.test.ts and claude/event-mapper.test.ts read the fixture files and do a full `toEqual` that includes usage (codex 1200/95; claude 450/80/costUsd 0.0123) and completed finalText. The adapter-level fixture tests assert the full event-type sequence, plus finalText (claude), argv, config.toml (codex) and stdin closed (claude). PASS.
2. Policy files: config.toml is exactly `approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n` (config.test + adapter.test). Claude settings.json allow/ask/deny/defaultMode is asserted in settings.test.ts:23-26. M14, M15 and M16 are killed. PASS.
3. Missing binary: healthcheck false plus a single `failed` event (claude/adapter.test.ts:96-103, codex/adapter.test.ts:105-109). PASS.
4. Fake binary exits 2: exactly `[{type:'failed', error:'<vendor> exited with code 2[: stderr]'}]` via toEqual (codex :82, claude :86). PASS.

## Section 8/13 review (code read)
- Codex argv: `exec [resume <id>] --json --ephemeral -C <cwd> -s workspace-write --ignore-user-config -o <file> [--output-schema f] [--] prompt`. Matches section 8. No yolo or bypass flags.
- Claude argv: `-p --output-format stream-json --permission-mode default --permission-prompts all --max-turns N --session-id <uuid> --settings f --append-system-prompt-file f --disallowedTools "Bash(rm -rf*)" <fixed query>`. Matches sections 8/13. The prompt is passed by file and never appears in argv.
- stdin: spawn.ts uses `stdin: 'ignore'` and the test checks `closed`. Env: spawn.ts allow-list (PATH, HOME, LANG, TERM, TMPDIR) and FORBIDDEN_ENV_NAMES strip ANTHROPIC_AUTH_TOKEN / WEBSOCKET_AUTH_FILE_DESCRIPTOR; asserted in claude/adapter.test.ts:67-78.
- Policy files: an existing differing policy file is never overwritten (files.ts writePolicyFile throws, and the run emits one failed event with nothing spawned). An identical file is reused. Relative-path and `/` cwd are rejected.
- Lifecycle: one terminal event; duplicate runId throws; unknown or late permission id throws; cancel/abort stops the run, kills the process group (spawnChild cancel) and cleans temp files in finally.

## Notes (non-defects)
- M1 survivor is equivalent. After a terminal yield, runCli calls run.stop(CANCELLED) before the consumer resumes. The loop's next `stopReason` check or `run.until` then returns with no events, and isFinished stays true, so the settle grace still applies. Both mappers put the terminal event last in their batch.
- Adapter-level fixture tests do not assert usage numerics (codex also does not assert finalText). This is covered by the mapper fixture tests on the same fixture files, and the adapter passes events through unchanged. Low-cost hardening, not required.
- Accepted per brief: `--permission-prompts all` kept verbatim (unverifiable without the binary); codex policy uses top-level keys, not a profile; claude resume is ignored (ponytail).
