# T7 RH-AGENT-001 Prompt composer

## Files
- NEW `packages/agent-runtime/constitution.md` (v1; contains "prompt rules are not security boundaries").
- NEW `packages/agent-runtime/src/prompt/layers.ts` (140 LOC): layer ids, source types, pure renderers.
- NEW `packages/agent-runtime/src/prompt/budget.ts` (56 LOC): estimator, `PromptBudgetError`,
  `TRUNCATION_ORDER`, `assertBudget`, `measureTokens`, `fitFlexible`.
- NEW `packages/agent-runtime/src/prompt/composer.ts` (107 LOC): `composePrompt`, `COMPOSER_VERSION`, hash.
- NEW `packages/agent-runtime/src/prompt/constitution.ts` (20 LOC): `loadConstitution`, `CONSTITUTION_VERSION = 1`,
  `CONSTITUTION_PATH` (absolute, resolved from `import.meta.url`). Only file with IO.
- NEW tests: `budget.test.ts`, `layers.test.ts`, `composer.test.ts`, `composer.budget.test.ts`,
  `composer.hash.test.ts`, `constitution.test.ts`, `src/index.test.ts`; fixture `src/test-support/prompt-input.ts`;
  bun snapshot `src/prompt/__snapshots__/composer.hash.test.ts.snap` (full fixture composition incl. hash).
- MOD `packages/agent-runtime/src/index.ts` (barrel), `package.json` (`test` script, dep `@redhunter/shared`).
- MOD `bun.lock` (+3 lines: agent-runtime -> `@redhunter/shared` workspace). No third-party deps.
- `@redhunter/hermes` NOT added: composer is pure and takes already-fetched layer data; it only needs
  `HermesProfile`/`OmoPolicy` types from shared. Adapter from `assembleContext` left to T9 (not trivial:
  hermes splits memories/experience into two layers, composer layer 6 merges them).

## Public API
```ts
composePrompt(input: PromptInput, deps?: { estimateTokens?: TokenEstimator }): PromptComposition
// PromptComposition = { text, layers: {id, version, tokens}[9], tokens, hash, version }
loadConstitution(read?: (path) => string): { version, text }
estimateTokens(text) = Math.ceil(text.length / 4)   // UTF-16 units, per spec
PromptBudgetError, TRUNCATION_ORDER = ['rag','memory','project','skills']
PROMPT_LAYER_IDS, FIXED_LAYER_IDS, FLEXIBLE_LAYER_IDS, renderFixedLayer, renderItemsLayer
```
`PromptInput` = one source per layer, each with `version`: constitution {text}, identity (Pick of
HermesProfile), rolePolicy {company, role, allowed[], forbidden[]}, omoPolicy {policy: Pick<OmoPolicy,
budgetTokens|maxRetries|maxTurns|escalationChain>, outputContract}, skills/memory/rag/project {items[]},
task {directive, acceptance[], constraints[]}. Budget = `input.omoPolicy.policy.budgetTokens`.
Output satisfies `PromptSnapshotSchema` (asserted) -> T9 stores `{text, layers, hash}`.

## Decisions
- Rendering: each layer = `## <n>. <Title>\n` + body. Every free-text value except the trusted
  constitution has continuation lines indented 2 spaces, so no input can start a line with a forged
  `## N.` header -> precedence is structural (test: hostile text in layers 5-9 leaves the 9 headers intact).
  constitution.md uses `###` sub-headers so layer 1 adds no `## ` lines (asserted).
- Empty flexible layer -> rendered '' (omitted from text), still recorded in layers[] with its version
  and tokens 0; estimator is not called for it. Empty lists in fixed layers render `- (none)`.
- Reserve = sum of estimates of layers 1-4 + 9; reserve > budget -> `PromptBudgetError`
  ("Reserved layers need X tokens, budget is Y"). Non-integer/negative/NaN/Infinity budget and invalid
  estimator output -> `PromptBudgetError`.
- Budget is NOT rendered into the prompt, so the reserve does not depend on the budget and a budget
  change that does not truncate keeps the hash (asserted).
- Truncation: items are pre-ranked by the caller; `fitFlexible` drops tail items of one layer at a time in
  TRUNCATION_ORDER until the summed whole-layer cost fits (header disappears with the last item).
  Plan says "proportionally"; the task spec's strict order 7 -> 6 -> 8 -> 5 was implemented (ordered drop,
  not proportional). Item-granular (no partial-text cuts) like Hermes.
- tokens = sum of per-layer estimates (budget is checked on this sum). With ceil-based estimators the
  whole-text estimate is <= this sum (asserted), so output <= budget under both views.
- Hash = sha256 hex over canonical JSON (keys sorted at every level, no whitespace) of
  `{version: COMPOSER_VERSION, layers, text}`. layers carry every (id, version, tokens); so any content or
  version change alters the hash; key insertion order and machine do not (asserted + snapshot pin).
- Estimator: default `ceil(text.length / 4)` (UTF-16 units) as specified; differs from Hermes
  `estimateTokens` (code points). Documented with a `ponytail:` comment; pluggable via deps.
- Skills max K / memory top-N / RAG top-k selection is the caller's job (T9 via Hermes); composer only
  enforces the token budget.

## Verification
- RED: `.omo/evidence/07/red.txt` (98 tests: 96 fail on stub "not implemented", 2 pass on constants,
  0 import errors).
- GREEN: `bun test packages/agent-runtime` -> 119 pass, 0 fail, 1056 assertions
  (`.omo/evidence/07/test.txt`, `junit.xml`).
- `bun run typecheck` -> 6/6 workspaces exit 0. `bunx biome check .` -> 150 files, no errors.
- Mutation: 22 mutants, 22 KILLED, 0 SURVIVED (`.omo/evidence/07/mutation.txt`).

## Cleanup receipt
- Mutation runner + originals in `/tmp/opencode/t7/` (outside repo). All agent-runtime files sha256
  verified identical after the sweep; no `*.bak`/`*.orig` in repo; no DB used.
- Protected trees (`packages/{hermes,shared,adapters}/**`, `apps/**`, 134 files incl.
  `apps/api/src/db/mappers.ts`) sha256 unchanged vs pre-task baseline.
- No git operations, no `.env`.
