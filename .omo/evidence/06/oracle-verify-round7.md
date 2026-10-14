# T6 RH-HERMES-001: adversarial verification, round 7

Fresh verifier. Scratch dir: `/tmp/opencode/orc06g/`. It holds copies w0..w3 of packages/hermes, packages/shared and apps/api, with node_modules symlinked. Production files were never edited in place, so zero `.bak` files were created.
Tooling: `run.py` patches a scratch copy only when the pattern matches exactly once, and restores it in `finally`. Mutant specs are in `gen.py`/`m1.json` and `gen2.py`/`m2.json`, results in `*.out.json`. Scratch-only probe tests: `probe.test.ts`.

## Baseline (real repo)
- `bun test packages/hermes`: 159 pass / 0 fail, 394 expect(), 8 files.
- `bun test apps/api`: 241 / 0, 24 files. This suite is used to judge the mappers.ts mutants.
- `bun run typecheck`: 6/6 packages exit 0.
- `bunx biome check .`: 129 files, no fixes.
- No `.only`, `.skip`, `.todo` or `expect(true)` in packages/hermes/src.

## Integrity
- sha256 was taken over 26 files before and after: all hermes src, test and test-support files, 7 seed JSON files, package.json and mappers.ts. `diff sha-pre sha-post` is empty.
- Production hashes match the expected values exactly:
  - mappers d413bd8c…5740f
  - store dbc54590…a210a
  - models 169e225a…6b85
  - context 85059f06…d32b
  - knowledge fe662329…44e5
  - seed 0effb3d5…6ac6
  - tokens fe0e0a94…295b
  - errors 97743c3c…0512
  - index 1d80824d…cede

## D33 / D34 re-proof (scratch w0, 10 runs each)
| defect | mutant | original | mutant, targeted tests x10 | mutant, full suite |
|---|---|---|---|---|
| D33 | knowledge.ts:121 drop `await` on upsert | 13/0 | 10/10 KILLED (11/2) | 157/2 (both SlowKnowledgeStore tests fail) |
| D34 | context.ts:77 `tokenize(taskText.slice(1))` | 2/0 | 10/10 KILLED (0/2) | 157/2 (both first-term tests fail) |
Control after restore: 159/0. D33 and D34 are closed and deterministic.

## New mutants: 175 valid (150 in batch 1, 25 in batch 2), 1 invalid (S22, pattern not found)
Killed by the existing suite: 134.
The killed set covers:
- Dup-key discrimination, access guard inversion, ttl `<=`/no ms/undefined → false.
- Version base and sort, pointer move removed, `$setOnInsert` → `$set`, not-found guards.
- Memory, experience and skill sort tiebreaks, `$in` → `$all`, role/agent filters dropped.
- Clock bypass in addMemory, getMemories, addExperience and createProfileVersion.
- BM25 k1 2.0 and 1.25, b 0.5, 0 and 0.8, idf +1 variants, tokenizer variants, filter inversion.
- Score > 0 filter, id tiebreak removed, tf numerator, length normalisation swaps, title not indexed, tf capped, upsert-if-absent, `slice(1)` on hydrate docs.
- TOP_* constants, FILL_ORDER swaps, every rank-key flip, fit `<`/`+1`, profile `>budget+1`.
- Per-field render removals, ranking bypass, profile layer dropped, custom estimator ignored.
- tokens /5 and round; error names, message and class; index re-exports; seed order, freeze, create vs ensure.
- Model unique index, embedding default, versionKey, ttl field, collection names.
- Mappers per-field id/date/role/email guards.

Survivors from the full suite: 41. Each was then run against scratch probe tests (11 tests, 11/0 on original code).

### Accepted as equivalent (26)
- S03: `'code' in (error ?? {})` behaves the same for null and non-objects.
- S23: replaceOne → updateOne. zod forces every field, so there is no stale-field difference.
- S31: dropping ProfileInputSchema.parse. HermesProfileSchema.parse still validates, and id/version are overwritten.
- S36, K34: my own no-op mutants.
- K13: ids are unique Map keys, so `a===b` never happens.
- K14: no `||1`. avg = 0 only when every doc is empty, and then nothing scores.
- K15: no `freq===0` skip. That term contributes 0, and norm is always > 0.
- K19, K20, K21: covered by the early return or an empty loop (K03 class).
- K24: the filter `id:$exists:false` matches no real rows, because API writes store `_id` only.
- K25: rows.length === docs.length.
- C27: totalTokens = budget − remaining, which is identical to the sum of the layers.
- X12: budget `< -1`. The profile check (tokens ≥ 0 > −1) still throws HermesBudgetError.
- E03: BudgetError extends RangeError. The name and instanceof Error are unchanged.
- D04: `return 7`, the seed constant.
- D05: seed via Promise.all. The ids are independent, so the outcome is the same.
- M03, M08, M09, M14, M15, M16: O-class, because zod validates every write.
- X07: dropped memory index only affects performance.
- X17: `String(ObjectId)` equals the hex string.

### NON-EQUIVALENT survivors (15), each killed by a scratch probe that passes on original code
| id | file:line | mutation | probe |
|---|---|---|---|
| C16 | context.ts:103 | `getMemories('programming','programming')` | P1, P10 |
| X01 | context.ts:105 | `getExperience('programming','programming')` | P1 |
| X02 | context.ts:102 | `getProfile('programming','programming')` | P1 |
| X03 | context.ts:103 | memories hardcoded for non-ceo agents | P10 |
| X04 | context.ts:100 | role taken from 'programming' definition | P11 |
| X05 | context.ts:164 | returned `agentId: 'programming'` | P1 |
| X06 | store.ts:161 | `Memory.find({agentId:{$in:[agentId,'programming']}})` | P1, P3 |
| M07 | models.ts:75 | drop memory `runId` field (strict mode strips it) | P5 |
| X08 | store.ts:154 | memory stored with `runId: undefined` | P5 |
| X10 | store.ts:154 | memory stored with `embedding: undefined` | P5 |
| C26 | context.ts:157 | `break` after first drop inside a layer | P4 |
| K26 | knowledge.ts:121 | `await Promise.all(docs.map(upsert))` | P7 |
| K35 | knowledge.ts:89 | `compareIds` → `localeCompare` | P9 |
| S26 | store.ts:203 | seeded profile `createdAt: new Date(0)` (ignores injected clock) | P8 |
| M04 | models.ts:53 | voiceGuidelines `required: true` (rejects `''`, which zod allows) | P6 |

## Defects (new; D35 is reserved for teardown and was NOT observed)
### D36 HIGH (SECURITY): agent scoping is only ever tested with `programming` as the requester
- Mutants: C16, X01–X06.
- Every `assembleContext` test calls `'programming'`. The only isolation test for getMemories reads programming while a ceo row is present.
- So a refactor that hardcodes or widens to `programming` passes all 159 tests. Examples: profile, memories, experience, role, returned agentId, or a `$in` in the memory query.
- If that happens, every other agent would be served Pip's profile, memories and lessons. That is the exact cross-agent leak the card's SECURITY line forbids.
- Fix (tests only): run assembleContext for a second agent (ceo or iot) with programming rows present, and assert the profile id, memory and lesson texts, skills role (executive vs domain) and `ctx.agentId`. Also assert `getMemories('ceo','ceo')` excludes programming rows.

### D37 MEDIUM (data loss): optional memory fields `runId` and `embedding` are never read back
- Mutants: M07, X08, X10.
- If the memory schema loses `runId` (mongoose strict mode strips it silently), or `addMemory` drops runId or embedding, nothing fails.
- M02 only checks that an *absent* embedding is not stored as `[]`.
- Fix: addMemory with `runId` and `embedding`, then assert getMemories returns both.

### D38 MEDIUM: greedy fill continuation *within* one layer is untested
- Mutant: C26.
- The comment at context.ts:128 promises that "a smaller later block may still fit after a drop". The existing test only covers a drop in memories followed by a fit in rag.
- Fix: one layer with [big, small] where only the small block fits; assert small is kept and big is in `dropped`.

### D39 MEDIUM: hydrate sequential contract is not pinned
- Mutant: K26.
- SlowKnowledgeStore uses one fixed delay, so `Promise.all` keeps the order and still rejects.
- The design says "awaits upsert sequentially". The mutant runs concurrent writes against a vector store and keeps upserting after a failure.
- Fix: give each doc a different delay (a slow, c fast) and expect `seen` = _id order. On rejection, expect exactly one upsert call.

### D40 LOW: knowledge tie order
- Mutant: K35.
- `compareIds` does code-unit comparison. `localeCompare` is locale-dependent and orders 'b' before 'B', and no test notices.
- Fix: a tie test using ids 'B' and 'b'.

### D41 LOW: injected clock bypass in `insertProfileIfMissing`
- Mutant: S26.
- This is the same class as the S25/D31 default-clock tests, which already pin createdAt for createProfileVersion.
- Fix: assert seeded row `createdAt` equals the injected T0.

### D42 LOW: no profile with `voiceGuidelines: ''`
- Mutant: M04.
- The shared schema allows an empty string. A `required: true` in the model rejects it, and no test notices.
- Fix: createProfileVersion with `''` succeeds.

## Hands-on acceptance (scratch w0, real mongod, own DB dropped in afterAll): 1/1 pass
Setup: seedProfiles → 7. Memories for programming: 3 relevant, 2 irrelevant with importance 9/8, plus 1 relevant ceo row with importance 9.
`assembleContext('programming', 'Fix the flaky mongo test in the dispatcher', 500)` gives:
- Layers: profile 40, skills 0, memories 30 (3 blocks), experience 0, rag 0. Total 70 ≤ 500.
- The profile contains `Name: Pip`.
- The memories are exactly the 3 relevant programming memories. The two 3-hit memories come first, ordered by recency; `dispatcher backoff` (2 hits) is last. The high-importance irrelevant memories and the ceo memory are excluded.
- getMemories, getProfile and getExperience `('ceo','programming')` each reject with HermesAccessError.
The acceptance criteria hold for `programming`. D36 shows the same guarantee is not test-protected for any other agent.

## Cleanup receipt
- sha256 pre == post: 26/26 match (`diff` empty).
- `/usr/bin/find packages apps -name "*.bak" -not -path "*/node_modules/*" | wc -l` → 0. `zz_*` probe files left in the repo → 0.
- Three normal full-suite runs in the real repo: each 159/0, and the leftover `redhunter_test*` listing was `[]` after each run. D35 not reproduced.
- Final listDatabases filter → `[]`.
- Scratch `/tmp/opencode/orc06g/` (2.9M: w0–w3 copies and scripts) was NOT removed: the Safety Net hook blocks `rm -rf` outside cwd. Left for manual deletion.
- No git commands. No files written under `.omo/plans`, `apps/**`, `packages/shared/**` or `.env`. whatsapp-monitor pids untouched.

## Summary
D33 and D34 are confirmed fixed (10/10 kills each). However, 15 new non-equivalent survivors map to defects D36–D42. They include a HIGH security gap: cross-agent isolation of `assembleContext` and getMemories is only tested from the `programming` side. All fixes are test-only; production code is unchanged.

VERDICT: rejected
