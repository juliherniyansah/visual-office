# Issues — redhunter-master-plan

Problems and gotchas encountered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## 2026-10-08T23:16:33+00:00 Task: 1
- Host port 27017 already bound by a system `mongod` (systemd active, pid 7806, /usr/bin/mongod --config /etc/mongod.conf) plus an unrelated container `rh-ai-mongo-1`. Not touched. docker-compose port is now `127.0.0.1:${MONGO_HOST_PORT:-27017}:27017`; verified with `MONGO_HOST_PORT=27018 docker compose up -d mongo` (ping ok) then `down`. Owner decides: use the system mongod at 27017, or run compose with MONGO_HOST_PORT=27018 and set MONGO_URL to match.
- `rtk find` rejects compound predicates; `rtk bun` is not a valid wrapper in this env. Use plain `find` / `bun`.
- LSP biome not installed (user declined); `tsc` + `biome check` used as diagnostics.
- Correction (Task 1): `rtk bun` DOES work (`rtk bun --version` -> 1.3.14). Earlier failure came from `rtk find` aborting the `&&` chain. Only `rtk find` with compound predicates is broken.

## 2026-10-09T00:04:14+00:00 Task: 2
- Brief listed collections knowledge and usage; plan section 10 names knowledge_docs and has no usage collection (usage embedded in runs). Implemented per plan; flagged in report.
- Plan section 11 names events but no payload fields; payload shapes are minimal picks (see decisions.md). Todos 4/5/9/15 may need fields added; extend in shared, never redefine downstream.
- Todo 9 mentions an EventSink interface defined in packages/shared; not in todo 2 scope (no runtime logic). Todo 9 should add it.
- TS 7 native tsc has no tsserver, lsp_diagnostics unavailable for TS files.

## 2026-10-09T01:38:20+00:00 Task: 3
- Plan/brief name mongoose without version; latest mongoose 9.11.1 crashes on import under bun 1.3.14 (bson 7.3.x uses unimplemented node:v8 startupSnapshot.isBuildingSnapshot). Pinned mongoose ~8.24.5. Upgrade path: bun release implementing v8.startupSnapshot, or bson fix.
- Plan test strategy names mongodb-memory-server; used the system mongod (7.0.37 at 127.0.0.1:27017) with a unique redhunter_test_* DB per run instead (no binary download, offline-safe). Tests read MONGO_URL as base URL.
- apps/api/.env.example OWNER_PASSWORD=change-me (9 chars) is now rejected by loadEnv (min 12). Owner must set a real password; JWT_SECRET placeholder is also rejected. .env.example values kept as placeholders (only HOST line added).
- No operator-only route exists in todo 3; requireRole("operator") 403-for-viewer is asserted on a test-only stub POST /directives using the production middleware and real login tokens. Todo 5 must add requireRole("operator") on the real POST /directives.
- Plan section 12 lists GET /agents/:id; not in todo 3 acceptance, left for todo 5/15.
- AgentSchema has no createdAt/updatedAt; agents/users carry no timestamps yet.

## 2026-10-09T03:06:30+00:00 Task: 4
- bun 1.3.14: http.Server close callback never fires after a websocket upgrade -> io.close() hangs. Bounded with 1 s timeouts; revisit when bun fixes it (remove settleWithin in gateway.close and the timer in closeHttpServer).
- Brief named outbox field failureCount; shared DomainEvent envelope (T2) uses attempts. Kept attempts to avoid touching packages/shared.
- Poll interval 250 ms is fixed per-process; restart replay is at-least-once across crashes between sink delivery and mark (in-process it is exactly-once). Web client (T7) must dedupe by eventId.
- Head-of-line blocking: a poison event delays later events by up to ~5 ticks before going to events_dead. Fine for v1 (single process, in-process sinks).
- No route emits events yet (T5). index.ts does not construct an outbox; T5 wires createOutbox into createApp.
- Pre-existing unrelated bun processes (whatsapp-monitor 'bun run src/index.ts', pids 275760/673842) seen on the host; not touched.

## 2026-10-09T03:49:10+00:00 Task: 4 (D1 fix)
- D1 (oracle): no test pinned the literal 5 for events_dead. Fixed in test code only (dispatcher.test.ts). Mutations on a /tmp copy: MAX_DISPATCH_ATTEMPTS=6 KILLED, =4 KILLED (also killed by behavior assertions alone with the constant check removed); original 5 passes. Evidence .omo/evidence/04/mutation-d1.txt. No product source changed.

## 2026-10-09T04:56:49+00:00 Task: 5a
- At-most-once emit gap: domain doc persisted, emit fails -> doc without event, client gets 500 (asserted). Needs replica set transactions or a reconciler later (todo 20 recovery).
- AppDeps.outbox is now required; app.test.ts, server.test.ts and test-support/realtime.ts updated to pass createOutbox (signature change only, no assertion changed).
- Catalog has no run.status_changed: intermediate run transitions (composing/executing/verifying/paused/queued) emit nothing in 5a. The 3D office (todo 15) may need them; add an event type in shared when the projector needs it.
- run.started is emitted at createRun (status queued), matching the catalog name, not at ->executing. Revisit in todo 9 if runtime semantics need a separate event.
- /tmp/opencode/mut5a (mutation copy) left in scratch: rm -rf outside cwd is blocked by the Safety Net hook.

## 2026-10-09T06:13:05+00:00 Task: 5a (fix)
- Event catalog gap (from verifier N-c iii): packages/shared has no run.status_changed, so intermediate run transitions (queued -> composing -> executing -> verifying, and paused/resume) emit NO event. Plan section 4 says every transition is one DomainEvent row. Catalog work needed in todo 9 (runtime state machine), todo 13 (pipeline) or todo 15 (3D office projector may need per-step run status for agent poses). Not changed here (packages/shared out of scope).
- Optional pins DONE: N4 (readIdParam length guard: Run/Task findById spied, not called for 129-char id on GET /runs/:id, GET /runs/:id/events, PATCH /tasks/:id; 128-char id still reaches the lookup, off-by-one variant N4b killed) and N5 (GET /runs/:id/events ignores an event with the same aggregate.id but kind task).
- Manual QA needed an assigned task while no REST route creates tasks: seeded via a throwaway script calling the services against the live DB (deleted after). Todo 13 removes the need.
- Scratch copies /tmp/opencode/fix5a-red and /tmp/opencode/fix5a-mut left (rm -rf outside cwd blocked by Safety Net).

## 2026-10-09T07:31:10+00:00 Task: 5b
- Catalog gap: no project.created / knowledge.ingested event types in packages/shared, so 5b mutations emit nothing. If the web dashboards (todo 14) or Hermes hot-reload need live updates, add the types in shared first, then emit from createProject/createKnowledgeDoc (persist-first, same at-most-once gap as 5a).
- Knowledge ingest is append-only, no update/delete, no dedupe by title; Hermes (todo 6) hydrates the whole collection at boot. Body cap 16kb limits text to 12000 chars; large docs need chunked ingest.
- Project repoPath is validated for shape only (absolute, no traversal segments); existence/permissions on disk are NOT checked (adapter healthcheck/todo 11-12 territory). No uniqueness on project name.
- GET /projects, /knowledge and /office/state ignore all query keys (unknown keys including operator-shaped ones like name[$ne]); there is no filtering in 5b, so nothing reaches Mongo from the query.
- Equivalent mutant E1 (office_state schema strict option) survives by design while 5b only reads with lean(); revisit when todo 15 adds writes.
- tmux: the first detached session for manual QA died silently (likely race with the tmux server restart after the previous session closed); second attempt with a wrapper command worked. Always verify the server log before curling.
- Scratch copies /tmp/opencode/mut5b, mut5b-run, mut5b-run2, mut5b-run3 left (rm -rf outside cwd blocked by Safety Net).

## 2026-10-09T09:05:00+00:00 Task: 5b (verify)
- BLOCKING (D1): toKnowledgeDoc re-validation unguarded; mutant replacing KnowledgeDocSchema.parse with a hand-picked object survives (projects has the equivalent test at services/projects.test.ts:55, knowledge does not). Evidence: .omo/evidence/05/verifier-5b.txt.
- Note: 16kb JSON body limit (T3) not pinned by any test (all 413 tests send 1 MB); 12000-char multi-byte knowledge text exceeds 16kb -> 413 instead of 400.
- Note: repoPath '/' accepted; decide in todo 8 whether to restrict adapter cwd.

## 2026-10-09T09:13:58+00:00 Task: 5b (fix)
- Byte vs char mismatch: knowledge text cap is 12000 CHARS but express.json limit is 16kb BYTES. 12000 chars of 2-4 byte UTF-8 (Indonesian accents are 1-2 bytes, emoji/CJK 3-4) exceed 16kb and get 413 before zod runs. Accepted for v1 (413 is a clear, tested answer); chunked ingest or a higher per-route limit later if real docs hit it.
- Scratch copies /tmp/opencode/fix5b-mut and /tmp/opencode/fix5b-run left (rm -rf outside cwd blocked by Safety Net).

## 2026-10-09T09:30:00+00:00 Task: 5b (verify r2)
- BLOCKING (D1 residual): knowledge corrupt-row fixtures corrupt title and tags together, so partial re-validation survives (R1: omit tags; R5: partial()). Fix: one corruption per row (tags-only, missing title). Evidence: .omo/evidence/05/verifier-5b-round2.txt.
- Note: projects.test.ts:55 has the same bundled-corruption shape.

## 2026-10-09T09:55:42+00:00 Task: 5b (fix 2)
- Same per-field gap likely exists for other mappers (toDirective, toTask, toRun, toAgent, toPublicUser, toOfficeState): their corrupt-row coverage is not per-field. Not in 5b scope; apply the per-field table pattern when those modules are next touched (or in F2 quality wave).
- First typecheck after the edit failed on test-only typing (raw-driver insert casts): bun test does not type-check, always run bun run typecheck after test edits.
- Scratch copies /tmp/opencode/fix2-5b-mut and /tmp/opencode/fix2-5b-run left (rm -rf outside cwd blocked by Safety Net).

## 2026-10-09T10:05:00+00:00 Task: 5b (verify r3)
- Round-2 D1 RESOLVED: per-field corrupt rows (knowledge 11, projects 10) + controls; 25/25 non-equivalent mappers/limit/sort mutants KILLED on a fresh copy (R1,R5,R7-R9,T1-T6,K1,K1b,P1-P7,K9 x3,L1,L2). Gates 241/0, typecheck 6/6, Biome 106.
- E1 (office_state strict:false) confirmed equivalent: no write path to office_state in non-test source; lean() read + OfficeStateSchema.parse. Re-check in todo 15 when the projector writes.
- Verdict: confirmed. Evidence: .omo/evidence/05/verifier-5b-round3.txt.

## 2026-10-09T11:48:19+00:00 Task: 6
- No shared schema/collection for the profile activeVersion pointer; kept storage-only (hermes_profile_pointers) inside packages/hermes. If dashboards need it, add to packages/shared COLLECTION_SCHEMAS later.
- Hermes does not register a Knowledge mongoose model (api owns knowledge_docs); hydration uses connection.collection('knowledge_docs'). If api and hermes share one connection later, no model-name clash.
- Mongoose models are registered under names HermesProfile/HermesProfilePointer/HermesMemory/HermesSkill/HermesExperience: no clash with api model names on a shared connection.

## 2026-10-09T13:01:46+00:00 Task: 6 (fix round 1)
- Concurrent createProfileVersion for one agent: loser rejects with raw MongoServerError E11000 (append-only safety holds, asserted). Left as raw driver error; wrap in a typed HermesConflictError later if a caller needs to retry.
- BM25 averageLength counts all docs incl. tag-filtered ones (oracle K18, accepted minor); unchanged.
- Scratch left: /tmp/opencode/mut06r2.py, mut06r2.out, post-fix.sha, red06.txt, green06.txt.

## 2026-10-09T14:03:08+00:00 Task: 6 (fix round 2)
- None new. Accepted items unchanged: K18 averageLength, P4 raw E11000 on concurrent createProfileVersion, code-point token estimate. Scratch: /tmp/opencode/fix3-hermes/mut.py.

## 2026-10-09T15:13:13+00:00 Task: 6 (fix round 3)
- Mutation runs with O07 (no awaited model.init) leave empty redhunter_test_* DBs (index builds after drop); 3 such DBs dropped manually by exact pattern ^redhunter_test_\d+_[0-9a-f]{8}$. Normal runs leave []. Oracle round 4 should expect/clean the same.
- Scratch: /tmp/opencode/fix3-hermes/{mut4.py,mut4.out,pre-round3.sha,models.ts.orig}.

## 2026-10-09T16:08:52+00:00 Task: 6 (fix round 4)
- None new. Accepted/equivalent items unchanged. Scratch: /tmp/opencode/fix3-hermes/{mut5.py,mut5.out,pre-round4.sha}.

## 2026-10-09T16:56:05+00:00 Task: 6 (fix round 5)
- None new. Scratch: /tmp/opencode/fix3-hermes/{mut6.py,mut6.out,pre-round5.sha,post-round5-prod.sha}.

## 2026-10-09T17:30:02+00:00 Task: 6 (fix round 6)
- None new. Scratch: /tmp/opencode/fix3-hermes/{mut7.py,mut7.out,pre-round6.sha,post-round6-prod.sha}.

## 2026-10-09T18:28:18+00:00 Task: 6 fix round 7
- No real bug found. D35 (teardown) reserved by oracle, not observed. Scratch: /tmp/opencode/fix3-hermes/{mut8.py,mut8.out,pre-round7.sha,post-round7-prod.sha}.

## 2026-10-10T09:08:17+00:00 Task: 6 fix round 8
- None new. Scratch: /tmp/opencode/fix3-hermes/{mut9.py,mut9.out,red-round8.txt,pre-round8.sha,post-round8-prod.sha}.

## 2026-10-10T10:41:12+00:00 Task: 6 fix round 9
- No real bug found. Seed literals now duplicated in seed.test.ts by design (content pin); any intentional seed edit must update the table. Scratch: /tmp/opencode/fix3-hermes/{mut10.py,mut10-before.out,mut10-after.out,pre-round9.sha,post-round9-prod.sha}.

## 2026-10-10T12:15:30Z Task: 6 (closing)
- Accepted design gaps: InMemoryKnowledgeStore.averageLength over unfiltered docs; assembleContext skills layer uncapped; concurrent createProfileVersion raw E11000; code-point token estimate heuristic.
- Profile activeVersion pointer not in shared COLLECTION_SCHEMAS; add if dashboards need it (todo 15).

## 2026-10-10T13:02:41Z Task: 8
- None blocking. Large child output must be drained by the caller (pipe back-pressure); documented on ChildHandle.
- Allow-list does not include vendor keys by default; T11/T12 must pass OPENAI_API_KEY / ANTHROPIC_API_KEY through opts.env explicitly.
- Scratch left: /tmp/opencode/t8 (mutation runner, RED logs) and /tmp/opencode/t8probe (Bun behaviour probes).

## 2026-10-10T16:27:03Z Task: 7 (Atlas closure)
- Composer default estimator ceil(text.length/4) is UTF-16; hermes estimator is code-point. Mismatch is minor; unify if budgets drift.
- Mention strict-vs-proportional contradiction in final owner report.

## 2026-10-10T17:28:59Z Task: 9
- Plan §25 describes retry as a new queued run per attempt; T9 retries in-run. Reconcile in T13/T20 if needed.
- Human owner cannot override OmoPolicy via resolvePolicy (manager agents only).
- runtime.ts 334 LOC (>250 target). Scratch: /tmp/opencode/t9/{mut.py,mut.out,pre-mut.sha}, /tmp/opencode/bun.lock.t9.before.

## 2026-10-10T18:56:21Z Task: 9 (oracle)
- REJECTED. D1: runtime keeps pendingPermission after an attempt ends (failed/throw/ended) while permission pending -> retry attempt shows agent waiting_permission and stale answerPermission(id) is accepted + forwarded to new adapter. Repro /tmp/opencode/t9-oracle/edges2.ts. Fix: clear pendingPermission + emit working when attempt ends.
- T1: M08 (permission round-trips run executing->paused->executing via repo) survives agent-runtime suite; add transitions assertion in runtime.interactive.test.ts permission test.
- Info: pause during backoff still calls adapter.start with aborted signal (final state correct).
- Report: .omo/evidence/09/oracle-verify.md. Scratch: /tmp/opencode/t9-oracle/.

## 2026-10-10T19:04:51Z Task: 9 (fix r2)
- D1 root cause: per-attempt state (pendingPermission) lived on per-run ActiveRun and was only cleared by answerPermission; a crash/throw/stream end while waiting left it set across retries.
- Why the 36-mutant sweep missed it: mutants only mutate existing code; a MISSING clear has no line to mutate, and no test combined "permission pending" with "attempt dies without an answer" (FakeAdapter always blocks until answered). Scratch: /tmp/opencode/t9/{mut-r2.py,mut-r2.out}.

## 2026-10-10T19:41:35Z Task: 9 (fix r3)
- M12 equivalent survivor documented (not testable publicly). Observed foreign process "bun test src/socket" (another session), left untouched. Scratch: /tmp/opencode/t9/{mut-r3.py,mut-r3.out}.

## 2026-10-10T20:08:32Z Task: 9 (close)
- Worker r1 returned empty text; resume rejected by gate (promptAsync skipped: active); false no-changes hook; transient leaked test DB.
- Oracle R1 found D1 prod bug + T1 test gap missed by worker 36-mutant sweep. Oracle R2 rejected on 3 test-gap survivors (M14, M5, M6), fixed in r3 (test-only). M12 internal equivalent survivor. COMPLETION GATE hook fired early twice. T7 snapshot hash 676d2bbe... unrecorded in T7 evidence.

## 2026-10-10T20:34:23Z Task: 10
- packages/agent-runtime/package.json gained direct dep zod ^4.6.5 (bun.lock +1 line). Needed for WorkPlanSchema; zod already in lockfile.
- passVerify stays the runtime default; production wiring (verify: verifyCompletion) is todo 13's job. Retry-on-verify-fail still not implemented (verify fail escalates, per T9 decision).

## 2026-10-10T23:02:18Z Task: 11
- Plan s8 / T11 card routes say `/api/session/...` and `/api/event`; real SDK v1 + server routes have no `/api` prefix (`/session/{id}/permissions/{permissionID}`, `/event`). Adapter uses SDK methods only. Plan not edited.
- SDK 1.18.13 types lag server 1.18.35 (v2 event names); mapper accepts both. Revisit if the SDK pin is bumped (v2 client has typed `permission.asked`).
- No SSE reconnect (sseMaxRetryAttempts 1): a dropped stream fails the run ("event stream ended before the session finished"). ponytail: add Last-Event-ID resume if long runs see drops.
- Live smoke used stored opencode credentials under HOME (no vendor key passed); consumed ~140k input tokens per run due to the user's global opencode plugins/instructions (OhMyOpenCode/DCP loaded from ~/.config/opencode). apps/api wiring (todo 13) may want an isolated OPENCODE config dir.
- Foreign `opencode serve --port 4097` (pid 7271, another session) observed, untouched. Scratch: /tmp/opencode/t11probe/ (probe.ts, events.jsonl, reset*.ts, mut.py), /tmp/opencode/bun.lock.t11.before.

## 2026-10-11T00:30:45Z Task: 11 (fix r1)
- None new. test-support/fixture-server.ts now 197 LOC (sseCounts/waitForClientClose). Scratch: /tmp/opencode/t11fix/{pre.sha,mut.py,mut.out,probe-cancel.ts,*.ts backups,run1-5.txt}.

## 2026-10-11T00:59:10Z Task: 11 (fix r2)
- None new. Production unchanged (event-mapper.ts cmp OK). Scratch: /tmp/opencode/t11fix2/{event-mapper.ts,mut.py,mut.out,full.txt,run1-5.txt,biome.txt}.

## 2026-10-11T01:33:01Z Task: 11 (close)
- r1 gaps: dedupe branch, listener cleanup, request-log. r2 gaps: mapper filters, session-less events.

## 2026-10-11T04:26:38Z Task: 12
- Plan flag `--permission-prompts all`: current claude docs list only host|none; may fail on real CLI. Kept verbatim, owner to confirm (OPEN DECISION 5).
- Claude stream-json may need --verbose (all doc examples include it); not added (not in plan).
- Claude resume flag not in plan; resumeVendorSessionId ignored for claude.

## 2026-10-11T05:45:01Z Task: 12 (close)
- OWNER: --permission-prompts all kept verbatim per §8; current claude docs list only host|none, may fail on real CLI.
- OWNER: headless answerPermission only records; CLIs lack reply channel, permission_request arrives after the fact.
- OWNER: codex/claude binaries absent on this host.

## 2026-10-12T17:54:00Z Task: 13
- Pipeline failures after a 201 response are only observable via domain events and a console.error in routes/directives.ts (no directive.status update or run.failed -> directive linkage yet).
- RUNS_CWD = process.cwd() in runtime.ts: adapter runs inherit the api process cwd; per-project workspaces are a later todo.
- Decisions are not persisted to Mongo (in-process Map); restart loses pending decision records (decision.requested events remain in the outbox).

## 2026-10-12T18:05:00Z Task: 13 (re-verify)
- Root `bun install` (todo 14 scaffold) regressed apps/api typecheck via @types/node drift; fixed structurally in realtime/gateway.ts. Watch for similar breakage when adding web deps.

## 2026-10-12T18:12:00Z Task: 13 (web scaffold typecheck fix)
- useCompanyStore assumed run.* event payloads carry a Run document; none do (run.started = {runId,taskId,agentId,adapterId}). Fixed by proper union narrowing in applyRunEvent + lightweight RunSummary; no `as any`.

## [2026-04-16] TypeScript errors blocking typecheck
**Status:** FIXED
**Files:** models.ts, agentHermes.ts, officeProjector.ts, officeProjector.test.ts
**Issues:**
1. models.ts:250 — invalid generic `<OfficeStateRecord>` on Schema (OfficeState has no 'type' field)
2. agentHermes.ts:22 — `.toSorted()`/`.toReversed()` ES2023 methods not in target
3. officeProjector.test.ts — missing `attempts: 0` field in 5 DomainEvent objects
4. officeProjector.ts:100 — `floorOfAgent()` returns `string | FloorId`, needed cast to `FloorId`
**Fix:** Removed generic, replaced with spread+sort/reverse, added attempts field, added FloorId cast.
**Verification:** `bunx tsc --noEmit` clean for api/shared/web.
