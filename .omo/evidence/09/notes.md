# T9 RH-OMO-001 AgentRuntime, state machine, OmoPolicy, authorize

## Files
- NEW `packages/shared/src/event-sink.ts` (+ test): `EventSink { emit(input: DomainEventInput): Promise<void> | void }`,
  `DomainEventInput` (= DomainEvent minus envelope; type/payload correlated), `DomainEventInputOf<T>`. Exported from shared index.
- NEW `packages/agent-runtime/src/`:
  - `authorize.ts` (35 LOC): `AGENT_ACTIONS`, `authorize(agentId, action): boolean`, `assertAuthorized`, `AuthorizationError`.
  - `state-machine.ts` (58): `RUN_TRANSITIONS` (mirror of apps/api), `assertRunTransition`, `isTerminalRunStatus`,
    `InvalidRunTransitionError`, `RunStateMachine`.
  - `policy.ts` (38): `resolvePolicy`, `PolicyOverrideError`.
  - `ports.ts` (98): all ports + `NOOP_LOGGER`.
  - `runtime.ts` (334): `AgentRuntime`, `UnknownAdapterError`, `RunNotActiveError`, `escalationTarget`, `backoffDelayMs`.
  - `attempt.ts` (101): one adapter attempt (event mapping, usage/artifact accumulation, worker drain).
  - `run-events.ts` (95): catalog event builders (actor = run agent).
  - `workers.ts` (55): `WorkerTracker`, `workerLabel`.
  - `prompt/from-hermes.ts` (70): `promptInputFromHermes`, `HermesPromptSource`, `PromptBase`, `HERMES_CONTEXT_VERSION`.
  - tests: authorize, state-machine, policy, workers, prompt/from-hermes, runtime, runtime.interactive,
    runtime.integration, index.runtime (existing index.test.ts untouched).
  - test-support: `in-memory.ts` (RunRepository CAS, DecisionRepository, ExperienceWriter, RecordingSink, RecordingLogger),
    `adapters.ts` (SequenceAdapter over FakeAdapter, ThrowingAdapter), `harness.ts`.
- MOD `packages/agent-runtime/src/index.ts` (barrel), `package.json` (dep `@redhunter/hermes`, devDep `@redhunter/adapters`).
- MOD `bun.lock` +5 lines (two workspace links, no third-party packages).
- T6/T7/T8 production untouched: prompt/{budget,composer,layers,constitution}.ts sha16 identical to ref-start.txt.
  `__snapshots__/composer.hash.test.ts.snap` mtime bumped by bun test run only (content check passes; not edited).

## Ports (for T10 / T13)
```ts
interface EventSink { emit(input: DomainEventInput): Promise<void> | void }            // @redhunter/shared
interface RunRepository {
  create(run: Run): Promise<Run>;
  transition(runId, from: RunStatus, to: RunStatus, patch?: RunPatch): Promise<Run>;   // CAS on `from`
}
type RunPatch = Partial<Pick<Run,'promptSnapshot'|'vendorSessionId'|'usage'|'startedAt'|'endedAt'|'error'>>
interface DecisionRepository { create(decision: Decision): Promise<Decision> }
interface ExperienceWriter { addExperience(input: ExperienceInput): Promise<HermesExperience> } // HermesStore fits
interface PromptSourceProvider { load(request: RunRequest, budget: number): Promise<{context: AssembledContext, base: PromptBase}> }
  // default impl HermesPromptSource({store, knowledge, base: (request) => PromptBase})
type VerifyFn = (completion: {finalText, structured?, artifacts[]}, request: RunRequest) => {verdict, evidence[]} | Promise<...>
type BackoffFn = (retry: number) => Promise<void>   // default sleep 1s * 2^(retry-1)
interface Logger { info(message: string, fields?: Record<string, unknown>): void } // default no-op
AgentRuntimeDeps = { adapters: Map<AdapterId, AgentAdapter>, events, runs, decisions, experience, promptSource,
                     verify?, backoff?, logger?, now?: () => Date, newId?: () => string }
AgentRuntime.execute(request: RunRequest): Promise<{run, attempts, result?}>
AgentRuntime.answerPermission(runId, permissionId, decision): Promise<void>
AgentRuntime.pause(runId): Promise<void>
RunRequest = { runId, taskId, agentId, adapterId, cwd, task: {text, capabilityTags, taskType?, acceptance[]},
               agentPolicy: OmoPolicy, policyOverride?: {override: OmoPolicyOverride, actor: Actor} }
```

## Decisions
- No `run.status_changed` event (not in catalog, not invented). Every transition goes through
  `RunRepository.transition(runId, from, to, patch)` (CAS, mirrors apps/api transitionRun) and is logged
  (`logger.info('run transition', {runId, from, to})`). Catalog milestones emitted: run.started/completed/failed/escalated.
- RUN_TRANSITIONS mirrored (test pins equality with the apps/api literal); packages cannot import apps.
- Guards (authorize runAdapter, policy RBAC, adapter lookup) run BEFORE the run row is created: a rejected request persists
  nothing and emits nothing. Only domain agents may run adapters.
- authorize takes plain strings (untrusted input), deny by default incl. prototype keys. Mapping derived from
  AGENT_DEFINITIONS role (single source).
- Policy: base and override both re-validated with OmoPolicySchema/OmoPolicyOverrideSchema; empty override needs no RBAC;
  non-empty override only from actor kind 'agent' with role manager (coo/cto). Humans: not accepted here (task RBAC says
  COO/CTO only; human owner path would be a separate decision for T13).
- Retry: adapter `failed`, throw from start/iteration, or stream end without terminal event = failed attempt.
  attempts = maxRetries + 1; backoff(retry) called before each retry; run stays `executing` across retries (seq continues),
  so retries are in-run (plan §25 "new run queued" model left to T13/T20 if wanted).
- Escalation target = first entry in escalationChain that is not the agent itself, else 'human'. Escalation creates a
  `decisions` row (options retry/reassign/cancel) and emits run.escalated + decision.requested.
- verify fail (injected) -> escalate from `verifying`, no retry (verify-driven retry is T10).
- Composing errors (Hermes/composer) -> run `failed` + run.failed (not retried).
- Permission: decisions row (options allow/deny), run.permission_requested + decision.requested, agent waiting_permission,
  run stays executing. answerPermission sets agent 'working' BEFORE forwarding (adapter events then follow in order);
  unknown permission throws without forwarding.
- Pause: aborts signal + adapter.cancel; run -> paused, agent -> blocked, no retry/escalation. No timeout (todo 18).
- Workers: tool name 'task'; label = input.subagent_type ?? description ?? 'task'; completion pairs FIFO by label
  (no call id in AdapterEvent); open workers despawned at attempt end. workerId from injected newId.
- Success: Hermes experience {taskType ?? 'general', outcome pass, lessons = verify evidence or
  "Completed <type> in N attempt(s)"}; result {summary finalText, artifacts = file_change paths, verdict pass};
  result.recorded then run.completed; agent idle.
- Layer 6 = hermes memories then experience; hermes profile layer not mapped (identity from base typed fields).
  Mapped layers get version HERMES_CONTEXT_VERSION=1.
- Agent status sequence: thinking (composing) -> working (executing) -> [waiting_permission -> working] -> idle | blocked(pause).
- runtime.ts 334 LOC (>250 target, <500): split attempt/run-events out already; further split would scatter the flow.

## Mutation
36 mutants, 36 killed, 0 survived (mutation.txt). Restore: sha256 -c 16/16 OK, 0 *.bak.

## Verification
- `bun test packages/agent-runtime packages/shared`: 392 pass 0 fail (junit.xml). agent-runtime 290 (was 119), shared 102 (was 99).
- hermes 185, adapters 46, api 241 unchanged green. `bun run typecheck` exit 0. `bunx biome check .` clean.
- mongosh redhunter_test_* listing: [].

## Open questions
- Retry model: in-run retries vs plan §25 "new run queued per attempt". Chosen in-run (simpler, single runId for events).
- Human (owner) policy override not supported; add when T13 RBAC wants it.

## Round 2 (oracle round 1 fixes: D1, T1)
- D1 fix (runtime.ts +5 LOC, now 339): after every attempt `active.pendingPermission = undefined` (covers failed/throw/end,
  and therefore escalate/fail/paused-by-abort paths, which all run after the attempt returns); before each retry
  attempt the agent status is reset to `working`. Stale `answerPermission` now throws
  `No pending permission <id> for run <runId>` and is not forwarded. Current-permission flow unchanged.
- New tests `runtime.stale-permission.test.ts` (7): failed/throws/ends x {status reset, stale answer rejected} + escalation variant.
- T1: permission test now pins `runs.transitions` before and after the answer (only queued->composing->executing), and the
  final path composing,executing,verifying,succeeded.
- RED red-r2.txt: 393 pass / 6 fail (right reasons). GREEN: 399 pass / 0 fail. Extra mutants r2-01..03 killed (incl. M08).

## Round 3 (oracle R2 survivors M14, M5, M6; test-only)
- New tests: stale-permission "answer between attempts" (backoff gated, M14); interactive "second answer for the same
  permission" (M5); interactive "working before the answer is forwarded, idle after the run ends" with
  FinishOnAnswerAdapter whose answerPermission waits for the run to end (M6).
- Mutants r3-01 M14, r3-02 M5, r3-03 M6: all killed by their target test; each test passes on the original (red-r3.txt).
- Tests: 402 pass / 0 fail / 23 files. typecheck 6/6 exit 0. biome 174 files clean.
- Production sha16 before == after (prod-sha-pre-r3.txt): runtime 61e9e1237b6e85ef, attempt 3ea8b938965d8e47,
  policy 9bb7dc99a3af1a0f, authorize 50e0deab9693b6ff, run-events 75b4da5713f181a5, workers 5e2543a440101dfe,
  ports d9c6fab24654e24c, state-machine a4c9ae218e4abf83. T6/T7/T8 frozen files 16/16 OK. No redhunter_test DBs.
- M12 (clear moved after the abort/pause early return): internal equivalent; the finally in execute() removes the run
  from #active, so a later answerPermission throws RunNotActiveError either way. Not publicly observable.
