# redhunter-master-plan - Work Plan

## TL;DR (For humans)

This plan builds REDHUNTER from an empty repo: an AI Company OS whose primary interface is a 3D virtual office. Backend state (MongoDB + an `events` outbox) is the single source of truth; the 3D office is a read-only projection that never writes domain state. The core loop the plan implements is CEO -> Directive -> COO/CTO -> Task -> Domain Agent -> Hermes + OMO -> Work via an adapter (OpenCode SDK, `codex exec --json`, `claude -p --output-format stream-json`, plus a FakeAdapter for tests) -> Result -> Company State -> Office State -> 3D. Only seven permanent agents exist (`ceo`, `coo`, `cto`, `programming`, `game`, `iot`, `ai_development`); everything else is a Hermes skill or a transient OMO worker rendered as a drone.

End state: a single bun-workspace repo (`apps/web`, `apps/api`, `packages/agent-runtime`, `packages/hermes`, `packages/adapters`, `packages/shared`, `assets/`) where one `apps/api` process hosts REST `/api/v1`, Socket.IO `/office`, and the agent runtime; a Next.js 15 + R3F web app renders the Option A four-floor office (Lobby/AI Core, domain agents, COO/CTO war room, CEO) driven live by `office_state`; RBAC is enforced at API and runtime (prompt rules are not security boundaries); everything is Tailscale-only.

Work is 20 implementation todos plus 4 final verifiers, grouped into 5 waves: Foundation (shared types, API skeleton, Mongo + outbox), Brain (Hermes, agent runtime, OMO integration), Hands (adapters), Face (web shell, 3D office, dashboards), Polish (observability, recovery, perf budgets). Every todo is TDD: failing test first, minimal implementation, QA evidence captured under `.omo/evidence/<n>/`, one conventional commit per todo, branch per wave, no push/PR without owner confirmation.

Locked decisions: greenfield (all components NEW); reuse OpenCode v1.18.35 + `@opencode-ai/sdk` 1.18.13, oh-my-openagent ~4.19, Codex CLI, Claude Code CLI; outbox + in-process dispatcher (change streams and a separate worker process are FUTURE). Open decisions still owed to the owner (see `## OPEN DECISIONS`): vector store, embedding model, Blender export flags, Tailscale exposure details, codex/claude binary availability, and OpenCode SSE event names to confirm against `types.gen.d.ts`. None of these block Wave 1.

## Scope

Plan artifact for REDHUNTER: an AI Company OS whose primary interface is a 3D-first Virtual Office.
Repo `/home/programer/work/visual-office` is empty greenfield (only `.codegraph/source.json`). Every component below is **NEW** unless labeled otherwise. External tools reused as adapters: OpenCode v1.18.35 + `@opencode-ai/sdk` v1.18.13 (**REUSE**), oh-my-openagent plugin ~4.19 (**REUSE**), Codex CLI (**REUSE**, install unverified), Claude Code CLI (**REUSE**, install unverified).

Labels used everywhere: EXISTING / REUSE / MODIFY / NEW / DEPRECATE / FUTURE.
Claims marked UNVERIFIED come from training knowledge, not from research in this session.

Locked by user: permanent agents only CEO, COO, CTO, Programming, Game, IoT, AI Development; Hermes = persistent identity/context layer; OMO = shared orchestration (Prometheus plan, Atlas context, Sisyphus execute); CLIs are tool adapters not identities; 4-floor HQ, CEO top floor, Server Room / AI Core, semi-realistic cyberpunk human ("Human first, cyberpunk second"); backend state is source of truth, 3D never is; RBAC at backend/runtime; "Prompt rules are not security boundaries"; stack Next.js/React/Three.js/R3F/Drei/Tailwind/shadcn/Express/MongoDB+Mongoose/Socket.IO/Tailscale/Blender->GLB; TDD; bun workspaces; floor layout Option A.

### 1. Executive summary

REDHUNTER = Company State machine (Express + Mongo) driving an agent runtime (Hermes identity + OMO orchestration + CLI adapters) whose outputs feed a Virtual Office projection rendered by Next.js + R3F. Core loop: CEO -> Directive -> COO/CTO -> Task -> Domain Agent -> Hermes + OMO -> Work (via adapter) -> Result -> Company State -> Virtual Office State -> 3D. Every arrow is a persisted domain event. The 3D client only subscribes; it never writes domain state.

### 2. Product vision and non-goals

Vision: one human CEO (user) runs a company of 7 permanent AI employees from a 3D HQ; dashboards (shadcn) exist for depth, the office exists for presence and situational awareness.
Non-goals (v1): multiplayer humans, VR/XR, voice, mobile client, SaaS multi-tenant, public internet exposure (Tailscale only), realistic physics, fully autonomous spending.

### 3. System architecture (NEW, single bun workspace)

| Component | Path | Role | Label |
|---|---|---|---|
| Web client | `apps/web` | Next.js 15 App Router, React 19, R3F v9, Drei, Tailwind, shadcn/ui, Socket.IO client, zustand | NEW |
| API | `apps/api` | Express + Socket.IO server + Mongoose; Company State source of truth; RBAC; REST; event outbox dispatcher | NEW |
| Agent runtime | `packages/agent-runtime` | agent lifecycle, prompt composer, adapter interface, OMO engine, run supervisor | NEW |
| Hermes | `packages/hermes` | identity, role, personality, memory, RAG, skills registry, experience log, context assembly | NEW |
| Adapters | `packages/adapters` | OpenCode (SDK server + HTTP/SSE), Codex (`codex exec --json`), Claude (`claude -p --output-format stream-json`) -> normalized event union | NEW |
| Shared | `packages/shared` | TS types, zod schemas, event names, RBAC roles, constants | NEW |
| Assets | `assets/` | Blender sources + exported GLB + gltf-transform pipeline scripts | NEW |

Process topology (v1): one `apps/api` process hosts REST + Socket.IO + agent-runtime in-process (runtime imported as package; separate worker process = FUTURE). One `apps/web` Next.js process. MongoDB standalone (replica set FUTURE when change streams adopted). All reachable only on Tailscale interface.

### 4. Core loop (state machine)

```
Directive(draft) -> Directive(issued by CEO agent or human)
  -> Task(planned by COO|CTO)  -> Task(assigned: agentId)
  -> Run(queued) -> Run(composing) -> Run(executing: adapter) -> Run(verifying)
  -> Run(succeeded | failed | escalated)
  -> Result(recorded) -> CompanyState(projected) -> OfficeState(derived) -> 3D (rendered)
```
Each transition = one `DomainEvent` row in `events` outbox (section 11). Retry/escalate rules live in OMO policy (section 7). Human can intervene at any `Run` state via API (`pause`, `cancel`, `answerPermission`).

### 5. Agent model (permanent roster)

Collection `agents` (seeded, immutable ids): `ceo`, `coo`, `cto`, `programming`, `game`, `iot`, `ai_development`.
Fields: `id`, `title`, `reportsTo`, `floor`, `deskSlot`, `hermesProfileId`, `allowedAdapters[]`, `capabilityTags[]`, `status` (`idle|thinking|working|blocked|waiting_permission|offline`), `currentRunId?`.
Reporting: CEO -> COO (ops, task routing, verification) and CTO (technical planning, architecture); COO/CTO -> four domain agents.
NOT permanent (explicitly): backend/frontend/QA/reviewer/research/architect/devops. These are Hermes **skills** attached to a permanent agent, or **temporary workers** (OMO subagents: sisyphus-junior, oracle, explore, librarian) spawned inside a Run and discarded. Temp workers never get `agents` rows; they appear in 3D as transient "drones" bound to the parent agent's desk (section 15).

### 6. Hermes - persistent identity/context layer (NEW)

Package `packages/hermes`. Not "just memory". Modules:
- `identity`: `HermesProfile` {agentId, name, role, personalityTraits, voiceGuidelines, constitutionRef, version}. Stored in Mongo `hermes_profiles`, versioned (append-only, `activeVersion` pointer).
- `memory`: episodic (`hermes_memories`: {agentId, runId?, kind: episodic|semantic|procedural, text, embedding?, importance, createdAt, ttl?}), working memory per Run (in-process, flushed to episodic at Run end with summary).
- `rag`: `KnowledgeStore` interface {upsert(doc), search(query, k, filter)}. v1 impl = `InMemoryKnowledgeStore` (BM25-style keyword) hydrated from `knowledge_docs` at boot; Mongo text index + embedding cosine FUTURE (vector store choice = OPEN DECISION 1). Documents: company docs, project READMEs, past results.
- `skills`: `hermes_skills` registry {id, name, markdown, appliesToRoles[], tags[]}; selected by task capability tags; rendered into prompt layer 5.
- `experience`: `hermes_experience` {agentId, taskType, outcome, lessons[], runId}; summarized by OMO verify step; feeds prompt layer 6.
- `context`: `assembleContext(agentId, task, budget)` returns ordered layers for the composer (section 9) with per-layer token estimates.
Hermes is read/written only by agent-runtime; API exposes read-only views for dashboards.

### 7. OMO - shared orchestration engine (NEW, modeled on oh-my-openagent roles)

Package `packages/agent-runtime/src/omo`. Roles are functions, not employees:
- `prometheus.plan(task, ctx)` -> `WorkPlan` {steps[], acceptance[], risk}.
- `atlas.context(task, ctx)` -> curated repo/project context (uses Hermes rag + adapter read-only run).
- `sisyphus.execute(step, adapter)` -> streams adapter events, produces `StepResult`.
- `verify(result, acceptance)` -> pass|fail with evidence; `retry` policy (max 2, backoff), `escalate` to COO/CTO then human (creates `Decision` request event).
Policy object `OmoPolicy` {maxRetries, maxTurns, budgetTokens, allowedTools, escalationChain[]} per agent, stored in `agents.omoPolicy`, overridable per Task by COO/CTO only (RBAC).
When adapter = OpenCode, OMO can delegate planning/execution to the real oh-my-openagent agents (prometheus/sisyphus) inside the OpenCode session (REUSE); for Codex/Claude adapters the in-house functions run. Interface identical.

### 8. Tool adapters (NEW; vendors REUSE)

`packages/adapters/src/types.ts`:
```ts
interface AgentAdapter {
  id: 'opencode' | 'codex' | 'claude';
  start(input: AdapterRunInput): AsyncIterable<AdapterEvent>;
  answerPermission(runId, permissionId, decision: 'allow'|'deny'): Promise<void>;
  cancel(runId): Promise<void>;
}
type AdapterEvent =
  | {type:'started', vendorSessionId}
  | {type:'text', text}
  | {type:'tool', name, input, status:'started'|'completed', exitCode?}
  | {type:'file_change', path, kind}
  | {type:'permission_request', permissionId, tool, detail}
  | {type:'usage', inputTokens, outputTokens, costUsd?}
  | {type:'completed', finalText, structured?}
  | {type:'failed', error};
```
- OpenCode adapter: `createOpencodeServer({port, config})` once per api process; per run `POST /api/session`, `POST /api/session/{id}/prompt-async`, consume `GET /api/event` SSE via `client.event.subscribe()`; permissions via `POST /api/session/{id}/permissions/{permissionID}`. Permission policy injected via `config.agent.<name>.permission` (`edit|bash|webfetch|task|doom_loop|external_directory: ask|allow|deny`). Event name mapping must be verified against `@opencode-ai/sdk` `types.gen.d.ts` (todo 7).
- Codex adapter: spawn `codex exec --json --ephemeral -C <cwd> -s workspace-write --ignore-user-config -o <file> [--output-schema]`, parse JSONL `thread.started|turn.*|item.*|error`. Approval via `approval_policy` in a generated `./.codex/config.toml` profile. Resume via `codex exec resume <thread_id>`.
- Claude adapter: spawn `claude -p --output-format stream-json --permission-mode default --permission-prompts all --max-turns N --session-id <uuid> --settings <generated.json> --append-system-prompt-file`, close stdin, parse `system|assistant|user|result`. Env: strip `ANTHROPIC_AUTH_TOKEN`, `WEBSOCKET_AUTH_FILE_DESCRIPTOR`. Permissions via generated settings `permissions.{allow,ask,deny}`.
- Vendor SDKs (`@openai/codex-sdk`, Claude Agent SDK) = FUTURE swap behind same interface.
Adapter never receives Hermes data directly; it receives a composed prompt + sandbox cwd + permission policy.

### 9. Dynamic system prompt composition (NEW)

`packages/agent-runtime/src/prompt/composer.ts`. Layers in precedence order (lower index wins on conflict; later layers may not override earlier):
1. Base constitution (company-wide, versioned, Hermes `constitution` doc)
2. Agent identity (Hermes profile)
3. Role + company + security policy (what this role may/may not do; explicitly states tool permissions are enforced outside the prompt)
4. OMO policy (plan/verify/escalate expectations, output contract)
5. Skills (selected by task tags, max K)
6. Memory + experience (top-N by importance/recency, summarized)
7. RAG snippets (top-k by task query)
8. Project context (Atlas output: repo map, conventions)
9. Task (directive, acceptance, constraints)
Token budget: `budgetTokens` from OmoPolicy; fixed reserve for layers 1-4 and 9; layers 5-8 truncated proportionally (priority 9>5>8>6>7). Composer output `{text, layers:[{id,version,tokens}], hash}` stored on `runs.promptSnapshot` for audit/replay. Versioning: every layer source has `version`; composer records the tuple; changing constitution bumps `constitutionVersion` and invalidates cached compositions.

### 10. Company State and data model (NEW, MongoDB + Mongoose)

Collections: `users` (human accounts, role), `agents`, `hermes_profiles`, `hermes_memories`, `hermes_skills`, `hermes_experience`, `knowledge_docs`, `projects` {name, repoPath, defaultAdapter}, `directives` {issuedBy, text, status, priority}, `tasks` {directiveId, projectId, assigneeAgentId, status, acceptance[], omoPolicyOverride?}, `runs` {taskId, agentId, adapterId, status, promptSnapshot, vendorSessionId, usage, startedAt, endedAt, error?}, `run_events` {runId, seq, adapterEvent}, `results` {runId, summary, artifacts[], verdict}, `decisions` {runId, question, options[], answeredBy?, answer?}, `events` (outbox, section 11), `office_state` (singleton derived doc, section 14).
Rules: all writes through service layer in `apps/api/src/services`; schemas mirrored as zod in `packages/shared`; `status` enums are union types; every mutating service emits an event in the same Mongo transaction-less sequence (write doc, then insert event; dispatcher is idempotent by `eventId`).

### 11. Event bus and outbox (NEW)

- `events` collection: `{ eventId (uuid), type, aggregate: {kind, id}, payload, actor, createdAt, dispatchedAt?, attempts }`. Index `{dispatchedAt: 1, createdAt: 1}`.
- `EventDispatcher` (in `apps/api/src/events/dispatcher.ts`): polls undispatched events every 250 ms (configurable) plus an in-process `EventEmitter` fast path so the same process never waits on the poll. Fan-out targets: Socket.IO rooms (section 12), `OfficeStateProjector` (section 14); audit log FUTURE. Marks `dispatchedAt` after all in-process handlers succeed; retries with backoff; after 5 attempts moves to `events_dead`.
- Event type catalog lives in `packages/shared/src/events.ts` as a discriminated union: `directive.created`, `task.created|assigned|status_changed`, `run.started|progress|permission_requested|completed|failed|escalated`, `agent.status_changed`, `result.recorded`, `decision.requested|answered`, `office.state_updated`.
- FUTURE: Mongo change streams (requires replica set) replace polling when a second api process exists.

### 12. API surface (NEW)

REST (`apps/api/src/routes`, prefix `/api/v1`): `POST /auth/login` (JWT), `GET /me`; `GET /agents`, `GET /agents/:id`; `POST /directives`, `GET /directives`, `GET /directives/:id`; `GET /tasks`, `PATCH /tasks/:id` (pause/cancel); `GET /runs/:id`, `GET /runs/:id/events`; `POST /decisions/:id/answer`; `POST /runs/:id/permissions/:permissionId` (allow|deny); `GET /office/state`; `GET /projects`, `POST /projects`; `GET /knowledge`, `POST /knowledge` (ingest). All responses `ApiResponse<T>` `{success, data?, error?, meta?}`.
Socket.IO (same Express http server, path `/socket.io`): `io.use()` verifies JWT from `auth.token` handshake. Namespace `/office` rooms `office` (state deltas), `agent:<id>`, `run:<id>`. Client emits only `subscribe:run`, `unsubscribe:run`; all mutations go through REST so RBAC lives in one place. `connectionStateRecovery` enabled. CORS restricted to the web origin.

### 13. RBAC and security (NEW)

- Human roles: `owner` (all), `operator` (issue directives, answer decisions/permissions, pause/cancel), `viewer` (read-only, 3D view + dashboards). Stored on `users.role`; enforced by `requireRole()` middleware per route and by a server-side check before Socket.IO room join.
- Agent roles: `executive` (ceo), `manager` (coo, cto), `domain` (programming, game, iot, ai_development). Runtime enforces: only `executive` creates directives programmatically; only `manager` assigns tasks; `domain` agents run adapters. A domain agent cannot issue a directive even if its prompt says so - `AgentRuntime.authorize(agentId, action)` rejects it.
- Adapter sandboxing per vendor: OpenCode permission config `edit: ask, bash: {"*": "ask", "bun test*": "allow", "git status*": "allow"}, webfetch: deny, external_directory: deny`; Codex `-s workspace-write`, `approval_policy on-request`, never `--yolo`; Claude `--permission-mode default --permission-prompts all`, `--disallowedTools "Bash(rm -rf*)"` baseline plus allow-list in a generated `--settings` file. Permission requests surface as `decision.requested` events for an `operator`.
- Secrets: vendor keys only in `apps/api` env (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), never sent to `apps/web`. Child process env is an explicit allow-list (`PATH`, `HOME`, vendor key); strip `ANTHROPIC_AUTH_TOKEN`, `WEBSOCKET_AUTH_FILE_DESCRIPTOR`.
- Network: api bound to the Tailscale interface + localhost only; no public ingress in v1. JWT secret rotation documented; refresh tokens FUTURE.
- Rule stated in constitution layer and enforced in code: prompt rules are not security boundaries.

### 14. Office State derivation (NEW)

`office_state` singleton: `{ version, floors: [{id, agents: [{agentId, deskId, pose: 'sitting'|'standing'|'walking'|'talking', status, activityLabel, runId?}]}], drones: [{id, parentRunId, floorId, label}], updatedAt }`. `OfficeStateProjector` subscribes to `agent.status_changed`, `run.*`, `task.*` and recomputes only the affected agent entry, bumps `version`, writes the doc, emits `office.state_updated` with a delta `{version, changed: [...]}`. Pose mapping: `idle`->sitting, `thinking`->sitting+typing, `working`->sitting+typing, `waiting_permission`->standing, `blocked`->standing, `offline`->absent. Desk assignment is static per agent in `packages/shared/src/office-layout.ts`. 3D reads this doc only; never domain collections.

### 15. 3D Virtual Office design (NEW, layout Option A locked)

Option A "Hierarchy stack" (LOCKED): F1 Lobby + reception + Server Room / AI Core (glass wall, rack glow, holographic core showing active runs count). F2 Domain agents open floor: four pods Programming, Game, IoT, AI Development, each a desk cluster plus a wall display with the pod's active task. F3 Operations: COO and CTO offices facing a shared war room table with a holographic company board (directive -> task tree). F4 CEO: corner office, skyline view, directive desk.
Rejected alternatives documented for the record: Option B "Functional split" (F1 Server Room, F2 Programming+AI Dev, F3 Game+IoT, F4 executives together) - rejected because it puts COO/CTO away from the war room and breaks the hierarchy read-at-a-glance. Option C "Hub" (central atrium, agents on radial balconies) - rejected for camera complexity and higher draw calls.
Character direction: semi-realistic humans, cyberpunk accents (jacket piping emissive, HUD glasses), one shared base mesh + per-agent material variants; "human first, cyberpunk second". Temporary OMO workers render as small drones hovering near the owning agent's desk, despawned on run end.
Camera: orbit per floor with floor selector; click agent -> focus + side panel.

### 16. 3D technical approach (NEW)

R3F v9 + React 19 + Drei. `apps/web/src/components/office/OfficeCanvas.tsx` is `'use client'` and imported via `dynamic(() => import(...), { ssr: false })`. Models loaded with `useGLTF` (Draco + Meshopt decoders self-hosted under `public/draco`). Characters: `useAnimations` with clips `idle`, `typing`, `stand`, `walk`, `talk`. Repeated furniture via `InstancedMesh`. `frameloop="demand"` with `invalidate()` on store changes and during animation ticks. State via zustand store `useOfficeStore` fed by the socket client; components use transient `subscribe` for pose updates to avoid React re-render per frame. Performance budget section 24.

### 17. Asset pipeline Blender -> GLB (NEW, UNVERIFIED defaults)

`assets/blender/*.blend` source; export glTF Binary with apply transforms, +Y up, materials Principled BSDF only, textures packed; post-process with `gltf-transform` (`draco` or `meshopt`, `ktx2` textures) into `apps/web/public/models/*.glb`. Characters rigged to Mixamo-compatible skeleton; NLA strips become clips. Budgets: building shell <= 150k tris total, character <= 20k tris, textures <= 2k. A `bun run assets:build` script wraps gltf-transform. Mark UNVERIFIED: exact Blender 4.x export flags to be confirmed by the implementer with a smoke import.

### 18. Dashboards (NEW)

shadcn/ui + Tailwind in `apps/web/src/app/(dashboard)`: Directives board, Task tree, Run console (live `run_events` stream), Decisions inbox (permissions + questions), Agent detail (Hermes profile, memory, recent experience), Cost panel. Dashboards and 3D share `useOfficeStore` and `useCompanyStore`.

### 19. Web client state (NEW)

`apps/web/src/lib/socket.ts` single Socket.IO client with JWT; `apps/web/src/stores/useOfficeStore.ts` (office_state mirror, applies deltas by version, requests full state on gap), `useCompanyStore.ts` (directives/tasks/runs caches via REST + events), `useAuthStore.ts`. No business logic in the client.

### 20. Observability and cost (NEW)

pino structured logs in api; every run records `usage` normalized `{inputTokens, outputTokens, costUsd?}` from adapter events; `GET /runs/:id` exposes it; Cost panel sums per agent/day. Run timeline reconstructable from `run_events`. Health `GET /healthz`.

### 21. Testing strategy (NEW, TDD locked)

Every todo: failing test first. Unit + integration with `bun test`; HTTP via supertest; Mongo via `mongodb-memory-server`; adapters tested with fake child processes (fixture JSONL/stream-json files) and a fake OpenCode SSE server; 3D via Playwright screenshot baseline in `apps/web/e2e` plus manual QA checklist (visual judgement cannot be fully automated). Evidence saved under `.omo/evidence/<todo>/`.

### 22. Dev environment and workspace (NEW)

bun workspaces (`package.json` `workspaces: ["apps/*", "packages/*"]`), TypeScript strict, Biome lint/format. Scripts: `bun run dev` (api + web concurrently), `bun run test`, `bun run typecheck`, `bun run assets:build`. Env via `.env` per app, `.env.example` committed. Local MongoDB 7 standalone (docker compose file provided).

### 23. Deployment (NEW)

v1: single host, mongo via docker compose, api via `bun run dev` (api container FUTURE), web via `next start` or Vercel-less self-host; reached over Tailscale. Tailscale Serve/Funnel exposure = OPEN DECISION 4.

### 24. Performance budgets (NEW)

3D: 60 fps on integrated GPU at 1080p, <= 300 draw calls per visible floor, <= 1.5M tris total, initial model payload <= 25 MB compressed. API: event end-to-end (write -> socket) <= 500 ms p95. Socket delta payload <= 4 KB typical.

### 25. Failure modes and recovery (NEW)

Adapter crash -> run `failed`, task back to `assigned` and a new run `queued` if `attempts < maxRetries`, else `escalated` to manager agent (COO for process, CTO for technical). Permission unanswered 30 min -> run paused, `agent.status = blocked`. Dispatcher down -> events accumulate, replayed on restart (idempotent). Socket disconnect -> client requests full `office_state` by version on reconnect. Vendor binary missing -> adapter `healthcheck()` fails at boot, agent marked `offline`.

### 26. Risks

Vendor CLI flags drift (mitigate: adapter contract tests pinned to vendor version, `healthcheck()` prints version). OpenCode event names inferred (OPEN DECISION 6). 3D scope creep (mitigate: office_state is the only 3D input; assets budgeted). Prompt token budget exceeded (composer truncation order, section 9). Single-process api is a SPOF (accepted for v1).

### 27. Checklist mapping (section 27 of the request)

All 20 checklist items: ABSENT in repo -> NEW. Repo is greenfield; nothing to REUSE/MODIFY/DEPRECATE inside it. External REUSE: OpenCode v1.18.35 + `@opencode-ai/sdk` 1.18.13 + oh-my-openagent plugin (as adapter targets only).

### 28. Glossary

Directive (CEO intent), Task (unit assigned to a domain agent), Run (one adapter execution of a task), Result (verified outcome), Company State (domain collections), Office State (derived 3D projection), Hermes (persistent identity/context layer), OMO (orchestration policy: plan/delegate/execute/verify), Adapter (vendor CLI/SDK bridge), Drone (3D representation of a temporary OMO worker).

## MASTER BUILD ORDER

Wave 1 Foundation: shared types + events, api skeleton + Mongo + auth/RBAC, events outbox + dispatcher + Socket.IO.
Wave 2 Brain: Hermes core (profiles/memory/skills/experience, in-memory KnowledgeStore), prompt composer, agent runtime state machine, OMO policy engine.
Wave 3 Hands: OpenCode adapter, Codex + Claude adapters, run pipeline end-to-end (directive -> result) with fake adapter.
Wave 4 Face: web shell + auth + dashboards, office_state projector, 3D office shell (4 floors, placeholder agents), character rig + animations, asset pipeline.
Wave 5 Polish: cost panel, decisions inbox, failure/recovery paths, Playwright baselines, docs.

## FIRST 10 CODING TASKS

**RH-SHARED-001 Shared types and event catalog** - OBJECTIVE: `packages/shared` with zod schemas for all collections (section 10) and the event union (section 11). WHY: single source of truth for api/web/runtime. DEPENDENCIES: none. FILES: `packages/shared/src/{schemas,events,office-layout,index}.ts`. IMPACT: DATABASE schema definitions; API/EVENT contracts; AI none; 3D layout constants; SECURITY role enums. IMPLEMENTATION: zod + inferred TS types; `AgentStatus`, `RunStatus` unions; `OfficeLayout` desk map for 7 agents across floors F1-F4 (Option A). ACCEPTANCE: `bun test packages/shared` green; parsing a sample of each schema succeeds; invalid status rejected. TEST: schema round-trip tests. ROLLBACK: delete package; RISK low.

**RH-API-001 API skeleton, Mongo, auth, RBAC** - OBJECTIVE: Express app, Mongoose connection, `POST /auth/login`, JWT middleware, `requireRole()`, `GET /me`, `GET /agents` seeded with 7 permanent agents. WHY: every later task needs auth + persistence. DEPENDENCIES: RH-SHARED-001. FILES: `apps/api/src/{app,server,db,auth,middleware/requireRole,routes/agents,seed}.ts`. IMPACT: DATABASE `users`, `agents`; API auth routes; SECURITY RBAC enforcement point. IMPLEMENTATION: bcrypt password, JWT 12h, roles owner/operator/viewer; seed script idempotent. ACCEPTANCE: supertest: login ok/401, viewer gets 403 on `POST /directives` stub, `GET /agents` returns 7 with ids `ceo,coo,cto,programming,game,iot,ai_development`. TEST: supertest + mongodb-memory-server. ROLLBACK: revert; RISK low.

**RH-API-002 Events outbox + dispatcher + Socket.IO** - OBJECTIVE: `events` collection, `EventDispatcher`, Socket.IO server with JWT handshake, rooms `office`, `agent:<id>`, `run:<id>`. WHY: backbone of Company State -> 3D. DEPENDENCIES: RH-API-001. FILES: `apps/api/src/events/{dispatcher,emit}.ts`, `apps/api/src/socket/index.ts`. IMPACT: DATABASE `events`, `events_dead`; EVENT catalog consumption; SECURITY room-join role check. IMPLEMENTATION: per section 11-12; poll 250 ms + in-process fast path; idempotent by `eventId`. ACCEPTANCE: inserting `agent.status_changed` reaches a connected socket client in `office` room within 500 ms; unauthenticated socket rejected; dispatcher restart replays undispatched. TEST: integration with socket.io-client. ROLLBACK: feature flag `EVENTS_DISPATCH=off`; RISK medium (timing).

**RH-HERMES-001 Hermes core** - OBJECTIVE: `packages/hermes` with `HermesStore` (profiles, memories, skills, experience) on Mongoose, `KnowledgeStore` interface with `InMemoryKnowledgeStore` (BM25-style keyword), `assembleContext(agentId, task, budget)`. WHY: identity/context layer required before any prompt is composed. DEPENDENCIES: RH-API-001. FILES: `packages/hermes/src/{store,knowledge,context,index}.ts`. IMPACT: DATABASE `hermes_*`, `knowledge_docs`; AI context assembly; SECURITY agents read only their own profile/memories. IMPLEMENTATION: seed 7 profiles (identity, personality, role) from `packages/hermes/seed/*.json`; `assembleContext` returns ordered blocks with token estimates. ACCEPTANCE: assembled context for `programming` includes its profile + top-3 relevant memories and respects budget; cross-agent memory read rejected. TEST: unit with mongodb-memory-server. ROLLBACK: revert; RISK low. Vector store = OPEN DECISION 1 (interface keeps swap cheap).

**RH-AGENT-001 Prompt composer** - OBJECTIVE: `composePrompt(input): {text, layers[], tokens, version}` implementing the 9 layers, precedence, budget and truncation order (section 9). WHY: dynamic system prompt composition is a locked requirement. DEPENDENCIES: RH-HERMES-001. FILES: `packages/agent-runtime/src/prompt/{composer,layers,budget}.ts`, `packages/agent-runtime/constitution.md`. IMPACT: AI prompt content; DATABASE `runs.promptSnapshot`; SECURITY constitution + role policy never truncated. IMPLEMENTATION: layers as pure functions; token estimate via simple heuristic (chars/4) pluggable. ACCEPTANCE: given oversized RAG input, output <= budget, layers 1-4 and 9 intact, truncation hits layer 7 first; snapshot hash stable for same input. TEST: unit snapshot tests. ROLLBACK: revert; RISK low.

**RH-OMO-001 Agent runtime state machine + OMO policy** - OBJECTIVE: `AgentRuntime` with run state machine (section 4), `OmoPolicy` resolution (agent default < task override), retry/escalate, `authorize(agentId, action)`. WHY: orchestration core; enforces agent-role RBAC at runtime. DEPENDENCIES: RH-AGENT-001, RH-API-002. FILES: `packages/agent-runtime/src/{runtime,state-machine,policy,authorize}.ts`. IMPACT: DATABASE `runs`, `run_events`, `tasks` status; EVENT `run.*`, `task.*`, `agent.status_changed`; SECURITY authorize(). IMPLEMENTATION: uses a `FakeAdapter` for tests; emits events via api `emit()`. ACCEPTANCE: fake failing adapter -> retries `maxRetries` then `escalated` with event to manager; domain agent `createDirective` rejected; status transitions logged. TEST: unit + integration. ROLLBACK: revert; RISK medium.

**RH-ADAPTER-001 OpenCode adapter** - OBJECTIVE: `OpenCodeAdapter implements AgentAdapter` using `@opencode-ai/sdk` `createOpencodeServer` + client, SSE events normalized to `AdapterEvent`, permission relay to `POST /api/session/{id}/permissions/{permissionID}`. WHY: primary executor on this machine (v1.18.35 installed). DEPENDENCIES: RH-OMO-001. FILES: `packages/adapters/src/opencode/{adapter,events,permissions}.ts`. IMPACT: AI execution; EVENT `run.progress|permission_requested`; SECURITY permission config per section 13. IMPLEMENTATION: one server per adapter instance, one session per run, `cwd` = project repoPath. ACCEPTANCE: against a fake SSE server fixture, events normalized in order; permission request round-trips; `healthcheck()` reports version. TEST: fixture-based integration; one opt-in live smoke test behind `LIVE_OPENCODE=1`. ROLLBACK: disable adapter in config; RISK medium (event names - OPEN DECISION 6).

**RH-ADAPTER-002 Codex + Claude headless adapters** - OBJECTIVE: `CodexAdapter` (`codex exec --json --ephemeral -C <cwd> -s workspace-write --ignore-user-config -o <file>`) and `ClaudeAdapter` (`claude -p --output-format stream-json --permission-mode default --permission-prompts all --max-turns N --session-id <uuid> --settings <generated>`), JSONL parsing to `AdapterEvent`, env allow-list, stdin closed, SIGTERM cancel. WHY: multi-vendor locked. DEPENDENCIES: RH-ADAPTER-001 (shared parsing utils). FILES: `packages/adapters/src/{codex,claude}/*.ts`, `packages/adapters/src/process.ts`. IMPACT: AI execution; SECURITY sandbox flags, env stripping. ACCEPTANCE: fixture JSONL/stream-json files parse to expected event sequences; missing binary -> `healthcheck()` false and agent `offline`; cancel kills child. TEST: fixtures + fake binaries in `test/bin`. ROLLBACK: disable; RISK medium (OPEN DECISION 5).

**RH-WEB-001 Web shell, auth, socket client, dashboards v0** - OBJECTIVE: Next.js app with login, `useAuthStore`, Socket.IO client, Directives board + Run console reading events live. WHY: first human-facing surface, validates event path. DEPENDENCIES: RH-API-002. FILES: `apps/web/src/app/{login,(dashboard)}/**`, `apps/web/src/lib/{api,socket}.ts`, `apps/web/src/stores/*.ts`. IMPACT: API consumer; SECURITY no secrets in client, JWT in memory + httpOnly cookie. ACCEPTANCE: login -> dashboard; creating a directive via UI shows in board; run events stream into console. TEST: Playwright e2e against api with FakeAdapter. ROLLBACK: revert; RISK low.

**RH-3D-001 Office State projector + 3D office shell** - OBJECTIVE: `OfficeStateProjector` in api (section 14) and `OfficeCanvas` in web with 4 floors (Option A), placeholder capsule agents at desks, status color + label, floor selector, click-to-focus. WHY: proves Company State -> Office State -> 3D with zero business logic in 3D. DEPENDENCIES: RH-API-002, RH-WEB-001. FILES: `apps/api/src/office/projector.ts`, `apps/web/src/components/office/{OfficeCanvas,Floor,AgentAvatar,CameraRig}.tsx`, `apps/web/src/stores/useOfficeStore.ts`. IMPACT: DATABASE `office_state`; EVENT `office.state_updated`; 3D first scene. ACCEPTANCE: changing an agent status via API moves its placeholder pose/color within 1 s; `office_state.version` monotonic; Playwright screenshot baseline for each floor. TEST: projector unit tests + Playwright. ROLLBACK: revert; RISK medium (perf unknown until real assets).

## OPEN DECISIONS

1. Vector store for Hermes RAG: LanceDB (embedded, Node) vs sqlite-vec vs MongoDB Atlas Vector Search. Default until decided: `InMemoryKnowledgeStore` behind `KnowledgeStore` interface. UNVERIFIED.
2. Embeddings provider: OpenAI `text-embedding-3-small` vs Voyage vs local Ollama. Depends on 1. UNVERIFIED.
3. Blender 4.x exact export flags / rig source (Mixamo vs custom). UNVERIFIED; resolved by implementer smoke test in Wave 4.
4. Tailscale exposure: tailnet-only vs Tailscale Serve (HTTPS on tailnet) vs Funnel (public). Default tailnet-only.
5. Codex / Claude binaries not confirmed installed on this host; adapters ship with `healthcheck()` and fixtures so tasks are unblocked. Owner to install when ready.
6. OpenCode session event names beyond `server.instance.disposed`, `installation.*`, `lsp.*` were inferred; implementer verifies against `@opencode-ai/sdk` `types.gen.d.ts` in RH-ADAPTER-001.

## Verification strategy

TDD per todo (failing test first, then minimal implementation). Unit/integration via `bun test` with `mongodb-memory-server`, supertest, socket.io-client, fixture child processes. 3D via Playwright screenshot baselines + manual QA checklist. Evidence per todo saved under `.omo/evidence/<todo-number>/` (test output, screenshots). No todo is complete without both a happy-path and a failure-path check recorded.

## Execution strategy

Five waves matching MASTER BUILD ORDER. Within a wave, todos are independent unless a dependency is listed and may run in parallel (max 3 concurrent) in isolated worktrees - only once the owner has approved `git init` (todo 1); before that, sequential. Waves are sequential. Each todo = Implementation + Test in one unit. Stop and ask the owner when an OPEN DECISION blocks a todo; never guess a vendor flag not listed in section 8 without checking `--help` output first.

## Todos

Wave 1 - Foundation

- [x] 1. Bootstrap bun workspace, TypeScript strict, Biome, docker-compose Mongo
  - References: section 22; `/home/programer/.bun` (bun present).
  - Acceptance: repo is NOT git-initialized - worker asks the owner to approve `git init -b main` before Wave 1 starts; until then todos run sequentially without worktrees. Stub `package.json` + `src/index.ts` + `tsconfig.json` for all 6 workspaces (`apps/api`, `apps/web`, `packages/shared`, `packages/hermes`, `packages/agent-runtime`, `packages/adapters`) so `bun run typecheck` covers them; `bun install` succeeds; `bun run typecheck` passes; `docker compose up mongo` exposes 27017; `.env.example` for api (includes `OWNER_EMAIL`, `OWNER_PASSWORD`, `EVENTS_DISPATCH`) + web written.
  - QA happy: `bun run typecheck` output saved `.omo/evidence/01/typecheck.txt`. QA failure: introduce a type error in `packages/shared/src/index.ts`, confirm typecheck fails, revert; log in `.omo/evidence/01/failure.txt`.
  - Commit: `chore: bootstrap bun workspace with api, web, shared packages`
- [x] 2. RH-SHARED-001 shared schemas, event catalog, office layout
  - References: sections 10, 11, 14; task card RH-SHARED-001.
  - Acceptance: zod schema per collection; `DomainEvent` discriminated union including `worker.spawned|despawned` `{runId, workerId, label}` (drives 3D drones); `RunStatus` including `paused`; `TaskStatus = 'planned'|'assigned'|'in_progress'|'paused'|'cancelled'|'done'|'escalated'`; `directives` and `tasks` schemas carry `capabilityTags: string[]` (routing input, todo 13); `OFFICE_LAYOUT` maps 7 agents to floors F1-F4 per Option A (ceo F4, coo/cto F3, four domain F2); tests green.
  - QA happy: `bun test packages/shared` -> `.omo/evidence/02/test.txt`. QA failure: `AgentStatusSchema.parse('dancing')` throws; asserted in test.
  - Commit: `feat(shared): add domain schemas, event catalog and office layout`
- [x] 3. RH-API-001 Express skeleton, Mongoose, JWT auth, requireRole, agent seed
  - References: sections 12, 13; task card RH-API-001.
  - Acceptance: `POST /api/v1/auth/login` returns JWT; `GET /api/v1/me`; `GET /api/v1/agents` returns 7 seeded agents with exact `capabilityTags`: `ceo:['direct']`, `coo:['route','process']`, `cto:['route','technical']`, `programming:['code']`, `game:['game']`, `iot:['iot']`, `ai_development:['ai']`; seed also creates an `owner` user from `OWNER_EMAIL`/`OWNER_PASSWORD` in `apps/api/.env`; `requireRole('operator')` returns 403 for viewer; seed idempotent (run twice, still 7 agents, 1 owner).
  - QA happy: supertest run -> `.omo/evidence/03/test.txt`. QA failure: wrong password -> 401; viewer POST -> 403 (both asserted).
  - Commit: `feat(api): add express skeleton, auth, rbac middleware and agent seed`
- [x] 4. RH-API-002 events outbox, dispatcher, Socket.IO rooms
  - References: sections 11, 12; task card RH-API-002.
  - Acceptance: `emit(event)` inserts to `events`; dispatcher delivers to `office` room <= 500 ms; `io.use()` rejects missing/invalid JWT; CORS rejects a foreign origin (asserted); `EVENTS_DISPATCH=off` disables dispatch (asserted); `connectionStateRecovery` enabled; restart replays undispatched; after 5 failures event lands in `events_dead`.
  - QA happy: socket.io-client integration test -> `.omo/evidence/04/test.txt`. QA failure: connect without token -> `connect_error`; asserted.
  - Commit: `feat(api): add event outbox dispatcher and socket.io gateway`
- [x] 5. Directives/tasks/runs REST + service layer (CRUD, status transitions, emits events) - executed as two units: 5a directives/tasks/runs services + routes + 409 transitions; 5b projects, knowledge, office/state read routes (each unit own test run, both under `.omo/evidence/05/`)
  - References: sections 4, 10, 12; todo 2 (`TaskStatus`, `RunStatus`).
  - Acceptance: `POST /directives` (operator+), `GET /directives`, `GET /tasks`, `PATCH /tasks/:id` pause/cancel, `GET /runs/:id`, `GET /runs/:id/events`, `GET/POST /projects`, `GET/POST /knowledge`, `GET /office/state`; every mutation emits the catalog event; invalid transition (e.g. `succeeded` -> `queued`) returns 409. No agent-status write route exists; agent status changes only via runtime events. In this todo tasks and runs are created by direct service calls in the test (no runtime yet); runtime-driven creation is todo 13.
  - QA happy: supertest flow directive -> task -> run visible -> `.omo/evidence/05/test.txt`. QA failure: invalid transition 409 asserted.
  - Commit: `feat(api): add directive, task and run services with event emission` (5a) / `feat(api): add project, knowledge and office state routes` (5b)

Wave 2 - Brain

- [x] 6. RH-HERMES-001 Hermes store, in-memory KnowledgeStore, assembleContext, 7 seeded profiles
  - References: section 6; task card RH-HERMES-001; OPEN DECISION 1.
  - Acceptance: profiles versioned append-only; `InMemoryKnowledgeStore` hydrates from `knowledge_docs` at boot (asserted); `assembleContext('programming', task, 2000)` returns profile + top-3 memories within budget; `getMemories('ceo', asAgent='programming')` rejected.
  - QA happy: `bun test packages/hermes` -> `.omo/evidence/06/test.txt`. QA failure: cross-agent read throws `HermesAccessError`; asserted.
  - Commit: `feat(hermes): add identity, memory, skills, experience store and context assembly`
- [x] 7. RH-AGENT-001 prompt composer with 9 layers, budget, truncation order, snapshot hash
  - References: section 9; task card RH-AGENT-001; `packages/agent-runtime/constitution.md` (write v1 text, includes "prompt rules are not security boundaries").
  - Acceptance: output <= budget; layers 1-4 and 9 never truncated; truncation order 7 -> 6 -> 8 -> 5; same input -> same hash; layer versions recorded.
  - QA happy: snapshot tests -> `.omo/evidence/07/test.txt`. QA failure: budget smaller than reserved layers -> `PromptBudgetError`; asserted.
  - Commit: `feat(agent-runtime): add dynamic system prompt composer`
- [x] 8. Adapter contract: `AgentAdapter`, `AdapterEvent`, `FakeAdapter`, process spawn util with env allow-list
  - References: sections 8, 13. Lives in `packages/adapters`; `AgentAdapter`/`AdapterEvent` types exported from `packages/shared` so runtime never imports vendor code.
  - Acceptance: `FakeAdapter` replays a scripted event list; `spawnChild()` passes only allow-listed env and strips `ANTHROPIC_AUTH_TOKEN`, `WEBSOCKET_AUTH_FILE_DESCRIPTOR`; cancel sends SIGTERM then SIGKILL after 5 s.
  - QA happy: tests -> `.omo/evidence/08/test.txt`. QA failure: env leak test asserts forbidden var absent in child.
  - Commit: `feat(adapters): add adapter contract, fake adapter and sandboxed process spawn`
- [x] 9. RH-OMO-001 AgentRuntime state machine, OmoPolicy, retry/escalate, authorize()
  - References: sections 4, 5, 7, 13; task card RH-OMO-001; todos 6 (Hermes experience write), 7 (composer), 8 (`FakeAdapter`). Runtime emits through an injected `EventSink` interface defined in `packages/shared`; `apps/api` supplies the outbox implementation (no `packages/agent-runtime` -> `apps/api` import).
  - Acceptance: with `FakeAdapter` success -> run `succeeded`, `result.recorded` emitted, Hermes experience row written; failing adapter -> `maxRetries` retries then `escalated` to manager; `authorize('programming','createDirective')` false; `authorize('coo','assignTask')` true; `run.permission_requested` from adapter -> runtime inserts `decisions` row and emits `decision.requested`; run stays `executing`, agent status `waiting_permission`; `paused` only via human pause or the 30-min timeout (todo 18). Runtime emits `worker.spawned`/`worker.despawned` when the adapter emits a `tool` event with `name: 'task'` started/completed (drives drones, todo 15).
  - QA happy: integration test -> `.omo/evidence/09/test.txt`. QA failure: escalate path + authorize rejection asserted.
  - Commit: `feat(agent-runtime): add run state machine, omo policy and runtime authorization`
- [x] 10. OMO plan/verify functions (prometheus.plan, verify) on top of adapter text output
  - References: section 7. `atlas.context`, `sisyphus.execute` and delegation to real oh-my-openagent agents inside an OpenCode session are FUTURE (not in v1); only `prometheus.plan` + `verify` ship.
  - Acceptance: `prometheus.plan` produces `WorkPlan` JSON (validated by zod) from a structured prompt; `verify` compares `StepResult` to acceptance list and returns pass/fail with evidence strings; malformed JSON -> one repair retry then fail.
  - QA happy: unit tests with fixture outputs -> `.omo/evidence/10/test.txt`. QA failure: malformed JSON path asserted.
  - Commit: `feat(agent-runtime): add omo plan and verify functions`

Wave 3 - Hands

- [x] 11. RH-ADAPTER-001 OpenCode adapter via SDK server + SSE + permission relay
  - References: section 8; task card RH-ADAPTER-001; todo 8; `/home/programer/.opencode/node_modules/@opencode-ai/sdk/` (read `types.gen.d.ts` first to confirm event names - OPEN DECISION 6; record findings in `.omo/evidence/11/event-names.md`).
  - Acceptance: fixture SSE server -> normalized `AdapterEvent` sequence; permission request -> `answerPermission` POSTs to `/api/session/{id}/permissions/{permissionID}`; `healthcheck()` returns version string; live smoke behind `LIVE_OPENCODE=1` runs `echo hello` task successfully.
  - QA happy: fixture tests + live smoke log -> `.omo/evidence/11/`. QA failure: server unreachable -> `failed` event with error; asserted.
  - Commit: `feat(adapters): add opencode adapter over sdk server and sse`
- [x] 12. RH-ADAPTER-002 Codex + Claude headless adapters with JSONL/stream-json parsers
  - References: section 8; task card RH-ADAPTER-002; todo 8 (`spawnChild`); OPEN DECISION 5.
  - Acceptance: fixture `codex.jsonl` and `claude.stream.jsonl` parse to expected events; generated `.codex/config.toml` and claude `settings.json` match section 13 policies; missing binary -> `healthcheck()` false.
  - QA happy: tests -> `.omo/evidence/12/test.txt`. QA failure: fake binary exits 2 -> `failed` event; asserted.
  - Commit: `feat(adapters): add codex and claude headless adapters`
- [x] 13. End-to-end pipeline: directive -> task -> run -> result with FakeAdapter, wired in api process
  - References: sections 3, 4; todos 5, 8, 9.
  - Acceptance: `POST /directives` by operator triggers COO routing to `programming` (v1 routing is deterministic: directive `capabilityTags` copied onto the task, then matched against agent `capabilityTags` from the todo 3 seed - test posts `capabilityTags: ['code']`; no LLM call), run executes via FakeAdapter, `result.recorded` and `agent.status_changed` events reach socket client; whole loop <= 5 s in test.
  - QA happy: integration test -> `.omo/evidence/13/test.txt`. QA failure: FakeAdapter failure -> escalation `decision.requested` reaches socket; asserted.
  - Commit: `feat(api): wire agent runtime into api for end-to-end directive pipeline`

Wave 4 - Face

- [x] 14. RH-WEB-001 Next.js shell, login, socket client, Directives board, Run console
  - References: sections 12, 18, 19; task card RH-WEB-001.
  - Acceptance: login -> dashboard; new directive appears in board without reload; run console streams `run.progress`; auth is in-memory bearer JWT for both REST and socket `auth.token` (no cookie in v1, overrides task card RH-WEB-001 cookie wording); no vendor key in client bundle: `bun --cwd apps/web run build && ! rg -q 'sk-[A-Za-z0-9]{20,}|ANTHROPIC_API_KEY|OPENAI_API_KEY' apps/web/.next` exits 0.
  - QA happy: Playwright e2e -> `.omo/evidence/14/`. QA failure: expired JWT redirects to login; asserted.
  - Commit: `feat(web): add app shell, auth, socket client and first dashboards`
- [x] 15. Office State projector (api) + `useOfficeStore` delta/version sync (web)
  - References: section 14; `packages/shared/src/office-layout.ts`.
  - Acceptance: `office_state.version` monotonic; projector recomputes only changed agent; client applies delta, requests full state on version gap; drones added/removed on `worker.spawned|despawned` events; `subscribe:run` room join checks RBAC (viewer may read, run must exist). Also covers Task tree and Agent detail dashboards (section 18); adds `GET /api/v1/agents/:id/hermes` (profile + recent memories + experience, viewer+, supertest-asserted) as the Agent detail data source.
  - QA happy: projector unit + store tests -> `.omo/evidence/15/`. QA failure: out-of-order delta ignored and resync requested; asserted.
  - Commit: `feat: add office state projector and client office store`
- [ ] 16. RH-3D-001 OfficeCanvas: 4 floors Option A, placeholder avatars, CameraRig, floor selector, click-focus
  - References: sections 15, 16, 24; task card RH-3D-001; todo 15 (`useOfficeStore`).
  - Acceptance: `dynamic(..., {ssr:false})`; 4 floors laid out per Option A with Server Room on F1; 7 placeholder avatars at desks colored by status; status change driven by a FakeAdapter run (or test-only `emit(agent.status_changed)`) visible <= 1 s - never a status write route; `frameloop="demand"`; Playwright screenshot per floor; Playwright reads `gl.info.render.calls` via a `window.__r3f` test hook and asserts `<= 300` on F2 with 7 avatars (fps check is manual, recorded in `.omo/evidence/16/manual-qa.md`).
  - QA happy: screenshots `.omo/evidence/16/floor-{1..4}.png` + manual checklist `.omo/evidence/16/manual-qa.md`. QA failure: socket disconnect shows offline overlay; screenshot.
  - Commit: `feat(web): add 3d office shell with four floors and placeholder agents`
- [x] 17. Asset pipeline + first GLB (building shell) + character rig with idle/typing/stand/walk/talk clips
  - References: section 17 (UNVERIFIED flags - confirm by smoke import); OPEN DECISION 3.
  - Acceptance: `bun run assets:build` produces compressed GLB under budget (section 24); `useGLTF` loads shell + one character; `useAnimations` plays all five clips `idle`/`typing`/`stand`/`walk`/`talk` (section 16) driven by office pose.
  - QA happy: build log + screenshot -> `.omo/evidence/17/`. QA failure: oversized asset fails budget check in script; asserted.
  - Commit: `feat(assets): add gltf pipeline, building shell and base character`

Wave 5 - Polish

- [x] 18. Decisions inbox (permissions + questions) with REST answer flow and 3D `waiting_permission` pose
  - References: sections 13, 18, 25.
  - Acceptance: `permission_request` -> `decision.requested` -> inbox card; inbox calls `POST /decisions/:id/answer`, which relays to `adapter.answerPermission` and resumes the run; unanswered 30 min -> run paused, agent `blocked` (clock injectable in test).
  - QA happy: e2e -> `.omo/evidence/18/`. QA failure: viewer cannot answer (403); asserted.
  - Commit: `feat: add decisions inbox and permission answer flow`
- [x] 19. Cost panel, pino logging, `/healthz`, adapter healthchecks at boot
  - References: sections 20, 25.
  - Acceptance: `GET /api/v1/usage?groupBy=agent,day` returns sums (supertest-asserted); `/healthz` reports mongo + adapters; missing vendor binary marks agent `offline` at boot.
  - QA happy: tests + screenshot -> `.omo/evidence/19/`. QA failure: mongo down -> `/healthz` 503; asserted.
  - Commit: `feat: add cost panel, structured logging and health checks`
- [x] 20. Recovery paths: dispatcher replay, socket resync, adapter crash retry; docs (`README.md`, `docs/architecture.md` from this plan)
  - References: sections 25, 26.
  - Acceptance: kill dispatcher mid-stream, restart, no event lost (idempotent); client reconnect resyncs; `scripts/quickstart.sh` (clone -> `bun install` -> `docker compose up -d mongo` -> `bun run dev` -> curl `/healthz` 200) exits 0.
  - QA happy: chaos test logs -> `.omo/evidence/20/`. QA failure: duplicate event delivery suppressed; asserted.
  - Commit: `feat: harden recovery paths and add architecture docs`

## Final verification wave

- [x] F1. Plan compliance: every todo 1-20 has evidence under `.omo/evidence/<n>/`; each FIRST 10 task card's acceptance criteria mapped to a passing test; OPEN DECISIONS updated with resolutions or still-open status.
- [x] F2. Code quality: `bun run typecheck`, Biome lint, `bun test` all green across workspace; no `any`: `! rg -n ':\s*any\b|as any' apps packages --type ts`; files > 500 LOC: `find apps packages -name '*.ts*' -not -path '*/node_modules/*' | xargs wc -l | awk '$1>500'` output saved to `.omo/evidence/F2/`; English identifiers only.
- [x] F3. Real manual QA: on a running stack over Tailscale, owner logs in, issues a directive, watches a domain agent move to `working` on F2 in 3D, answers one permission request, sees result in dashboard; record video/screenshots in `.omo/evidence/F3/`.
- [x] F4. Scope fidelity: confirm only 7 permanent agents exist, 3D reads only `office_state`, no business logic in `apps/web`, RBAC enforced in api + runtime, adapters never receive Hermes data directly.

## Commit strategy

Conventional commits, one commit per todo as listed. Branch per wave (`wave-1-foundation`, ...) off `main`; merge after wave green. `.env` never committed.

AGENTS.md git consent gate applies: the `Commit:` lines above are message templates only. After a todo's tests pass the worker STOPS and reports "Implementation selesai. Belum di-commit/push." and waits for an explicit commit/branch/merge verb from the owner in the current message. No auto-commit, no auto-branch, no push/PR without owner confirmation.

## Success criteria

- Core loop runs end to end with FakeAdapter and with the live OpenCode adapter on this host.
- 7 permanent agents only; Hermes profiles versioned; prompt snapshots auditable per run.
- Office State is the sole 3D input; status changes reflect in 3D within 1 s; draw-call and asset budgets (section 24) asserted by todo 16/17 tests; fps confirmed in F3 manual QA.
- RBAC enforced at API and runtime with tests proving denial paths.
- All 20 todos + F1-F4 checked with evidence.
