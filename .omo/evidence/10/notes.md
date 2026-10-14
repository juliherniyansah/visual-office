# Task 10 - OMO plan/verify

## Files
- packages/agent-runtime/src/omo/schemas.ts (33) - WorkPlanSchema, RiskSchema, PlanStepSchema, StepResult
- packages/agent-runtime/src/omo/plan.ts (137) - prometheus.plan, parseWorkPlan, buildPlanPrompt, buildRepairPrompt, PlanError
- packages/agent-runtime/src/omo/verify.ts (52) - verify, verifyCompletion (VerifyFn), NO_ACCEPTANCE
- packages/agent-runtime/src/omo/index.ts (4) - barrel; src/index.ts exports './omo'
- packages/agent-runtime/src/omo/fixtures.ts (47) - fixture outputs: valid, fenced, prose, malformed, unterminated, invalidRisk, duplicateIds, emptySteps, emptyAcceptance, empty
- tests: plan.test.ts, verify.test.ts, runtime-wiring.test.ts, index.test.ts
- packages/agent-runtime/package.json: + zod ^4.6.5 (bun.lock +1 line)

## Contracts
- plan: collects `text` events until `completed`; finalText is not plan output. JSON = first balanced
  object of the first fenced block, else of the whole output. zod validated.
- Parse/schema failure -> exactly one repair run (`<runId>-repair`, original prompt + error) -> PlanError
  invalid_output. Adapter `failed`/throw -> adapter_failed, no stream end -> no_completion; no retry.
- Permission requests during planning are denied.
- verify: per acceptance item one evidence line `met: "<item>"` / `unmet: "<item>" (missing: ...)` /
  `unmet: "<item>" (no keywords)`. Item met iff all its words appear as whole words (case-insensitive)
  in output + evidence + artifacts. Empty list -> pass [`No acceptance criteria`]. Failed step -> fail.
- Runtime wiring: `new AgentRuntime({ ..., verify: verifyCompletion })`; runtime.ts NOT edited.

## Evidence
- test.txt: omo 49 pass / 0 fail
- regression.txt: agent-runtime + shared 451 pass / 0 fail (baseline 402)
- mutation.txt: 12/12 killed
- typecheck 6/6 exit 0; biome check . clean; T9 production sha16 unchanged; *.bak 0
