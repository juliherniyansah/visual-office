# redhunter-master-plan - Planning Draft

slug: redhunter-master-plan
intent: clear
review_required: false
classification: Architecture
status: awaiting-approval
plan_path: .omo/plans/redhunter-master-plan.md

> Scaffold deviation: `scripts/scaffold-plan.mjs` requires a shell; this harness has no `bash` tool. Draft hand-built with the same fields. Plan will be hand-built with verbatim template headers after approval.

## Request (locked by user)

AI Company OS with 3D-first Virtual Office as primary interface. Backend/domain state is source of truth; 3D is projection only.

Core loop: CEO -> Directive -> COO/CTO -> Task -> Domain Agent -> Hermes + OMO -> Work -> Result -> Company State -> Virtual Office State -> 3D.

Permanent agents ONLY: CEO, COO, CTO, Programming, Game, IoT, AI Development. Everything else = skill / temp worker / OMO role.

Hermes = persistent identity + context layer (identity, role, personality, memory, RAG, knowledge, context, experience, skills).
OMO = shared orchestration (plan, delegate, execute, verify, retry, escalate). Prometheus = plan, Atlas = context, Sisyphus = execute. Not employees.
OpenCode / Codex / Claude CLI = tool adapters under Redhunter Agent Runtime, never agent identity.
Dynamic system prompt composition with precedence, token budget, versioning.
3D locked: 4-floor HQ, CEO top floor, dedicated Server Room / AI Core, semi-realistic cyberpunk human (human first). Floor layout NOT locked.
Stack to respect: Next.js, React, Three.js, R3F, Drei, Tailwind, shadcn/ui, Express, MongoDB/Mongoose, Socket.IO, Tailscale, Blender -> GLB.
Security: RBAC at backend/runtime. Prompt rules are not security boundaries.
Labels: EXISTING / REUSE / MODIFY / NEW / DEPRECATE / FUTURE on every recommendation.
Output: 28 numbered sections, MASTER BUILD ORDER, FIRST 10 CODING TASKS (fields per §29), OPEN DECISIONS (§35). No coding.

## Repo audit

`/home/programer/work/visual-office` is EMPTY greenfield (only `.codegraph/source.json`). No package.json, no src, no git. All 20 §27 checklist items ABSENT -> every recommendation is NEW unless it reuses an external tool. Audit section must say so explicitly.

Reference material outside repo (read-only): `/home/programer/work/opencode/` (OpenCode source, for CLI adapter research).

## Components ledger (topology — pending user confirmation)

| # | Component | Status | Notes |
|---|-----------|--------|-------|
| 1 | `apps/web` — Next.js + R3F Virtual Office client | NEW | 3D projection, dashboards (shadcn), Socket.IO client |
| 2 | `apps/api` — Express + Socket.IO + Mongoose | NEW | Company State source of truth, RBAC, event bus, REST |
| 3 | `packages/agent-runtime` — Redhunter Agent Runtime | NEW | agent lifecycle, prompt composer, adapter interface, OMO engine |
| 4 | `packages/hermes` — identity/context layer | NEW | identity, memory, RAG, skills registry, experience log |
| 5 | `packages/adapters` — OpenCode / Codex / Claude CLI | NEW | headless process adapters, normalized events |
| 6 | `assets/` — Blender -> GLB pipeline + `packages/shared` types | NEW | shared domain types/events, GLB export rules |

## Decisions ledger

- D1 Classification Architecture; intent CLEAR; review_required false (user did not request high accuracy).
- D2 Full scope: all 28 sections + build order + 10 tasks in ONE plan.
- D3 Draft/plan hand-built (no shell) — documented above.

## Open forks (candidate owner-decisions, to ask)

- F1 Monorepo layout -> RESOLVED (user): single repo, bun workspaces. Topology LOCKED (6 components).
- F2 Realtime transport -> RESOLVED default Socket.IO (see Research ledger).
- F3 Event persistence -> RESOLVED default outbox collection; change streams FUTURE.
- F4 CLI adapter mode -> RESOLVED default OpenCode SDK server + Codex/Claude headless CLI.
- F5 Floor layout -> RESOLVED (user): Option A Hierarchy stack. F1 Lobby + Server Room/AI Core; F2 domain agents open floor (Programming/Game/IoT/AI Dev); F3 COO/CTO ops + war room; F4 CEO. Options B/C still documented in plan §3D as rejected alternatives.
- F6 Test strategy -> RESOLVED (user): TDD. Failing test first per todo; 3D visual todos use screenshot/manual QA.
- F7 Package manager -> RESOLVED (user): bun workspaces (bun installed at /home/programer/.bun).

## Approval gate

status: awaiting-approval
next: user approves -> write .omo/plans/redhunter-master-plan.md -> metis gap analysis -> handoff

## Research ledger

Delegates (resume ids): explore `ses_ee31b934bffeBXw0CNitGVp6Yu` (OpenCode), librarian `ses_ee31b63b5ffepIsWbxyqe9PaP8` (Codex/Claude CLI), librarian `ses_ee31b2a2affeccHekqSueXLL71` (stack). All findings = claims from source/docs, not runtime-verified.

### OpenCode (installed, verified on disk)
- Binary `opencode-ai` v1.18.35 `/home/programer/.bun/install/global/node_modules/opencode-ai/bin/opencode.exe` (symlink `/home/programer/.bun/bin/opencode`).
- SDK `@opencode-ai/sdk` v1.18.13 at `/home/programer/.opencode/node_modules/@opencode-ai/sdk/`: `createOpencodeServer({hostname?,port?,signal?,timeout?,config?})`→`{url,close()}`, `createOpencodeClient({directory?})`, `createOpencode()`→`{client,server}`.
- HTTP: `POST /api/session`, `POST /api/session/{id}/prompt` (sync) / `/prompt-async`, `GET /api/event` SSE (`client.event.subscribe()`), `POST /api/session/{id}/permissions/{permissionID}` answers permission asks.
- Permission schema per agent: `edit|bash|webfetch|task|doom_loop|external_directory|<tool>: ask|allow|deny`; bash accepts pattern map. Config `opencode.json` (`plugin[]`, `agent{}`); AGENTS.md injected by OMO hooks.
- OMO plugin `oh-my-openagent` ~4.19 at `/home/programer/.cache/opencode/packages/oh-my-openagent@latest/node_modules/oh-my-openagent/dist/`: `createPluginInterface({ctx,pluginConfig,managers,hooks,tools})`, 19 hooks (preemptiveCompaction, rulesInjector, contextInjectorMessagesTransform, modelFallback, atlasHook…), agents sisyphus/sisyphus-junior/hephaestus/oracle/prometheus/atlas/momus/metis/librarian/explore/multimodal-looker; config `oh-my-openagent.json`; artifacts `.omo/plans/`, `.omo/drafts/`.
- UNVERIFIED: session event names beyond `server.instance.disposed`, `installation.*`, `lsp.*` → read SDK `types.gen.d.ts` in RH-ADAPTER task. `codex` / `claude` binaries NOT found installed.

### Codex CLI (rust-v0.155.1, docs)
- `codex exec` flags: `--json` (JSONL), `--ephemeral`, `--output-schema FILE`, `-o/--output-last-message`, `-m`, `-C DIR`, `-s read-only|workspace-write|danger-full-access`, `--approve-for-me`, `--yolo`, `--profile`, `--ignore-user-config`; subcommands `resume`, `fork`, `review`.
- JSONL events: `thread.started{thread_id}`, `turn.started|completed{usage,final_response}|failed`, `item.started|updated|completed` item types `agent_message|command_execution{exit_code,status}|file_change|reasoning|mcp_tool_call|web_search|todo_list|error`, top-level `error`.
- Config `~/.codex/config.toml` (+ `./.codex/config.toml`, profiles): `sandbox_mode`, `approval_policy never|on-request|on-failure|untrusted`, `[model_providers]`. Auth `CODEX_API_KEY`/`OPENAI_API_KEY` > `~/.codex/.credentials.json`.
- SDK `@openai/codex-sdk`: `new Codex({apiKey})`, `startThread()`/`resumeThread(id)`, `thread.run()` / `thread.runStreamed(input,{outputSchema,signal})` → `for await (ev of stream.events)`.

### Claude Code (v2.1.x, docs)
- `claude -p` flags: `--output-format text|json|stream-json`, `--input-format`, `--allowedTools`, `--disallowedTools`, `--permission-mode default|acceptEdits|bypassPermissions|plan|dontAsk|auto`, `--dangerously-skip-permissions`, `--permission-prompts all|none`, `--append-system-prompt`, `--system-prompt`, `--max-turns`, `--resume ID`, `--session-id`, `--model`, `--mcp-config`, `--settings`, `--bare`.
- stream-json: `system`(init, session_id, model), `user`, `assistant`, `result{subtype success|error_*, structured_output, total_cost_usd, usage, duration_ms}`.
- Settings precedence managed > `~/.claude/settings.json` > `.claude/settings.json` > `.claude/settings.local.json` > `--settings`; `permissions.{allow,ask,deny}` rules `Tool` / `Tool(pattern)`. Auth `ANTHROPIC_API_KEY` > `ANTHROPIC_AUTH_TOKEN` > `~/.claude/.credentials.json`.
- Agent SDK `query({prompt,cwd,allowedTools,maxTurns,model,env,outputFormat})` async-iterable; `canUseTool`/PreToolUse allow|ask|deny; AbortSignal cancel.
- Pitfalls: close stdin for `claude -p`; separate session per parallel worker; scrub `ANTHROPIC_AUTH_TOKEN`/`WEBSOCKET_AUTH_FILE_DESCRIPTOR` from child env; hooks off in headless/bare; SIGTERM leaves session resumable; `--max-turns` hard cap.

### Stack
- Mongo change streams need replica set (single-node `--replSet rs0` + `rs.initiate()` ok local/Docker); resume tokens; at-least-once; Mongoose `Model.watch()`.
- Socket.IO v4: namespaces+rooms, `io.use()` JWT handshake, Redis adapter only multi-instance, `connectionStateRecovery`; run on separate Express server with CORS credentials, not inside Next.js.
- R3F v9 ↔ React 19 (v10 alpha = WebGPU); `'use client'` + `dynamic(...,{ssr:false})`; InstancedMesh; `useGLTF` + Draco/Meshopt; `useAnimations`; `frameloop='demand'`; zustand transient subscriptions.
- UNVERIFIED (defaults from knowledge, flag in plan): Blender glTF export (apply transforms, +Y up, `gltf-transform` v4.5 draco/meshopt/ktx2, Mixamo rig, NLA strips→clips, ~10-20k tris/char, 1-2k textures); Turborepo+pnpm (`transpilePackages`) vs bun workspaces; vector store LanceDB / sqlite-vec vs Atlas Vector Search; embeddings OpenAI/Voyage/Ollama.

### Defaults adopted from research
- F2 → Socket.IO (confirmed fit; raw WS gives nothing extra here).
- F4 → OpenCode via SDK `createOpencodeServer` + HTTP/SSE (installed, richest control); Codex via `codex exec --json`, Claude via `claude -p --output-format stream-json` headless processes; their SDKs = FUTURE. Adapter emits normalized event union.
- F3 → explicit `events` outbox collection + in-process dispatcher (no replica-set requirement for dev); Mongo change streams = FUTURE for multi-instance.


