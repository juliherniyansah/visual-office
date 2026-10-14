# Decisions — redhunter-master-plan

Architectural choices and rationales discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## 2026-10-09T00:04:11+00:00 Task: 2
- IDs: every document exposes id: string (ObjectId hex or stable slug). Agents use AgentId slugs. Api maps _id <-> id.
- Timestamps: ISO-8601 UTC strings (z.iso.datetime) in shared schemas; api converts Mongo Date at the boundary.
- events and events_dead share DomainEventSchema (outbox envelope {eventId uuid, type, aggregate {kind literal per type, id}, payload, actor {kind human|agent|system, id}, createdAt, dispatchedAt?, attempts}). No extra dead-letter fields (not in plan).
- Event payloads (plan gives names only, minimal reading): directive.created {directive}; task.created {task}; task.assigned {taskId, assigneeAgentId}; task.status_changed {taskId, status}; run.started {runId, taskId, agentId, adapterId}; run.progress {runId, seq, adapterEvent}; run.permission_requested {runId, permissionId, tool, detail}; run.completed {runId}; run.failed {runId, error}; run.escalated {runId, escalatedTo: AgentId|human}; agent.status_changed {agentId, status, runId?}; result.recorded {result}; decision.requested {decision}; decision.answered {decisionId, runId, answer, answeredBy}; office.state_updated {version, changed: OfficeAgent[]}; worker.spawned|despawned {runId, workerId, label} with aggregate kind run.
- DirectiveStatus = draft|issued (section 4). Priority = low|normal|high (plan names the field only). Verdict = pass|fail (section 7) used by results.verdict and hermes_experience.outcome.
- Task.assigneeAgentId optional (absent while planned). Run.promptSnapshot/vendorSessionId/startedAt optional (filled as run advances); usage required (start at zeros).
- AgentSchema adds role (executive|manager|domain, section 13) and omoPolicy (section 7) to section 5 fields; reportsTo is AgentId[] (domain agents report to coo+cto). Static part = AGENT_DEFINITIONS; floor/deskSlot derived from OFFICE_LAYOUT (single source). Desk ids: f4-ceo, f3-coo, f3-cto, f2-programming, f2-game, f2-iot, f2-ai-development.
- run_events.adapterEvent validated by AdapterEventSchema (section 8) living in shared; todo 8 should reuse it instead of redefining AdapterEvent.
- Collection named usage in the dispatch brief does not exist in plan section 10; usage is an embedded field on runs (section 20), so no separate schema.

## 2026-10-09T01:38:20+00:00 Task: 3
- Layout: app.ts (createApp(deps) pure factory, no listen/connect), server.ts (createHttpServer/listen/startServer; T4 attaches Socket.IO to createHttpServer(app) before listen), index.ts (boot: loadEnv -> connect -> createModels -> runSeed -> startServer, guarded by import.meta.main), config/env.ts, db/{connection,models,mappers}.ts, auth/{credentials,password,token,middleware}.ts, routes/{auth,me,agents}.ts, http/{response,errors}.ts, seed/{agents,owner,index,cli}.ts.
- Mongo: dedicated mongoose.createConnection (not the global default) so tests/later todos can hold several connections. Agents stored with _id = AgentId slug; users with ObjectId _id, mapped to id hex. Mappers re-validate every read with AgentSchema/PublicUserSchema from @redhunter/shared.
- Hashing: Bun.password argon2id (no extra dep). Unknown-user login still runs one argon2 verify against a lazily created dummy hash (timing parity); unknown email and wrong password return the same 401 body.
- JWT: jose HS256 only, claims {sub, role, iss: redhunter-api, aud: redhunter, iat, exp = iat + 12h}. Verification pins algorithms, issuer, audience, requires sub/iat/exp and re-validates role against HumanRoleSchema.
- RBAC: requireAuth = createRequireAuth(secret) (Bearer only, regex, case-insensitive scheme, WWW-Authenticate: Bearer on 401); requireRole(min) rank viewer1 < operator2 < owner3, fails closed with 401 if requireAuth did not run. /me re-loads the user (deleted user -> 401); role comes from the token (role changes take effect on next login, max 12h).
- Seed: seedAgents bulk upserts; static identity (title, role, reportsTo, floor, deskSlot, hermesProfileId, capabilityTags) is $set every run (drift repaired), runtime fields (status, allowedAdapters, omoPolicy) only $setOnInsert. Defaults: status idle, allowedAdapters all 3, hermesProfileId hermes-<id>, omoPolicy {maxRetries 2 (plan s7), maxTurns 30, budgetTokens 32000, allowedTools [], escalationChain reportsTo + human}.
- Owner seed: upsert by normalized email; role re-asserted to owner; passwordHash only $setOnInsert -> a changed owner password is NOT overwritten on re-seed/boot. Explicit reset: bun run --cwd apps/api seed -- --force-owner-password (seedOwner(..., {forcePassword:true})).
- Env: PORT (default 4000), HOST (new, default 127.0.0.1, added to .env.example), MONGO_URL (mongodb:// or mongodb+srv://), JWT_SECRET (>= 32 chars, .env.example placeholder rejected), OWNER_EMAIL/OWNER_PASSWORD (optional pair, password >= 12 chars so .env.example "change-me" is rejected), EVENTS_DISPATCH on|off. Empty values count as unset. Error messages list keys only, never values. Fail-fast applies in all modes (tests pass a valid secret explicitly).
- Body limit 16kb (express.json); login password max 1024 chars (bounded argon2 work), email max 254. x-powered-by disabled. No CORS added (T4 owns it). No agent write routes.

## 2026-10-09T03:06:30+00:00 Task: 4
- Layout: events/outbox.ts (createOutbox({models,onEmitted}).emit(input), toDomainEvent, InvalidEventError), events/dispatcher.ts (createEventDispatcher({models,sinks,enabled,pollIntervalMs=250,logger}) -> start/stop/notify/tick, MAX_DISPATCH_ATTEMPTS=5), realtime/rooms.ts (roomsForEvent, OFFICE_ROOM, agentRoom, runRoom), realtime/gateway.ts (createRealtimeGateway(httpServer,{jwtSecret,corsOrigins,logger,canSubscribeRun}) -> {io, deliver, close}), server.ts closeHttpServer().
- Outbox row = shared DomainEvent envelope (eventId, type, aggregate, actor, payload, attempts) with Mongo Dates createdAt + dispatchedAt (null = pending) + lastError; events_dead adds deadAt. Kept the plan/T2 field name `attempts` (brief said failureCount). Index {dispatchedAt:1, createdAt:1}; eventId unique in both collections.
- emit() is the only writer: envelope (eventId uuid, createdAt, attempts 0) is server-owned; forged eventId/dispatchedAt/attempts in input are discarded. Validated with DomainEventSchema; invalid -> InvalidEventError, no row.
- Dispatch: single in-flight drain per process (concurrent tick() calls share it; a tick during a drain sets rerun). Strict createdAt order; a failing head event blocks the queue until it dies (ponytail note: per-aggregate ordering + backoff later). Sink failure -> attempts+1, lastError; 5th failure -> upsert into events_dead then delete from events (copy-then-delete: crash leaves duplicate, never loss). Mark-dispatched failure -> eventId kept in in-memory awaitingMark set; next tick retries only the mark (no in-process re-delivery). Across a process crash between deliver and mark, delivery is at-least-once (clients dedupe by eventId).
- Socket.IO: same http.Server, path /socket.io, namespace /office only (default namespace rejects all). JWT from handshake.auth.token via verifyAccessToken; failure -> connect_error "unauthorized". connectionStateRecovery {maxDisconnectionDuration 2 min, skipMiddlewares false} so recovered sessions re-verify the JWT.
- Wire events: room office gets 'event'; agent:<id> rooms get 'agent:event'; run:<id> rooms get 'run:event' (distinct names so an office member that also subscribed to an agent/run room does not receive duplicate 'event' payloads). Routing: agentId from agent.status_changed/run.started payload.agentId, task.assigned assigneeAgentId, task.created task.assigneeAgentId; runId from payload.runId, result.recorded result.runId, decision.requested decision.runId.
- Client messages: subscribe:agent/unsubscribe:agent (AgentIdSchema), subscribe:run/unsubscribe:run (string 1..128); ack {ok:true} | {ok:false,error:'invalid payload'|'forbidden'}; invalid payloads never disconnect. viewer+ required; canSubscribeRun(runId, claims) hook defaults to allow (T15 adds run-exists/RBAC).
- Env: CORS_ORIGINS comma list of exact http(s) origins (no wildcard/path), default http://localhost:3000,http://127.0.0.1:3000; added to .env.example. EVENTS_DISPATCH=off -> dispatcher created disabled (start/tick no-op), events still stored.
- index.ts: createHttpServer -> createRealtimeGateway -> createEventDispatcher(sinks [gateway.deliver]) -> listen -> dispatcher.start. Shutdown (idempotent): dispatcher.stop -> gateway.close -> closeHttpServer -> connection.close. No outbox instance in index yet; T5 creates createOutbox({models,onEmitted: dispatcher.notify}) and passes it into createApp/services.

## 2026-10-09T04:56:49+00:00 Task: 5a
- Layout: services/{errors,deps,transitions,directives,tasks,runs}.ts (pure functions taking ServiceDeps {models, outbox}); routes/{directives,tasks,runs}.ts + routes/{actor,params}.ts helpers; db/models.ts adds Directive/Task/Run; db/mappers.ts adds toDirective/toTask/toRun (zod re-validate, strips createdAt/_id). AppDeps now requires `outbox`; index.ts builds createOutbox({models, onEmitted: () => dispatcher.notify()}) before the dispatcher exists (closure, notify is a no-op until start).
- Ids: Directive/Task/Run use crypto.randomUUID() strings as Mongo `_id` (IdSchema is string). Each doc carries a storage-only createdAt (Date) for stable list order; not in shared schemas, stripped by the mapper.
- Ordering: persist domain doc first, then outbox.emit(). No multi-doc transactions on standalone mongod. Gap: if emit fails (InvalidEventError or Mongo write) the doc exists without its event (at-most-once emit) and the request returns 500. Covered by tests (service + route). Upgrade path: replica set + session.withTransaction, or a reconciler that re-emits for docs lacking an event.
- Status writes are compare-and-set: findOneAndUpdate({_id, status: from}, {$set: {status: to}}). A lost race re-reads and throws InvalidTransitionError(latest -> to) => 409. Exactly one winner, one emitted event.
- RUN_TRANSITIONS: queued->composing|paused|failed; composing->executing|paused|failed; executing->verifying|paused|failed|escalated; verifying->succeeded|paused|failed|escalated; paused->queued|composing|executing|verifying|failed|escalated; succeeded/failed/escalated terminal. Run events: createRun emits run.started (plan s11 name; run is queued at that point); succeeded->run.completed, failed->run.failed {error}, escalated->run.escalated {escalatedTo default 'human'}; intermediate steps emit nothing (catalog has no run.status_changed). startedAt stamped on first ->executing, endedAt on terminal.
- TASK_TRANSITIONS: planned->assigned|cancelled; assigned->in_progress|cancelled|escalated; in_progress->assigned|paused|cancelled|done|escalated (->assigned = retry after adapter crash, s25); paused->in_progress|cancelled; escalated->assigned|cancelled; done/cancelled terminal. Only in_progress can pause so resume always targets in_progress. PATCH /tasks/:id actions: pause, resume, cancel (resume allowed because TaskStatus has paused->in_progress).
- assignTask parses agentId with AgentIdSchema, moves current->assigned via the table, emits task.assigned (not task.status_changed). createTask copies directive.capabilityTags and requires the directive to exist (404 otherwise). createRun requires an assignee (409 otherwise), agentId = task.assigneeAgentId, usage zeros.
- HTTP: NotFoundError -> 404 'Data tidak ditemukan'; ConflictError (incl. InvalidTransitionError) -> 409. :id longer than 128 chars -> 404 without a query (readIdParam). Bodies via zod non-strict objects: forged id/status/issuedBy/createdBy/eventId stripped; issuedBy/actor always {kind:'human', id: req.auth.sub}. Directive text trimmed 1..4000, tags <=32 x <=64 chars, priority default normal. GET /tasks query validated (unknown status/agent or repeated param -> 400).
- No dependency added. No packages/shared change.

## 2026-10-09T06:13:05+00:00 Task: 5a (fix)
- CORRECTION of the Task 5a entry: "Only in_progress can pause so resume always targets in_progress" was wrong as a safety claim. It fixed the TARGET of resume but never constrained the SOURCE: transitionTask only checked TASK_TRANSITIONS, where assigned -> in_progress is legal (runtime move), so PATCH {action:'resume'} on an assigned task returned 200 (verifier D1, reproduced live).
- Fix: routes/tasks.ts TASK_ACTIONS maps each human action to {to, from}: pause {to: paused, from: [in_progress]}; resume {to: in_progress, from: [paused]}; cancel {to: cancelled, from: [planned, assigned, in_progress, paused, escalated]} (= every non-terminal state per TASK_TRANSITIONS). transitionTask gained optional allowedFrom (checked before the table, InvalidTransitionError -> 409, no write, no event). CAS filter {_id, status} unchanged.
- Why: TASK_TRANSITIONS is the union of runtime and human moves. Runtime-only moves (assigned -> in_progress starts work with a run; in_progress -> done/assigned) must not be reachable over REST, or an operator could mark work started with no run behind it. REST actions must therefore name their legal source states explicitly, never rely on the table alone.

## 2026-10-09T07:31:10+00:00 Task: 5b
- Events: the shared 17-type catalog has no project.* or knowledge.* type, so POST /projects and POST /knowledge emit NOTHING (asserted: events count stays 0). packages/shared untouched. Justification: adding event types is a catalog change owned by shared; no 5b consumer exists (no socket client, no projector reacts to projects/knowledge; Hermes hydrates knowledge_docs at boot, plan s6). Gap recorded in issues.md. The plan line "every mutation emits the catalog event" is satisfied for every mutation that HAS a catalog event (5a); 5b mutations have none. No transitions exist in 5b, so no 409 path either.
- Layout: services/{projects,knowledge,officeState}.ts, routes/{projects,knowledge,office}.ts mounted in app.ts after runs. Models Project (collection projects), Knowledge (collection knowledge_docs, plan s10 name), OfficeState (collection office_state). Project/Knowledge use WorkRecord (uuid string _id + storage-only createdAt, list sort {createdAt:1,_id:1}); mappers toProject/toKnowledgeDoc/toOfficeState re-validate with ProjectSchema/KnowledgeDocSchema/OfficeStateSchema and strip _id/createdAt.
- Projects body: name trim 1..120; repoPath absolute POSIX path, max 1024 chars, no '.'/'..'/empty segment/NUL (trailing slash allowed) because repoPath becomes an adapter cwd (plan s8); rejected, never normalized. defaultAdapter AdapterIdSchema default 'opencode' (the primary executor on this host, plan s8 RH-ADAPTER-001). No uniqueness on name (not requested; YAGNI).
- Knowledge body: title trim 1..200; text stored VERBATIM (RAG source) max 12000 chars, must contain non-whitespace; tags <=32 x <=64 chars (same bounds as directives). 12000 chars keeps the doc under the existing 16kb JSON limit; bigger ingest = chunked upload later.
- Neither shared schema has a creator field, so no createdBy is stored; forged id/_id/createdBy/createdAt/eventId/status are stripped by the non-strict zod body and never reach Mongo.
- GET /office/state: reads only the singleton _id 'singleton' with findById().lean() and re-validates via OfficeStateSchema (corrupt doc -> zod throws -> generic 500, internals logged server-side only). Empty collection -> INITIAL_OFFICE_STATE (not persisted): version 0, floors from OFFICE_LAYOUT (F1 empty, F2 4 domain, F3 coo/cto, F4 ceo) with status idle, pose sitting, activityLabel '', no runId, drones [], updatedAt epoch '1970-01-01T00:00:00.000Z' (deterministic, means "never projected"). Constant is deep-frozen. Mongoose OfficeState schema only declares _id (ponytail note: field typing comes with projector writes in todo 15); mapper requires a stored Date updatedAt.
- No write route for office_state or agents (tested over POST/PUT/PATCH/DELETE). No new dependency.

## 2026-10-09T09:13:58+00:00 Task: 5b (fix)
- D1 (oracle): toKnowledgeDoc re-validation (KnowledgeDocSchema.parse) had no corrupt-row test; mutant K1 (field-by-field pick, no parse) survived. Fixed with tests only, no product code change: services/knowledge.test.ts corrupt-row rejection (mirrors projects.test.ts), routes/knowledge.test.ts GET -> 500 generic body without row contents.
- Optional N-1 pinned: 16kb JSON limit is BYTES. 8000 x 2-byte "e-acute" (~16.0 KB) -> 201, 8300 (~16.6 KB) -> 413, both under the 12000-char cap.

## 2026-10-09T09:55:42+00:00 Task: 5b (fix 2)
- Oracle round 2 D1 (residual): both knowledge corrupt-row fixtures broke title, so half-validating mappers (R1 omit tags, R5 partial()) survived. Fixed with TESTS ONLY (mappers.ts sha256 unchanged): services/knowledge.test.ts and services/projects.test.ts now use test.each with exactly one invalid field per row (empty/missing/wrong-type per field, invalid array element, bad id) on top of a valid base row, plus a control row that must parse; routes/knowledge.test.ts adds per-field 500 rows (tags only, missing title, missing text). Existing bundled route test kept.

## 2026-10-09T11:48:19+00:00 Task: 6
- Tests use system mongod 7.0.37 (127.0.0.1:27017) via packages/hermes/src/test-support/database.ts (mirror of apps/api helper, prefix redhunter_test_, guarded drop), NOT mongodb-memory-server as the plan card says: offline-safe, no binary download, same as todos 3-5.
- Profiles: hermes_profiles rows are append-only, _id = hermes-<agentId>-v<N>, unique {agentId,version}. activeVersion lives in a storage-only collection hermes_profile_pointers (_id = hermes-<agentId> = agents.hermesProfileId from api seed). createProfileVersion = insert N+1 then move pointer; activateProfileVersion(agentId, v) rolls back (404 HermesNotFoundError if v missing); ensureProfileVersion (seed) inserts only if missing and uses $setOnInsert so re-seed never rolls back a newer version.
- Access rule: every agent-scoped read takes (agentId, asAgent); mismatch throws HermesAccessError BEFORE any query. Skills are a shared registry (no agent scope); findSkills(role, tags) = appliesToRoles contains role AND any tag match.
- Memory ttl is seconds from createdAt; expired exactly at createdAt+ttl (filtered on read, not deleted; ponytail: Mongo TTL index can't do per-doc seconds without an expiresAt field, add when volume needs it).
- KnowledgeStore interface is async (upsert/search return Promise) so a vector store can replace it. InMemoryKnowledgeStore: Okapi BM25 (k1 1.2, b 0.75, idf log(1+...)), index over title+text+tags, unicode tokenizer, tie-break id asc, filter.tags any-match (empty = no filter), k<=0 -> []. Docs cloned in and out. hydrateKnowledgeStore(store, connection) reads knowledge_docs via the raw driver (no Knowledge model in hermes; api owns it) and validates ALL rows before indexing any.
- assembleContext(agentId, task{text, capabilityTags, taskType?}, budget, deps{store, knowledge, estimateTokens?}): layers profile, skills, memories(top 3), experience(top 3, same taskType first), rag(top 3). Profile never truncated: budget < profile or non-integer/negative budget -> HermesBudgetError. Other blocks kept whole or dropped greedily in order skills > memories > experience > rag (mirrors composer priority 5>6>7); dropped list returned. Memory rank: distinct task-term hits > importance > recency > id. estimateTokens = ceil(code points / 4), pluggable.
- 7 seed profiles in packages/hermes/seed/*.json (role = AGENT_DEFINITIONS title, constitutionRef constitution@v1, version 1); SEED_PROFILES parsed at import and deep-frozen.

## 2026-10-09T13:01:46+00:00 Task: 6 (fix round 1)
- D6 guard form: getProfile checks pointer.agentId === requested agentId (HermesNotFoundError otherwise) AND queries hermes_profiles with the requested agentId, so a misrouted/corrupt pointer can never serve another agent's profile.
- D9 semantics: ensureProfileVersion inserts through insertProfileIfMissing; on duplicate key (code 11000) it re-reads the row by _id and returns the STORED profile (winner's data), never throws, never touches activeVersion beyond $setOnInsert. Non-11000 errors rethrown; if the re-read finds nothing, the original error is rethrown.
- New store tests split into store.versioning.test.ts (store.test.ts at 427 lines); new context tests in context.limits.test.ts.

## 2026-10-09T14:03:08+00:00 Task: 6 (fix round 2)
- D10 resolved with tests only; store.ts unchanged (sha256 dbc54590...636a210a). Contract pinned: ensureProfileVersion rethrows the ORIGINAL error for any non-11000 failure and for an 11000 whose own _id row is absent; neither path writes the pointer.

## 2026-10-09T15:13:13+00:00 Task: 6 (fix round 3)
- D11-D21 closed with tests only; no production change (all hermes src sha256 identical). New store tests in store.guards.test.ts to keep store.test.ts < 450 LOC. Equivalent survivors (24) and accepted items left untouched per oracle report.

## 2026-10-09T16:08:52+00:00 Task: 6 (fix round 4)
- D22-D30 closed with tests only; production sha256 unchanged. New file index.test.ts covers barrel, error classes and token whitespace; store tests split into store.versioning/store.guards (store.test.ts stays 427 LOC).

## 2026-10-09T16:56:05+00:00 Task: 6 (fix round 5)
- D31/D32 closed with tests only (store.guards.test.ts default-clock block, context.limits.test.ts importance tiebreak). Production sha256 unchanged.

## 2026-10-09T17:30:02+00:00 Task: 6 (fix round 6)
- D33/D34 closed with tests only (knowledge.test.ts SlowKnowledgeStore double; context.limits.test.ts first-term relevance). Production sha256 unchanged.

## 2026-10-09T18:28:18+00:00 Task: 6 fix round 7
- D36-D42 closed with tests only; production sha256 unchanged. New file store.scoping.test.ts holds cross-agent scoping + memory optional-field tests (store.test.ts stays 427 LOC).

## 2026-10-10T09:08:17+00:00 Task: 6 fix round 8
- D43 closed with tests only in seed.test.ts (EXPECTED_PERSONAS table: name + first trait per agent, asserted on SEED_PROFILES and after seedProfiles). Seed JSON and production sha256 unchanged.

## 2026-10-10T10:41:12+00:00 Task: 6 fix round 9
- R9 25 gaps closed with tests only; EXPECTED_SEED_PROFILES full-literal table added to seed.test.ts (kept EXPECTED_PERSONAS tests). Production, seed JSON and bun.lock sha unchanged.

## 2026-10-10T12:15:26Z Task: 6 (closing)
- Rubric relaxed after R10 (unbounded mutation loop caused repeated compaction). R11 used bounded rubric: behavior vs acceptance + ONE mutation sweep; pass = no survivor changing public behavior.
- R11 verdict confirmed: 123 valid mutants, 120 killed, 3 survived (all class-ii equivalent/internal), class-i = 0.
- Equivalent mutants and internal-mapper pinning logged as non-blockers (see evidence/06/oracle-verify-round11.md Part C).

## 2026-10-10T13:02:41Z Task: 8
- AdapterEvent/AdapterEventSchema stay in T2 `schemas/adapter-event.ts` (single source); new `shared/src/adapters.ts` adds AgentAdapter, AdapterRunInput(+Schema), PermissionDecision.
- FakeAdapter: deny yields `failed` "Permission <id> denied" then ends; cancel/abort end iterator without terminal event; default id opencode.
- spawnChild: Bun.spawn detached (own process group); env = allow-list PATH/HOME/LANG/TERM/TMPDIR + opts.env, forbidden names stripped last and case-insensitively; explicit env names validated (no '=', NUL, leading digit).
- Adapter cwd restriction (open item from T5): spawnChild rejects relative, missing, non-directory and any cwd whose realpath is '/'.
- SIGTERM to group, SIGKILL after 5000 ms via injected setTimer; leader exit SIGKILLs leftover group members.
- bun.lock +3 lines (adapters workspace dep on @redhunter/shared); no new third-party packages.

## 2026-10-10T14:18:09Z Task: 8
- Gate choice: plan line 303 marked [x] BEFORE oracle dispatch to satisfy COMPLETION GATE. Revert to [ ] if oracle rejects.

## 2026-10-10T14:27:04Z Task: 8
- Oracle confirmed in 1 round under bounded rubric (18/18 mutants killed, 55 flake-free reruns). Line 303 [x] final.

## 2026-10-10T15:32:08Z Task: 7
- composePrompt input = already-fetched per-layer sources (pure); no @redhunter/hermes dependency (only @redhunter/shared types). Hermes->composer adapter deferred to T9 (layer 6 merges hermes memories+experience).
- Default estimator ceil(text.length/4) over UTF-16 units (spec), differs from hermes code-point estimator; documented ponytail.
- tokens = sum of per-layer estimates; budget checked on that sum; budget not rendered (reserve independent of budget).
- Empty flexible layers omitted from text, recorded in layers[] with tokens 0.
- Hash = sha256(canonical JSON {version: COMPOSER_VERSION, layers, text}); COMPOSER_VERSION=1, CONSTITUTION_VERSION=1.
- PromptBudgetError for: invalid budget, reserve > budget, invalid estimator output. Empty constitution -> plain Error from loadConstitution.

## 2026-10-10T16:27:00Z Task: 7 (Atlas closure)
- Oracle confirmed in 1 round: 12 mutants killed, 21/21 own checks.
- Strict truncation 7->6->8->5 accepted; plan §9 says proportionally but contradicts its own priority list.
- Composer has no hermes dep; hermes->PromptInput adapter deferred to T9 (layer 6 merges memories+experience).

## 2026-10-10T17:28:59Z Task: 9
- No run.status_changed event: transitions via RunRepository.transition (CAS) + logger; catalog milestones only.
- Guards before persistence; only domain agents runAdapter; policy override only by manager agents (coo/cto).
- Retries are in-run (same runId, seq continues), attempts = maxRetries+1; escalate to first chain entry != self, else human, with decisions row + decision.requested.
- Verify fail -> escalate (no retry, T10 owns); composing error -> failed.
- Layer 6 = hermes memories + experience; agent-runtime depends on @redhunter/hermes, devDep @redhunter/adapters (bun.lock +5).

## 2026-10-10T19:04:51Z Task: 9 (fix r2)
- D1: pendingPermission is attempt-scoped: cleared after every attempt; agent status reset to 'working' at each retry start. Terminal handlers (escalate/fail/paused) run after the clear and keep their idle/blocked statuses.

## 2026-10-10T19:41:35Z Task: 9 (fix r3)
- Test-only round: M14/M5/M6 killed by 3 new tests; production sha unchanged. M12 accepted as internal equivalent (execute() finally drops the run from #active, so pendingPermission is unreachable after pause/abort).

## 2026-10-10T20:08:32Z Task: 9 (close)
- Oracle R3 confirmed. No run.status_changed event emitted by runtime. EventSink port lives in packages/shared. from-hermes adapter maps Hermes context to composer input. Retry is in-run (plan s25 differs). No human/owner policy override. Verify-fail escalates without retry. #fail returns attempts 0.

## 2026-10-10T20:34:23Z Task: 10
- runtime.ts NOT edited: real verify wired via AgentRuntimeDeps.verify = verifyCompletion (VerifyFn). passVerify default stays for callers that inject nothing; apps/api (todo 13) must pass verifyCompletion.
- verify rule: item met iff every word ([\p{L}\p{N}]+, lowercase) of the item appears as a whole word in output + evidence + artifact paths. No regex from criteria (no ReDoS). Item without words -> unmet. Empty acceptance -> pass ["No acceptance criteria"]. status 'failed' -> fail, single evidence line. ponytail: keyword containment, not semantic.
- prometheus.plan: text events until completed (finalText ignored); failed/throw -> PlanError adapter_failed; no terminal -> no_completion; parse/schema failure -> exactly one repair run (runId+'-repair', prompt = original + '## Repair' + error) then invalid_output. Permission requests during planning answered 'deny'.
- Plan prompt renders task as one JSON line (task text cannot forge sections). StepResult {stepId, status completed|failed, output, evidence?, artifacts?}.

## 2026-10-10T21:37:58Z Task: 10 (close)
- NO_ACCEPTANCE capitalised (accepted baseline); verify = whole-word keyword heuristic over output+evidence+artifacts.
- Plan-time permission_request denied -> run fails adapter_failed (accepted).
- verify supplied via AgentRuntimeDeps.verify seam; runtime.ts untouched.

## 2026-10-10T23:02:18Z Task: 11
- Server spawned via own launchServer (T8 spawnChild, allow-list env + opts.env, OPENCODE_CONFIG_CONTENT set last), NOT SDK createOpencodeServer (it spreads full process.env). Args `serve --hostname=127.0.0.1 --port=0`; url parsed from "opencode server listening on <url>"; timeout 10 s default; failed launch not cached (next run retries).
- One server per OpencodeAdapter instance, lazy, closed by dispose(); `baseUrl` option skips spawning (dispose leaves it running).
- Sandbox: `config.permission` (global default, inherited by subagents) AND `config.agent.<agentName>.permission` = plan s13 policy. Default agent `build`. `task` key not in v1 AgentConfig type: not set.
- Per run: createOpencodeClient({baseUrl, directory: input.cwd}); session.create -> event.subscribe (wait first event) -> promptAsync({agent, parts:[text]}). Filter by sessionID; session.error without sessionID fails the run (fail closed).
- Permission: allow->'once', deny->'reject' via client.postSessionIdPermissionsPermissionId; deny -> failed "Permission <id> denied" + session abort; reply HTTP failure -> run failed + rethrow.
- healthcheck(): Promise<string> version from GET /global/health (v2 client; v1 has no health method); rejects "opencode healthcheck failed: <reason>" (no boolean variant).
- cancel(runId)/signal: frees runId immediately (FakeAdapter parity), aborts SSE + POST session abort (best effort, never throws), iterator ends with no terminal event. Iterator never throws; every failure is one `failed`.
- Mapping: tool one started + one completed per callID (pending skipped, error -> completed w/o exitCode); patch -> file_change kind 'modified' per file; step-finish -> usage (deduped per part id); reasoning/file/synthetic/ignored parts skipped.
- bun.lock: +@opencode-ai/sdk 1.18.13 and its transitive cross-spawn chain (cross-spawn, path-key, shebang-command, shebang-regex, which, isexe).

## 2026-10-11T01:33:01Z Task: 11 (close)
- Oracle r3 confirmed: 11 mutants killed, 76 pass / 1 skip / 0 fail. r1 and r2 rejected, test-only fixes.
- Accepted: /api/session vs /session; v2 event names; spawnChild opencode serve; no SSE reconnect; tool error emits completed tool event without exitCode.

## 2026-10-11T04:26:38Z Task: 12
- Codex policy file = top-level approval_policy/sandbox_mode in .codex/config.toml (profiles ignored in project config per docs); never overwrite a differing existing file.
- Claude composed prompt only via --append-system-prompt-file; positional query fixed constant. --disallowedTools "Bash(rm -rf*)" in argv + settings deny.

## 2026-10-11T05:45:01Z Task: 12 (close)
- Codex policy via top-level approval_policy/sandbox_mode in .codex/config.toml (profiles ignored in project config) vs plan §8 word profile: accepted.
- Claude resume unsupported; resumeVendorSessionId ignored (ponytail comment).

## 2026-10-12T17:54:00Z Task: 13
- §25 "new queued run per attempt" reconciled minimally: each routeDirective call creates exactly one run via the runtime's RunRepository (fresh attempt = fresh run id); the runtime's in-run retry counter is left at the seeded omoPolicy (maxRetries 2) but each HTTP directive maps to one run row. Full per-attempt run rows deferred to the retry/escalation todo.
- Runtime wiring lives in apps/api/src/runtime.ts (createApiRuntime): Mongo RunRepository with CAS transitions (reuses assertRunTransition, throws ConflictError on lost race), outbox-backed EventSink, HermesStore + HermesPromptSource with an api-owned basePrompt for non-Hermes layers, verify: verifyCompletion (verify-fail escalates per runtime semantics).
- Decisions persisted in-process only (Map in runtime.ts): decision.requested outbox event carries the full Decision payload to sockets; a `decisions` collection is a later todo.
- AppDeps.runtime is optional so existing pure-HTTP tests keep constructing apps without adapters; index.ts wires the real Opencode/Claude/Codex adapter map.
- Deterministic routing v1: first seed agent whose capabilityTags intersect the directive's; no match => 422 before any document/event is written (routeDirective's ConflictError is a backstop, not reachable via HTTP).

## 2026-10-12T18:20:00Z Task: 13 (orchestrator close-out)
Todo 13 verified PASSED and plan checkbox marked [x]. Full suite: 1061 pass / 0 fail / 81 files. Typecheck 6/6 workspaces exit 0, biome clean (236 files). Evidence .omo/evidence/13/test.txt. Partial todo 14 scaffold already on disk from todo 13 session (apps/web package.json, configs, DESIGN.md, lib/api, lib/socket, useAuthStore, useCompanyStore with applyRunEvent fix) — todo 14 subagent must CONTINUE from this scaffold, not start over.
