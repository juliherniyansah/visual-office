# T6 RH-HERMES-001 — adversarial verify round 6

Fresh verifier. Scratch: `/tmp/opencode/orc06f/` (copies w0..w3 of packages/hermes + packages/shared, node_modules symlinked). Production never edited in place; zero `.bak` created. Runner: `run.py` (pattern must match exactly once, restore in finally). Mutant specs and results: `gen.py`/`new.json`/`new.out.json`, `gen2.py`/`new2.json`/`new2.out.json`, `d3132.json`/`d3132.out.json`.

## Baseline
- `bun test packages/hermes`: 155 pass / 0 fail, 389 expect(), 8 files, exit 0.
- `bun run typecheck`: 6 packages, all exit 0.
- `bunx biome check .`: 129 files, no fixes.

## Integrity (sha256 before any mutation = after cleanup, full hashes)
mappers.ts d413bd8c…5740f, store.ts dbc54590…a210a, models.ts 169e225a…6b85, context.ts 85059f06…d32b, knowledge.ts fe662329…44e5, seed.ts 0effb3d5…6ac6, tokens.ts fe0e0a94…295b, index.ts 1d80824d…cede, errors.ts 97743c3c051f8292…0512. All match expected values. No pre-mutation mismatch.

## D31 re-proof (store.ts:85 default clock)
| mutant | result |
|---|---|
| `() => new Date(0)` | KILLED (152 pass / 3 fail) |
| `() => new Date(Date.now() + 86400000)` | KILLED (153/2) |
| `() => new Date(Date.now() - 3600000)` | KILLED (152/3) |
D31 is closed.

## D32 re-proof (context.ts:82 importance tiebreak deleted)
- Full hermes suite, 10 runs: 10 of 10 failed (rc != 0, each 154 pass / 1 fail).
- Isolated `-t 'rankMemories importance'`, 10 runs: 10 of 10 rc=1 (0 pass / 1 fail). It passes on original code (1/0).
D32 is closed and deterministic.

## New mutants (101 valid, 0 invalid; 92 killed, 9 survived)
Killed (92):
- store.ts N01–N13, N15–N20, N22–N25, A01–A07:
  - ttl `<`→`<=`, MS_PER_SECOND, ttl-undefined→false.
  - Removed assertOwnData (experience, memories), and access check moved after the pointer query.
  - Misrouted-pointer guard off. Version +2. Latest sort asc. $setOnInsert→$set. Any error = dup. Dup + no row → fake row.
  - Memory/experience sort flips. Skill name sort desc. Role filter dropped. activate-not-found guard off.
  - Memory createdAt +1 ms. Pointer id format. Pointer-null guard off.
  - Pointer not moved on createProfileVersion. Fast path returns input instead of stored row. Version id format.
  - Dropped `await` on every write (7).
- knowledge.ts K01–K15, K18–K20, K22, A09:
  - k1, b, idf denominator, idf without 1+, `score>=0`, score asc, id compare flipped, slice k+1, some→every.
  - Digits dropped from tokenizer, no lowercase, tags not indexed, no clone on return, no parse on upsert.
  - avgLen+1, tf numerator, no query dedupe, hydrate without parse, hydrate `await` removed on rows.
- context.ts C01–C23, C25, C26:
  - TOP_MEMORIES/EXPERIENCE/RAG changed. FILL_ORDER swaps (skills↔memories, experience↔rag).
  - `<=`→`<` fit. `>`→`>=` profile. `<0`→`<=0`. isInteger removed. Experience order swapped.
  - Recency asc. id desc. Overlap counts duplicates. `remaining -=` removed. dropped not recorded. Voice line removed.
  - Role→id for skills. Total excludes profile. RAG k+1. Kind prefix removed. Custom estimator ignored.
  - Budget not reduced by profile. Hits asc. Skills given [] tags. Budget echo −1.
- tokens.ts T01–T03: chars/token 3, floor, UTF-16 length.
- errors.ts E01–E03: name changed, agentId/asAgent swapped in message, BudgetError name.
- index.ts I01–I03: tokens/seed/knowledge re-exports removed.
- seed.ts S01–S03, A08: order swap, traits not frozen, first seed skipped, `await` removed.
- models.ts M01–M05: unique index off, embedding default, pointer collection name, versionKey on, memories collection name.

Survivors:
| id | file:line | mutation | judgement |
|---|---|---|---|
| N14 | store.ts:175 | drop `tags.length===0` early return | EQUIVALENT (= S49, `$in: []` matches nothing) |
| N21 | store.ts:62 | drop `instanceof Date` guard | EQUIVALENT (= S48) |
| K08 | knowledge.ts:65 | `k<=0`→`k<0` | EQUIVALENT (= K03, slice(0,0)) |
| K17 | knowledge.ts:118 | hydrate sort `_id:-1` | EQUIVALENT (= K31) |
| K21 | knowledge.ts:43 | indexDoc stores doc without clone | EQUIVALENT (= old K16, zod parse already returns a fresh copy) |
| S04 | seed.ts:21 | drop SeedProfileSchema.parse | EQUIVALENT (= E08) |
| M06 | models.ts:94 | drop skill tags `default: []` | EQUIVALENT (O-class: zod requires tags on write) |
| **K16** | knowledge.ts:121 | `await store.upsert(doc)` → `store.upsert(doc)` | **NON-EQUIVALENT → D33** |
| **C24** | context.ts:77 | `tokenize(taskText)` → `tokenize(taskText.slice(1))` | **NON-EQUIVALENT → D34** |

## Hands-on acceptance
Throwaway test in scratch w0, real mongod, DB `redhunter_test_1791566174322_f6943ab5`, dropped in afterAll. 5 of 5 pass.
- (a) `seedProfiles` returns 7. There are 7 profile rows and 7 pointers: ceo:Cara, coo:Otto, cto:Tess, programming:Pip, game:Gale, iot:Ivy, ai_development:Ada.
- (b) `assembleContext('programming', TASK, 500)`:
  - Layers: profile 40, skills 0, memories 37, experience 0, rag 0. Total 77 ≤ 500. Profile contains `Name: Pip`.
  - Memories are exactly the 3 relevant ones in relevance order. High-importance irrelevant ones and the ceo memory are excluded.
- (c) getMemories, getProfile and getExperience `('ceo', 'programming')` each reject with HermesAccessError.
- (d) Budget 39 (profile − 1) gives HermesBudgetError. Budget 40 gives totalTokens 40.
- (e) ttl 10 s: live at +9999 ms, gone at +10000 ms.
Acceptance holds behaviorally.

## Defects
### D33 — knowledge.ts:121 `await` in hydrateKnowledgeStore not observed
- Mutation: `for (const doc of docs) await store.upsert(doc);` → `for (const doc of docs) store.upsert(doc);`. Suite stays 155/0.
- Why no test sees it: every hydrate test uses InMemoryKnowledgeStore, whose async upsert sets the Map synchronously. The only throwing path (zod parse) already ran in the `rows.map` above.
- Real behavior difference: `KnowledgeStore` is the documented plug-in seam (OPEN DECISION 1: LanceDB, sqlite-vec, Atlas). With a truly async upsert, hydrate resolves (and boot proceeds) before docs are indexed, and upsert rejections become unhandled.
- Scratch probe kills it: a fake store whose upsert awaits `setTimeout(20)` and then records the id; assert `seen` equals `['d1']` after `await hydrateKnowledgeStore(...)`. It passes on original code and fails on the mutant.
- Fix: add that test to knowledge.test.ts.

### D34 — context.ts:77 first task term never decisive for relevance
- Mutation: `new Set(tokenize(taskText))` → `new Set(tokenize(taskText.slice(1)))`, an off-by-one that destroys the first task term. Suite stays 155/0.
- Why no test sees it: every relevance test uses TASK 'Fix the flaky mongo …'. The first term `fix` (it becomes `ix`) never matches a memory, so losing it changes nothing.
- Real behavior difference: a task whose leading word is the only shared term (e.g. 'mongo flaky' vs memory 'mongo') ranks that memory as 0 hits. Relevance order is then decided by importance/recency, and the plan's "top-3 relevant memories" breaks.
- Scratch probe kills it: memories a:'other', b:'mongo' with equal importance and createdAt, task 'mongo flaky', expect ['b','a']. It passes on original code and fails on the mutant.
- Fix: add that test (pure `rankMemories`) to context.limits.test.ts.

## Cleanup receipt
- Production sha256 after == expected (all 9 files, `/tmp/opencode/orc06f/sha-post.txt`).
- `find packages apps -name '*.bak' -not -path '*/node_modules/*'` → 0.
- Leftover DBs `redhunter_test*` → `[]`.
- Scratch test files `zz_probe.test.ts` and `zz_accept.test.ts` were deleted. All 4 scratch copies are cmp-identical to the repo's `packages/hermes/src/*.ts`.
- No runner processes left. The only repo file created is this report.

VERDICT: rejected
