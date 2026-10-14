# RH-HERMES-001 — Oracle verify round 4

Scratch: /tmp/opencode/orc06d/ (runner.py, prunner.py, d.json/d.jsonl, new.json/new.jsonl/newmut.py, o07.py, a21.json/a21.jsonl, probes.test.ts, security.test.ts, surv.json/surv.jsonl).

## Baseline (before any mutation)
- sha256 of the 9 production files == expected values in the task card (all 9 match).
- `bun test packages/hermes`: 132 pass / 0 fail (353 expects, 7 files).
- `bun run typecheck`: 6/6 exit 0. `bunx biome check .`: 128 files, exit 0. `.bak` count 0.

## D11-D21 re-proof (16 mutants, round-3 patterns from /tmp/opencode/orc06c/mutants.json)
All 16 KILLED by committed tests (full `bun test packages/hermes`):
| id | killing test |
|---|---|
| S23 | store.guards: getExperience returns only requested agent rows; assembleContext never carries other lessons |
| S40 | store.guards: addMemory rejects ttl 0 / empty runId |
| S57 | store.guards: addExperience rejects empty lesson |
| S65 | store.guards: ensureProfileVersion rejects empty trait |
| S02 | store.guards: codeless error rethrown as-is |
| S12 | store.guards: first ensure of v2 points activeVersion at 2 |
| S51 | store.guards: findSkills multi-tag / extra unknown tag |
| K09 | knowledge.test: tag filter shares at least ONE tag |
| K30 | knowledge.test: repeated query terms count once |
| C12 | context.limits: experience fills before rag |
| C15 | context.limits: budget 0 valid when profile costs 0 |
| C29 | context.limits: rankMemories counts DISTINCT terms |
| C30 | context.limits: task text goes through tokenizer |
| E02 | seed.test: seed profile objects frozen |
| O02 | store.guards: no embedding key stored |
| O07 | store.guards: unique index exists when factory resolves |
O07 race check (`bun test packages/hermes/src/store.guards.test.ts -t unique`): original 5/5 pass (+3 more later), mutant 5/5 fail. Robust.

## New mutation sweep: 122 mutants (new.json), full `bun test packages/hermes` each
87 KILLED, 35 SURVIVED, 0 pattern errors.
Killed: A02 A04 A06 A09 A10 A11 A12 A13 A15 A16 A17 A18 A19 A20 A22 A23 A24 A26 A27 A28 A29 A30 A31 A32 A33 A35 A36
B01-B21 C53-C70 C72-C77 C79 C80 T06 E09 E11 E12 O12-O19 O26
Highlights killed: k1/b/idf constants (B01-B05,B12), cross-agent pointer/memory/role leaks (A02 A04 A19 A32), TTL sign/inversion (A10 A22 A35), clock bypass (A11-A13), budget boundary (C63), profile-first layer order (C64), dropped/remaining accounting (C62 C79), seed version/subset (E11 E12), collection names (O13-O15).

### Survivors — equivalent (19)
| id | file:line | mutation | reason |
|---|---|---|---|
| A01 | store.ts:28 | pointer activeVersion drop `.int()` | only reachable via corrupt raw row; both versions fail closed (ZodError vs HermesNotFoundError since no profile has a fractional version). Low; same class as accepted S48 |
| A03 | store.ts:129 | pointer id from `asAgent` | after assertOwnData `agentId === asAgent` |
| A14 | store.ts:101 | profile createdAt `new Date(0)` | createdAt never read back (stripped by zod); storage-only metadata, same class as O10 |
| A34 | store.ts:34 | drop `'code' in error` | `error.code` is `undefined` !== 11000 -> false, same result |
| B22 | knowledge.ts:48 | swap intersection direction | set intersection non-empty is symmetric |
| C52 | context.ts:100 | role fallback '' -> 'domain' | every AgentId has a definition; invalid id rejects in getProfile inside the same Promise.all |
| E10 | seed.ts:27 | seed in reverse order | per-agent independent idempotent inserts; same return |
| O20 O21 | models.ts:76,106 | drop mongoose enum kind/outcome | zod parse on write and read rejects first (same as accepted O03/O04) |
| O22 O23 | models.ts:99,113 | drop skill/experience index | perf only (same as O08) |
| O24 O25 | models.ts:107,94 | drop `default: []` | zod requires the arrays on every write |
| O27 | models.ts:119 | model name change | collection pinned explicitly; name unused |
| R05 | errors.ts:19 | BudgetError extends RangeError | supertype widening only; name/instanceof HermesBudgetError unchanged, no consumer |

### Survivors — NON-equivalent (16; each killed by scratch probe /tmp/opencode/orc06d/probes.test.ts that PASSES on original code)
| D | mutant | file:line | change | repro / required test |
|---|---|---|---|---|
| D22 | A05 | store.ts:91 | `findOne({agentId})` -> `findOne({})` | versions numbered globally: create ceo v1,v2 then programming -> must be v1 / id `hermes-programming-v1` (probe PA05 KILLED) |
| D23 | A07 | store.ts:101-102 | setActiveVersion before Profile.create | Profile.create throws -> pointer must stay on previous version (PA07 KILLED). Test: spy create reject, assert getProfile still v1 |
| D24 | A08 | store.ts:120 | `exists({agentId,version})` -> `exists({version})` | ceo has v2, programming only v1: `activateProfileVersion('programming',2)` must throw HermesNotFoundError and leave pointer at v1 (PA08 KILLED) |
| D25 | A21 | store.ts:161 | drop `createdAt:-1` sort (sort by `_id` only) | existing test "newest first..." is vacuous: its `_id`s (`0,a,b,z`) already sort in createdAt order. Survived 6/6 runs. Test: `_id` order opposite to createdAt (PA21 KILLED) |
| D26 | A25 | store.ts:170 | upsertSkill returns altered skill | assert return equals input (PA25 KILLED) |
| D27 | C78 | context.ts:91 | reverse non-matching experience | non-matching taskType rows must keep newest-first order in experience layer (PC78 KILLED) |
| D28 | T05 | tokens.ts:7 | trim before counting | `estimateTokens('     ') === 2` (PT05 KILLED) |
| D29 | R01-R04 | errors.ts:5,15,19,12 | error `name` -> 'Error'; AccessError message -> 'denied' | assert `.name` of all 3 errors and AccessError message (PR KILLED) |
| D30 | C71, I01-I08 | context.ts:19, index.ts:1-9 | CONTEXT_LAYER_IDS reorder; drop any barrel re-export; PACKAGE_NAME change | package entry `src/index.ts` is never imported by any test. Test: import from `./index`, assert key exports + PACKAGE_NAME + CONTEXT_LAYER_IDS order (PI KILLED) |
Priority: D22-D25 are behavioral contract gaps (versioning/pointer integrity, memory order); D26-D30 cheap surface pins.

## Security / acceptance (hands-on, original code)
/tmp/opencode/orc06d/security.test.ts: 3/3 pass.
- 7x6 agent pairs x getProfile/getMemories/getExperience -> HermesAccessError, zero find/findOne/findById issued.
- assembleContext for all 7 seeded agents contains only own memories/experience; profile id `hermes-<agent>-v1`.
- seeded programming @500: profile + exactly 3 memories, 2 relevant first, totalTokens <= 500; budget profile-1 and 0 -> HermesBudgetError.
No production bug found (all probes pass on original).

## Cleanup receipts
- After sweep: sha256 of all 9 production files == expected (mappers d413bd8c..740f, store dbc54590..210a, context 85059f06..d32b, errors 97743c3c..0512, index 1d80824d..cede, knowledge fe662329..44e5, models 169e225a..6b85, seed 0effb3d5..fac6, tokens fe0e0a94..295b).
- `.bak` count 0. `/usr/bin/find apps packages/shared -newer d.json` -> empty.
- Incident: 2 leftover DBs (`redhunter_test_1791559743044_3963f5cd`, `redhunter_test_1791559744887_0186ab32`) from my O07-mutant runs (init() removed -> test aborted before drop). Dropped via mongosh; final `listDatabases` filter `redhunter_test*` -> `[]`.
- Final: `bun test packages/hermes` 132/0, typecheck 6/6, biome exit 0.

## Verdict
D11-D21 closed. New non-equivalent survivors D22-D30 (16 mutants), no production bug.

VERDICT: rejected
