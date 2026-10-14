# Todo 6 RH-HERMES-001 evidence

- `bun test packages/hermes`: 96 pass / 0 fail, 246 expect() calls (test.txt). Test names: junit.xml / test-names.txt (96 testcases, 0 failures).
- `bun run typecheck`: 6/6 workspaces exit 0. `bunx biome check .`: 125 files, clean.
- Mutation run (mutants.txt): 27/27 KILLED, control + restored-control PASS. Round 1 (mutants-round1.txt) had 8 survivors (partial re-validation of memory/skill/experience/knowledge via `undefined` fixtures stored as null, pointer guard, idf, fractional budget, experience ordering); fixed with tests only.
- Happy path: assembleContext('programming', task, 2000) = profile + top-3 relevant memories, total <= 2000. Hydration from knowledge_docs asserted (count + searchable).
- Failure path: getMemories/getExperience/getProfile('ceo', asAgent 'programming') -> HermesAccessError, no Mongo query issued (spy). Budget < profile -> HermesBudgetError.
- Cleanup: test DBs `redhunter_test_*` remaining = [] (mongosh). Scratch: /tmp/opencode/mut06.py, /tmp/opencode/mut06.out.

## Fix round 1 (2026-10-09T13:01:46+00:00) - oracle D1-D9
- RED (before source fix), `bun test packages/hermes/src/store.versioning.test.ts`: 5 pass / 3 fail, EXIT=1:
  - (fail) getProfile pointer integrity > pointer hermes-programming carrying agentId ceo is rejected, never returns ceo data  [D6]
  - (fail) ensureProfileVersion concurrency > two concurrent ensures of the same seed both resolve with one row  [D9: E11000 duplicate key ... _id: "hermes-programming-v1"]
  - (fail) ensureProfileVersion concurrency > concurrent ensure losing the insert race returns the STORED row, not its own input  [D9]
- GREEN after fix: same file 8 pass / 0 fail, EXIT=0.
- Source fixes: store.ts getProfile throws HermesNotFoundError when pointer.agentId != requested agentId and queries the profile row by the REQUESTED agentId (D6); ensureProfileVersion -> private insertProfileIfMissing catches E11000 (code 11000), re-reads by _id and returns the stored row (D9). No other source change.
- New tests: store.versioning.test.ts (D6, D7 a/b/c, D8, D9 x2, D5 skills name sort), context.limits.test.ts (D1 caps, D2 greedy fill, D5 rankMemories id + recency), knowledge.test.ts +2 (D3 exact BM25 scores, D4 k=0/-1 with 2 hits).
- Gates: bun test packages/hermes 110 pass / 0 fail / 281 expect; typecheck 6/6 EXIT=0; biome 127 files EXIT=0; leftover test DBs []; apps/api/src/db/mappers.ts sha256 d413bd8c...a5740f unchanged.
- Mutation proofs: mutants-round2.txt, 20/20 KILLED by the new tests (19 survived the pre-round-2 tests; O14 was flaky-killed before, now deterministic).

## Fix round 2 (2026-10-09T14:03:08+00:00) - oracle D10 (error discrimination in insertProfileIfMissing)
- Tests only: store.versioning.test.ts +3 (describe "ensureProfileVersion error discrimination"): foreign-_id duplicate on {agentId,version} -> rejects {code:11000}, pointer count 0, 1 row; spyOn(Profile.create) raw-inserts the row then throws {code:64} -> rejects.toBe(same error), pointer 0; spyOn throws plain Error('network') -> rejects.toBe(same), 0 rows, 0 pointers. Spies restored in finally.
- RED proof = mutation run (mutants-round3.txt): N8, N10, N11, N12 each KILLED in 2/2 runs; control and restored-control pass. store.ts sha256 pre/post run dbc54590...636a210a identical (= round-1 state, 220 lines). No .bak left.
- GREEN: bun test packages/hermes 113 pass / 0 fail / 289 expect; junit 113 testcases, 0 failures; typecheck 6/6 EXIT=0; biome 127 files EXIT=0; leftover test DBs []; mappers.ts sha256 d413bd8c...a5740f unchanged.

## Fix round 3 (2026-10-09T15:13:13+00:00) - oracle D11-D21 (tests only)
- New file store.guards.test.ts (12 tests): D11 experience isolation (getExperience 3 agents + assembleContext lessons), D12 zod-only invalid writes (memory ttl 0 / runId '', experience lessons [''], profile traits [''] -> ZodError, 0 rows), D13 codeless error + row present rethrown, D14 ensure v2 -> pointer activeVersion 2, D15 findSkills multi-tag any-match, D21 embedding key absent in raw row + unique {agentId,version} index present right after factory on fresh DB.
- knowledge.test.ts +2 (D15 tag filter multi-tag, D16 repeated query terms), context.limits.test.ts +4 (D17 experience before rag, D19 budget 0 with 0-cost estimator, D18 distinct terms + tokenized task text via rankMemories), seed.test.ts +1 (D20 every profile frozen, assignment throws TypeError).
- Mutation proof (mutants-round4.txt): 16/16 KILLED (S23 S40 S57 S65 S02 S12 S51 K09 K30 C12 C15 C29 C30 E02 O02 O07), each by its targeted test; control and restored-control 132/0. O07 repeated 5/5.
- Gates: bun test packages/hermes 132 pass / 0 fail / 353 expect; junit 132 testcases 0 failures; typecheck 6/6 EXIT=0; biome 128 files EXIT=0; production sha256 unchanged; mappers.ts d413bd8c...a5740f.
- Leftover DBs: 3 empty redhunter_test_* DBs created DURING the mutation run (O07 mutant: index builds not awaited recreate collections after drop) were dropped; fresh clean run leaves [].

## Fix round 4 (2026-10-09T16:08:52+00:00) - oracle D22-D30 (tests only)
- store.versioning.test.ts +3 (D22 per-agent numbering, D23 failed create leaves pointer at v1 via spyOn fault injection, D24 activate checks THIS agent), store.guards.test.ts +2 (D25 newest-first with _id order reversed to createdAt, D26 upsertSkill return deep-equals input), context.limits.test.ts +1 (D27 other-taskType experience newest-first), new index.test.ts 12 tests (D28 whitespace tokens, D29 error names + AccessError message, D30 barrel: PACKAGE_NAME, one symbol per re-exported module, CONTEXT_LAYER_IDS order).
- Mutation proof (mutants-round5.txt): 20/20 KILLED (A05 A07 A08 A21 A25 C78 T05 R01-R04 C71 I01-I08); control + restored-control 151/0; sha256 pre==post (24 files); .bak 0; DBs [].
- Gates: bun test packages/hermes 151 pass / 0 fail / 382 expect; junit 151 testcases 0 failures; typecheck 6/6; biome 129 files EXIT=0. Production sha256 unchanged.

## Fix round 5 (2026-10-09T16:56:05+00:00) - oracle D31-D32 (tests only)
- store.guards.test.ts +3 "default clock (no clock injected)": addMemory createdAt in [before, after] + ttl 3600 memory still live; createProfileVersion raw createdAt in [before, after]; addExperience row sorts before a raw row 1 minute old.
- context.limits.test.ts +1 "rankMemories importance": equal hits/createdAt, id a (0.1) vs b (0.9) -> ['b','a'] (id fallback alone gives ['a','b']).
- Mutation proof (mutants-round6.txt): N074 10/10 KILLED (3 default-clock tests), N122 10/10 KILLED full suite and 10/10 KILLED with only the new importance test; control/restored-control 155/0; sha256 pre==post.
- Gates: bun test packages/hermes 155 pass / 0 fail / 389 expect; junit 155 testcases 0 failures; typecheck 6/6; biome 129 files EXIT=0; DBs []; .bak 0.

## Fix round 6 (2026-10-09T17:30:02+00:00) - oracle D33-D34 (tests only)
- knowledge.test.ts: SlowKnowledgeStore (real 20 ms async upsert, optional failure) at :235; 'awaits each async upsert before resolving, in _id order' :251 (rows d3,d1,d2 -> seen ['d1','d2','d3'], count 3); 'propagates upsert rejection' :260 (rejects.toBe(sameError)).
- context.limits.test.ts: 'first task term counts toward relevance' :236 (['b','a'] for task 'mongo flaky'); 'single-character task term counts toward relevance' :241.
- Mutation proof (mutants-round7.txt): K16 10/10 KILLED, C24 10/10 KILLED (new tests only), full suite 157/2 on each mutant; original 159/0.
- Gates: 159 pass / 0 fail / 394 expect; junit 159 / 0 failures; typecheck 6/6; biome 129 files EXIT=0; DBs []; .bak 0; production sha256 unchanged.

## Fix round 7 (2026-10-09T18:28:18+00:00) - oracle D36-D42 (tests only)
- NEW store.scoping.test.ts (8 tests): D36 assembleContext for iot (domain) and ceo (executive) with programming rows present (programming memory importance 9): ctx.agentId, profile id/name, memory text, lesson, skills by role; getMemories/getExperience for iot/ceo exclude programming. D37 runId + embedding round-trip (API + raw row), absent fields stay absent.
- context.limits.test.ts +1: D38 rag [kb-big, kb-small], budget = profile + small -> kb-small kept, kb-big dropped.
- knowledge.test.ts +3: D39 StaggeredKnowledgeStore (delays a 40, b 20, c 1 ms): finished order a,b,c and maxInFlight 1; failure on b -> started exactly [a,b]; D40 tie 'B' before 'b'.
- store.versioning.test.ts +2: D41 ensureProfileVersion raw createdAt == injected T0; D42 voiceGuidelines '' accepted and read back.
- Mutation proof (mutants-round8.txt): 15/15 KILLED (K26 10/10); original 3/3 and 10/10 PASS; sha256 pre==post.
- Gates: 173 pass / 0 fail / 431 expect / 9 files; junit 173, 0 failures; typecheck 6/6; biome 130 files EXIT=0; DBs []; .bak 0; production sha256 unchanged.

## Fix round 8 (2026-10-10T09:08:17+00:00) - oracle D43 (E06-E12, seed names; tests only)
- seed.test.ts: EXPECTED_PERSONAS (Record<AgentId,{name,firstTrait}>, frozen); 'each seed profile has its exact name and first personality trait' (SEED_PROFILES in AGENT_IDS order); 'persisted profiles carry the exact seeded names and first traits' (getProfile after seedProfiles, + non-empty voiceGuidelines).
- RED: E06 applied before assertions -> 173/0 SURVIVED. After: E06-E12 7/7 KILLED (2 tests each); control/restored 175/0; sha256 pre==post; seed JSON 7/7 match orc06h/seed.sha.
- Gates: 175 pass / 0 fail / 446 expect / 9 files; junit 175 / 0 failures; typecheck 6/6; biome 130 files EXIT=0; .bak 0; DBs [].

## Fix round 9 (2026-10-10T10:41:12+00:00) - oracle R9 25 real gaps (tests only)
- knowledge.test.ts +2: 'multi-term query sums per-term BM25 parts (exact scores and rank)' (M215; expected scores computed in-test from k1/b/idf formula, b's single cherry part < a so only summation ranks b first); 'rows with empty tags are hydrated and searchable too' (M223).
- store.guards.test.ts +2: 'fractional pointer activeVersion 1.5 throws ZodError, not NotFound' (M002); 'a stray id field in the stored row never overrides the row _id' (M018).
- seed.test.ts +2 with EXPECTED_SEED_PROFILES (full literal ProfileVersion x7): 'SEED_PROFILES equals the full literal seed objects' and 'getProfile after seeding returns the full literal seed object per agent' (M289 M295 M301 M307 M313 M319 M325, M326-M339).
- Mutation proof (mutants-round10.txt): BEFORE 0/25 killed (175/0), AFTER 25/25 KILLED; control/restored 181/0; sha256 pre==post.
- Gates: 181 pass / 0 fail / 465 expect / 9 files; junit 181 / 0 failures; typecheck 6/6; biome 130 files EXIT=0; .bak 0; DBs []; production, seed JSON and bun.lock sha unchanged.

## Fix round 10 (2026-10-10T11:28:47+00:00) - oracle R10 E1 (tests only)
- store.guards.test.ts +3 ('stray id field never overrides _id (memory, skill, experience)'), knowledge.test.ts +1 ('a stray id field in a knowledge_docs row never overrides the row _id').
- mutants-round11.txt: E1a-E1d 4/4 KILLED (each new test GREEN on prod, RED on its mutant); sibling E1e (createdAt order) equivalent. 185 pass / 0 fail / 470 expect; typecheck 6/6; biome 130 EXIT=0; .bak 0; DBs []; production + bun.lock sha unchanged.
