# RH-HERMES-001 — Oracle verify round 3 (fresh eyes)

Scope: packages/hermes/src/{errors,tokens,models,store,knowledge,context,seed,index}.ts + all 6 test files.
Scratch: /tmp/opencode/orc06c/ (runner.py, mutants.py/json, results.jsonl, killers.test.ts, security.test.ts, probe.py/log).

## Commands / results
- Pre-run scope: `/usr/bin/find apps packages -newer .omo/evidence/06/oracle-verify-round2.md -type f -not -path '*/node_modules/*'` -> only packages/hermes/src/store.ts, store.versioning.test.ts (OK).
- `apps/api/src/db/mappers.ts` sha256 d413bd8c...740f (OK). store.ts sha256 dbc54590...210a (unchanged since round 2).
- Baseline: `bun test packages/hermes` 113 pass / 0 fail; `bun run typecheck` 6/6 exit 0; `bunx biome check .` 127 files clean.
- Mutation sweep: 184 mutants, `bun test packages/hermes` per mutant -> 144 KILLED, 40 SURVIVED (0 pattern errors).
- Survivor probes: 16 targeted tests in killers.test.ts, all PASS on original code, then re-run per mutant.
- Security hands-on: security.test.ts 3 pass (7x6 agent pairs x 3 readers -> HermesAccessError, zero find/findOne/findById calls; assembleContext for all 7 seeded agents contains only own memories/experience; seeded programming @500 has profile + 3 memories, top-2 relevant first, total <= budget; budget profile-1 and 0 -> HermesBudgetError).
- After restore: sha256 of all packages/hermes/src files == pre-run (0 mismatches); no *.bak; tests 113/0; typecheck 6/6; biome clean.
- Post-find (after my runs) still lists only packages/hermes/** (mtimes touched by restore; content sha identical).
- Incident: first runner killed by shell timeout mid-S18; store.ts.bak restored manually, sha verified. Leftover DBs
  (`redhunter_test_1791555915128_fae6cb90` from killed run, `redhunter_test_ko07_*` from O07 probe) dropped; final listDatabases filter -> `[]`.

## D10 closure (required)
| id | file:line | mutation | result |
|---|---|---|---|
| N8 | store.ts:35 | `error.code === 11000` -> `true` | KILLED (non-E11000 rethrown test) |
| N8b | store.ts:33 | isDuplicateKeyError returns true | KILLED |
| N12 | store.ts:206 | non-dup -> return input | KILLED (2 tests) |
| N10 | store.ts:208 | dup + no row -> return input | KILLED (foreign _id test) |
| N11 | store.ts:208 | dup + no row -> generic Error | KILLED (foreign _id test) |
D10 is closed.

## Killed (144)
N8 N8b N12 N10 N11 S01 S04 S05 S07-S11 S13-S22 S24-S33 S35-S38 S41-S47 S50 S52-S56 S58-S64 S66 S67
K01 K02 K07 K08 K10-K15 K17 K18x K19 K20 K23-K29 K32-K38 C01-C11 C13 C16-C28 C31-C43 C45-C48 C50 C51
T01-T04 E01 E03-E07 O01 O05 O06 (mutation text: /tmp/opencode/orc06c/mutants.py)

## Survivors — equivalent (24)
| id | file:line | mutation | reason |
|---|---|---|---|
| S03 | store.ts:34 | drop `error !== null` | only differs when `null` is thrown; Mongoose never throws null |
| S06 | store.ts:201 | drop existing fast-path | create then E11000 then re-read returns same stored row |
| S34 | store.ts:90 | drop ProfileInputSchema.parse | HermesProfileSchema.parse at :95 validates the same fields |
| S39 | store.ts:154 | createdAt as ISO string | Mongoose casts to Date |
| S48 | store.ts:62 | drop instanceof Date guard | `.toISOString()` on non-Date still throws |
| S49 | store.ts:175 | drop empty-tags return | `$in: []` matches nothing |
| K03 | knowledge.ts:65 | `k<=0` -> `k<0` | slice(0,0) = [] |
| K04 | knowledge.ts:65 | drop empty-query guard | all scores 0, none pushed |
| K05 | knowledge.ts:65 | drop empty-store guard | loop over 0 docs |
| K06 | knowledge.ts:67 | drop `||1` | avg 0 only when every doc has 0 terms -> freq 0 |
| K16 | knowledge.ts:43 | no clone on index | zod parse in upsert already returns a fresh copy |
| K21 | knowledge.ts:88 | drop `a===b` | ids unique (Map keys) |
| K22 | knowledge.ts:101 | drop `freq===0` skip | term adds exactly 0 |
| K31 | knowledge.ts:118 | drop hydrate sort | Map keyed by id; validation is all-or-nothing |
| C14 | context.ts:136 | drop `budget<0` | negative budget < profile.tokens (>=0) -> same HermesBudgetError |
| C44 | context.ts:163 | total = budget-remaining | algebraically identical |
| C49 | context.ts:103 | identity `.then` | trivial |
| E08 | seed.ts:21 | drop seed parse | seed JSON is constant and valid; content asserted by seed.test |
| O03/O04/O09/O11 | models.ts:44,55,80,53 | drop mongoose min/enum/default | zod parse on every write rejects first |
| O08 | models.ts:86 | drop memory index | perf only |
| O10 | models.ts:58 | versionKey on | `__v` stripped by zod on read |

## Survivors — NON-equivalent (16; each killed by a scratch probe that passes on original code)
| id | file:line | mutation | probe |
|---|---|---|---|
| S23 | store.ts:191 | `Experience.find({agentId})` -> `find({})` | KS23 KILLED |
| S40 | store.ts:148 | drop HermesMemorySchema.parse on write | KS40 (ttl 0 / runId '') KILLED |
| S57 | store.ts:183 | drop HermesExperienceSchema.parse on write | KS57 (lessons ['']) KILLED |
| S65 | store.ts:108 | drop ProfileVersionSchema.parse | KS65 (traits ['']) KILLED |
| S02 | store.ts:36 | `: false` -> `: true` (codeless error = dup) | KS02 KILLED |
| S12 | store.ts:113 | pointer activeVersion forced to 1 | KS12 (ensure v2) KILLED |
| S51 | store.ts:176 | `$in` -> `$all` | KS51 KILLED |
| K09 | knowledge.ts:48 | `some` -> `every` | KK09 KILLED |
| K30 | knowledge.ts:64 | drop query-term Set dedupe | KK30 KILLED |
| C12 | context.ts:150 | fill order rag before experience | KC12 KILLED |
| C15 | context.ts:136 | `budget<0` -> `budget<=0` | KC15 (estimator 0) KILLED |
| C29 | context.ts:72 | overlap counts duplicates | KC29 KILLED |
| C30 | context.ts:77 | task text split on space | KC30 KILLED |
| E02 | seed.ts:15 | profile object not frozen | KE02 KILLED |
| O02 | models.ts:79 | drop `default: undefined` on embedding | KO02 (`embedding: []` leaks) KILLED |
| O07 | models.ts:126 | drop `model.init()` | KO07 (unique index absent) KILLED |

## Real bugs (production code)
None found. All 16 probes and the security test pass on the original code.

## Defects (test adequacy; continuing at D11)
- D11 (SECURITY, high): S23 — removing the `agentId` filter in getExperience leaks other agents' experience; no repo test seeds 2 agents' experience then reads one (memories have this test; experience does not). Also reaches assembleContext.
- D12 (trust boundary): S40/S57/S65 — write-path zod validation in addMemory/addExperience/ensureProfileVersion is unobserved; existing "invalid input" tests use values Mongoose also rejects (importance -1, taskType ''). Use zod-only invalid values (ttl 0, runId '', lessons [''], traits ['']).
- D13: S02 — a codeless error with the row present afterwards is swallowed; D10 test uses code 64 only. Add codeless + row-present case.
- D14: S12 — ensureProfileVersion pointer `activeVersion: fields.version` unobserved (all tests use v1).
- D15: S51/K09 — "share at least one tag" semantics untested in findSkills and knowledge filter (only single-tag inputs).
- D16: K30 — query-term dedupe untested (repeated query terms inflate BM25).
- D17: C12 — FILL_ORDER experience > rag not observed (only output layer order and skills/memories drop are).
- D18: C29/C30 — rankMemories "distinct task terms" and tokenized task text untested.
- D19: C15 — budget 0 boundary (valid per spec) unobserved; only reachable with a pluggable estimator returning 0.
- D20: E02 — per-profile Object.freeze unobserved (test checks array + container only).
- D21: O02/O07 — embedding `default: undefined` and awaited `model.init()` (unique index ready on return) unobserved.

Summary: 184 mutants, 144 killed, 24 equivalent, 16 non-equivalent survivors (D11-D21). Acceptance behaviour and security hold in hands-on tests, but the suite does not observe D11 (security) or the other guards.

VERDICT: rejected
