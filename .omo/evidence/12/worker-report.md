# T12 RH-ADAPTER-002 worker report

## Files (LOC)
- `packages/adapters/src/headless/` (shared runner, NEW): `types.ts` 30, `run-state.ts` 50, `run.ts` ~125, `adapter.ts` ~115, `files.ts` 37, `adapter.lifecycle.test.ts` 166, `test-support/fake-cli.ts` ~55
- `packages/adapters/src/codex/`: `adapter.ts` 16, `config.ts` ~80, `event-mapper.ts` 146, `index.ts`, tests `event-mapper.test.ts` 195, `config.test.ts` ~95, `adapter.test.ts` ~120, fixture `test-support/codex.jsonl`
- `packages/adapters/src/claude/`: `adapter.ts` 18, `settings.ts` ~95, `event-mapper.ts` 182, `index.ts`, tests `event-mapper.test.ts` 180, `settings.test.ts` ~95, `adapter.test.ts` ~135, fixture `test-support/claude.stream.jsonl`
- Modified: `src/index.ts`, `src/index.test.ts` (barrel exports + test). No T11/shared/runtime/spawn/fake file touched.
- All files < 250 LOC.

## Verification
- `bun run typecheck` exit 0; `bunx biome check .` clean.
- `bun test packages/adapters packages/agent-runtime packages/shared`: 632 pass, 1 skip, 0 fail.
- Evidence `.omo/evidence/12/test.txt`: 57 pass / 0 fail (codex + claude + headless dirs).
- Bounded mutation pass on `headless/run.ts` + `adapter.ts`: 9 mutants, 6 killed first round; 3 survivors (stop-before-terminal-yield, abort-listener removal, cancel frees runId) got targeted tests, then killed. Originals restored, sha256 verified.

## Design
- `HeadlessAdapter(vendor)` holds the AgentAdapter lifecycle (duplicate runId, cancel, signal, permission bookkeeping, healthcheck); `CodexAdapter`/`ClaudeAdapter` are thin subclasses binding a `HeadlessVendor {id, defaultBinary, prepare(input) -> {args, mapper, cleanup}}`.
- Spawn via `spawnChild` only (env allow-list, forbidden names stripped, stdin 'ignore' = closed, process-group kill). Env only via `options.env`.
- Stream never throws: spawn error / missing binary / nonzero exit / exit 0 without result / prepare failure -> exactly one `failed`. Malformed/blank stdout lines skipped.
- After `completed`/`failed` the child gets `EXIT_GRACE_MS` (2 s) to exit, then its group is killed. Temp files (schema, settings, prompt) in a per-run `mkdtemp` dir, removed in finally.
- `healthcheck()`: `<binary> --version` exit 0 within 5 s -> true; else false (never throws).

## Assumptions about synthetic fixtures (binaries not installed, OPEN DECISION 5)
- Codex JSONL shape taken from upstream source `codex-rs/exec/src/exec_events.rs` (ThreadEvent: `thread.started{thread_id}`, `turn.completed{usage}`, `turn.failed{error.message}`, `item.*{item:{id,type,...}}`, `error{message}`); item types agent_message/reasoning/command_execution/file_change/mcp_tool_call/web_search/todo_list/error.
- Claude stream-json shape from Agent SDK TS reference (SDKSystemMessage init, SDKAssistantMessage, SDKUserMessage tool_result, SDKResultMessage with permission_denials, system/permission_denied, system/api_retry).
- Usage: codex `input_tokens`/`output_tokens` only (cached/reasoning are subsets per OpenAI usage semantics). Claude: input + cache_creation + cache_read; `total_cost_usd` -> costUsd.

## Deviations / open points (for oracle)
1. Permission model: both CLIs in headless mode have NO reply channel. Codex exec rejects approval requests itself (upstream `reject_server_request` "approval is not supported in exec mode"); claude `-p` without a host denies `ask` calls. So `permission_request` is emitted AFTER the fact (codex: `command_execution` status `declined`; claude: `system/permission_denied` or `result.permission_denials`), the run continues, and `answerPermission` only records allow/deny in `run.decisions` (documented in code). A real round-trip needs the vendor SDKs (plan: FUTURE swap).
2. Codex `.codex/config.toml` has top-level `approval_policy = "on-request"` + `sandbox_mode = "workspace-write"`, NOT a `[profiles]` table: current codex docs say `profile`/`profiles` are ignored in a project-local config. Also codex loads project config only for trusted projects and `--ignore-user-config` is in argv, so the file is policy-of-record; CLI `-s workspace-write` is the effective sandbox. Existing differing file -> refuse to overwrite -> `failed`.
3. Claude argv: `--disallowedTools "Bash(rm -rf*)"` added (section 13). Composed prompt goes ONLY to `--append-system-prompt-file`; positional query is a fixed `CLAUDE_TASK_QUERY` (prevents flag injection / ps leak). `--verbose` NOT added (not in plan); upstream docs show `--verbose` alongside stream-json examples - verify on install.
4. `--permission-prompts all` kept verbatim from plan, but current docs list values `host|none`; `all` may be rejected by the real CLI. Not changed (no invented flags). Owner must confirm.
5. Claude resume: `resumeVendorSessionId` ignored (plan lists no claude resume flag); `ponytail:` comment marks it.
6. Claude settings: `allow [Bash(bun test*), Bash(git status*)]`, `ask [Bash, Edit, MultiEdit, Write, NotebookEdit]`, `deny [Bash(rm -rf*), WebFetch]`, `defaultMode default` (mirrors opencode section 13 policy).
7. Codex prompt starting with `-` is passed after `--`.
8. TDD: mappers/configs strictly RED->GREEN (stubs failing on behavior). Headless runner was written before its tests; compensated by the mutation pass above.
9. Evidence file covers codex + claude + headless dirs (superset of the requested command).
10. No live smoke test added (binaries absent).
