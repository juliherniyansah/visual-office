VERDICT: confirmed

# T7 RH-AGENT-001 independent verify (oracle)
Contract: plan §9 L111-123, card L232, checkbox L298.
Independent script: /tmp/opencode/t7-oracle/check.ts (imports repo src; run via a temp copy that was deleted right after). 21/21 PASS.

## Acceptance bullets
1. Oversized RAG <= budget, 1-4+9 intact, RAG first, strict 7->6->8->5: PASS.
   - tokens==budget keeps full text; budget-1 shrinks only RAG (tail dropped, `rag doc 0` kept, `rag doc 49` gone), skills/memory/project unchanged.
   - Default chars/4 estimator, budget 500: tokens<=500, every fixed layer render is a verbatim substring.
   - Cascade: budget = noRag-1 -> rag 0, memory cut; noMem-1 -> project cut; noProj-1 -> skills cut; all <= budget.
   - Code: budget.ts:17 TRUNCATION_ORDER, budget.ts:44-56 fitFlexible, composer.ts:66-85.
2. Hash stable for same input: PASS (repeat call, reversed top-level key order). Hash changes when any of the 9 layer versions or contents change (18/18).
3. Budget < reserve -> PromptBudgetError: PASS. budget==reserve passes with all 4 flexible layers at tokens 0; reserve-1 throws PromptBudgetError (composer.ts:73).
4. Constitution v1 sentence: PASS. constitution.md:12 contains "prompt rules are not security boundaries"; loadConstitution().version===1; composing with the real constitution keeps it.
5. Layer versions recorded: PASS. layers[] always 9 entries in precedence order with input versions [1,12,23,34,45,56,67,78,89] (full, empty-flex, reserve-only cases); tokens == sum(layers.tokens); output passes PromptSnapshotSchema.
Extra: injection check. Forged `## 3.`/`## 1.`/`## 9.`/`## 4.` inside rag/identity/task values -> exactly 9 real headers in the text (indent at layers.ts:95).

## Mutation sweep (12 fresh mutants, scratch copy /tmp/opencode/t7-oracle/pkg; baseline there 118 pass + 1 path-location fail caused by the scratch path)
| Mutant | Result |
|---|---|
| M1 reserve `>` -> `>=` (composer) | killed (5) |
| M2 fit `>` -> `>=` (budget) | killed (11) |
| M3 order swap rag<->memory | killed (12) |
| M4 order swap project<->skills | killed (7) |
| M5 drop task from FIXED_LAYER_IDS | killed (15) |
| M6 version removed from hash input | killed (13) |
| M7 tail-drop -> head-drop | killed (12) |
| M8 canonicalJson without key sort | killed (3) |
| M9 remove anti-forge indent | killed (5) |
| M10 available = budget (ignore reserve) | killed (14) |
| M11 accept negative budget | killed (5) |
| M12 total tokens from joined text | killed (5) |
No survivors. `diff -r` of scratch src vs repo src is clean after the run.

## Verify command tails
- `rtk bun test packages/agent-runtime`: 0 fail, 1 snapshots, 1056 expect() calls, Ran 119 tests across 7 files.
- `rtk bun run typecheck`: 6/6 "Exited with code 0".
- `rtk bunx biome check .`: Checked 150 files in 62ms. No fixes applied.
- mongosh redhunter_test* DBs: [].

## Scope / cleanup receipt
- Files newer than .omo/evidence/08/oracle-verify.md (2026-10-10 14:25:09), excluding .omo/ and node_modules: only packages/agent-runtime/** and bun.lock. packages/hermes, adapters, shared and apps: none.
- No *.bak files and no stray check files in the repo. Not a git repo; nothing done with git.
- sha256 before == after:
  - budget.ts c8486a3bfac4a7f10c873bccbfed4c73fe758b0563a53f353c8e51b60fe3670d
  - composer.ts bf926606e379e50496d196057d53715323e7ac6423029d77b3f0b8dc3c8ae3d3
  - layers.ts 9ddd2d283480b835fbe258facc8d70c8d9277daa6f6e8f9e58b1766e05395feb
  - constitution.ts 21deac35bda4832f549c907cbe65019086ea7799a981bcd45d8e9e2ddcf869df

## Open question: proportional vs strict
In §9, "proportional" contradicts its own priority list (9>5>8>6>7), and checkbox 298, which is the acceptance, asks for strict 7->6->8->5. Strict order matches the acceptance bullet "truncation hits layer 7 first" exactly and is deterministic for the hash. Accepted. Fix the §9 wording when the plan is next edited.
