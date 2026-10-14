VERDICT: rejected

# T6 Hermes — Oracle adversarial verification, round 10 (fresh reviewer)

## Baseline
- sha256 at start matched every expected value (mappers d413bd8c..., store dbc54590..., models 169e225a..., context 85059f06..., seed 0effb3d5..., tokens fe0e0a94..., index 1d80824d..., knowledge fe662329..., errors 97743c3c...). Full receipt: /tmp/opencode/orc06j/baseline.sha (production + tests + test-support + seed JSON).
- Baseline suite: 181 pass / 0 fail / 465 expect.

## Method
- Mutants ran in 12 mirror workspaces under /tmp/opencode/orc06j/ws1..ws12. Each one is a copy of packages/hermes, with symlinks to the repo's node_modules and packages/shared. The repo was never edited.
- Per mutant, the runner made a `.bak` copy, replaced exactly one pattern (count == 1 asserted), ran `bun test packages/hermes`, restored from `.bak` in a finally block, and asserted the sha256 matched the original.
- Runner: /tmp/opencode/orc06j/runner.py. Mutant sets: muts1.py, muts2.py, muts3.py. Results: r1.json, r2.json, r3.json.

## Mutation results
- Valid mutants: 260 (3 were invalid because their pattern was absent and are excluded). Killed: 236. Survived: 24.
- Coverage: context.ts 73, knowledge.ts 58, store.ts 81, seed.ts 11, tokens.ts 5, errors.ts 6, models.ts 19, index.ts 8.

### Survivors — REAL
| ID | Location | Mutation | Why no test catches it |
|---|---|---|---|
| E1a | store.ts:64 (toMemory) | `{ ...fields, id: _id, createdAt }` -> `{ id: _id, ...fields, createdAt }` | Only the profile mapper has a stray-`id` test (store.guards.test.ts:299). |
| E1b | store.ts:69 (toSkill) | `{ ...fields, id: _id }` -> `{ id: _id, ...fields }` | Same as above. |
| E1c | store.ts:74 (toExperience) | `{ ...fields, id: _id }` -> `{ id: _id, ...fields }` | Same as above. |
| E1d | knowledge.ts:120 (hydrateKnowledgeStore) | `{ ...fields, id: _id }` -> `{ id: _id, ...fields }` | No hydrate test uses a row that carries a stray `id`. |

E1 is the same defect class as round-9 M018, which was accepted as REAL and fixed only for profiles. I confirmed it hands-on (/tmp/opencode/orc06j/probe.ts). I inserted raw rows whose `_id` is `*-real` and which also carry a stray field `id: '*-forged'`:
- Production code returns `mem-real`, `skill-real`, `exp-real`, `k-real`, which is correct.
- With all four mutations applied in ws1, it returns `mem-forged`, `skill-forged`, `exp-forged`, `k-forged`.

So a corrupt or forged row can change the id that `getMemories`, `findSkills`, `getExperience` and the knowledge store expose. Those ids feed into the `assembleContext` block ids and the `dropped` ids. The suite stays green under this mutation.

Suggested test: one parametrised test, the same shape as store.guards.test.ts:299. Raw-insert a row into each of `hermes_memories`, `hermes_skills`, `hermes_experience` and `knowledge_docs` with a conflicting `id` field. Assert that the returned id equals the row `_id`.

### Survivors — EQUIVALENT (reasons)
- K50 `return docs.length` -> `rows.length - 0`: rows.length === docs.length (accepted class).
- K52 `this.docs.size + 0*1 || 0`: arithmetic no-op.
- D05 `raw as ProfileVersion`: accepted R9 (seed.ts:21).
- D07 seed loop -> `Promise.all`: 7 independent agent ids, so the end state is identical (accepted class "Promise.all of independent ids").
- D09 `return 7`: seed constant (accepted).
- E05 BudgetError extends TypeError, E06 NotFoundError extends RangeError: changing the base class does not change `instanceof HermesXError` or `name` (accepted class "BudgetError extends RangeError").
- M07/M09/M10 drop `versionKey:false` on profile/skill/experience: `__v` is stored, but the zod object schemas strip unknown keys on read, so the public output is identical.
- M17 drop mongoose `required` on experience runId: HermesExperienceSchema requires runId before any write (accepted models.ts validator class).
- M18/M19 drop the memory/skill secondary indexes: performance only.
- S20 `ttl === undefined` -> `!ttl`: the schema enforces ttl as a positive int, so 0 is unreachable.
- S74 TypeError -> Error for a non-Date createdAt: same class as R9 store.ts:62. Error type is not part of the contract, and the tests use `rejects.toThrow()`.
- X01 role fallback `'' -> 'Programmer'`: unreachable, because AGENT_DEFINITIONS covers every AgentId.
- X05 `overlap` also counts `memory.kind`: an additive mutation, and the spec defines relevance on memory text only. I do not count it as a defect.
- Y06 averageLength over filtered docs: the accepted design decision (averageLength over unfiltered docs). Not re-reported.
- Z04 `id + ''`, `version + 0`: no-ops.
- Z06 empty-tags guard -> query with `['__none__']`: same output, accepted R8/R9 store.ts:175.

## Hands-on checks (/tmp/opencode/orc06j/hands.ts, DB `redhunter_test_orc06j_*`, dropped in finally)
- a. seedProfiles: 7 profiles and 7 pointers for ceo, coo, cto, programming, game, iot, ai_development. Rerun leaves 7/7. PASS
- b. createProfileVersion v2 + activate + reseed: still v2 "Prog v2". PASS
- c. assembleContext('programming', 'fix typescript bug', 2000): layers come back in the order profile, skills, memories, experience, rag. The profile block is v2. Exactly 3 memories, the 3 relevant ones (cooking, game and the cto memory are excluded). totalTokens 78 <= 2000. PASS
- d. Cross-agent reads of memories, profile and experience throw HermesAccessError, both on the real store and on a store whose models throw on any property access. So the check happens before any query. PASS
- e. Budgets 1 (smaller than the profile), 2.5, -1, NaN and Infinity all throw HermesBudgetError. PASS
- f. Raw memory rows with missing text or with numeric text, and an experience row with a bad outcome, all throw ZodError. PASS
- g. 8 parallel ensureProfileVersion calls for iot: all fulfilled, 1 row, 1 pointer. PASS
- h. hydrate with Unicode rows (`CAFÉ` matches 2 docs, `東京` matches z2) and empty tags: count 2. A corrupt row throws ZodError and leaves the store at size 0. PASS

## Test-quality notes
- No `toBeDefined`/`toBeTruthy` assertions anywhere.
- 10 bare `rejects.toThrow()` calls (store.test.ts x8, knowledge.test.ts x2). Error classes are pinned elsewhere for access, budget and pointer errors, so this is acceptable.

## Cleanup receipt
- Production files, tests, test-support and seed JSON: sha256 identical to the baseline (`diff` empty, SHA_IDENTICAL).
- `.bak` under packages/: 0. All mutation edits happened only in /tmp/opencode/orc06j/ws*.
- Leftover DBs: one stray `redhunter_test_1791630477095_ef92964b`, created 2026-10-10T11:07:57Z, which is during this run. It came from a killed mutant run that skipped `drop()`; it held only `hermes_memories`. I dropped it. The list is now `[]`. The hands-on `redhunter_test_orc06j_*` DBs were dropped in finally.
- Final: bun test packages/hermes 181 pass / 0 fail / 465 expect. Typecheck: all packages exit 0. biome: 130 files, no fixes.
- bun.lock: never touched. Its sha256 is 51f17c74...; I did not capture it before the run, so this is a post-run value only.
- No git used, no repo scratch files. The only repo write is this report.

## Defects
- E1 (REAL): the `{ ...fields, id: _id }` spread order is unpinned for the memory, skill, experience and knowledge mappers (store.ts:64, :69, :74; knowledge.ts:120). It needs per-collection stray-`id` regression tests. Effort: Quick.

VERDICT: rejected
