# T6 Hermes — Oracle verify round 11 (bounded rubric)

VERDICT: confirmed

Summary:
- Part A: both T6 acceptance criteria + all plan §6 items hold; each pinned by existing tests and re-proven by independent probe (17 expects, pass).
- Part B: 121 mutants (R11-001..121) + 2 follow-up probes (R11-122/123) on a COPY at /tmp/opencode/orc06k/ws; full `bun test` (185 tests) per mutant.
- Result: 123 valid, 120 killed, 3 survived, 0 invalid.
- Part C: 3 survivors, all class (ii). Class-(i) count = 0.
- Baseline (real repo): bun test packages/hermes 185 pass / 0 fail / 470 expect, 9 files; typecheck 0 exit (shared/hermes/api); biome 130 files clean.
- Cleanup: production sha256 identical before/after (all 16 files), .bak count 0, redhunter_test_* DBs [], no stray processes. Repo never mutated (all mutation in /tmp copy).

## Part A — acceptance vs tests
| Requirement | Test proof | Probe |
|---|---|---|
| programming ctx = profile + top-3 relevant memories within budget | context.test.ts:54 (exact memory ids, layer order, total<=2000, ceo memory excluded) | yes: 6 own + 1 ceo memory, budget 500 -> 3 relevant own, no ceo text |
| cross-agent read rejected | store.test.ts:132-149 (profile/memories/experience -> HermesAccessError before any query, spies); store.scoping.test.ts:83/103; store.guards.test.ts:60 | yes: all 3 readers reject HermesAccessError |
| versioned append-only + activeVersion pointer | store.test.ts:48,72,99; store.versioning.test.ts:52-211 | yes: v2 appended, 2 rows, pointer activeVersion=2, ctx uses v2 |
| hermes_memories / hermes_skills / hermes_experience | models.ts:15-17; store.guards.test.ts:165 (storage shape) | yes: collection names asserted |
| KnowledgeStore upsert/search(query,k,filter) BM25, hydrate from knowledge_docs | knowledge.test.ts:49-414 (exact BM25 scores :125/:144, k caps :103-118, hydrate :228-361) | yes: hydrate=1, rag layer ['k1'] |
| assembleContext(agentId, task, budget) | context.test.ts, context.limits.test.ts | yes |
| 7 seed profiles | seed.test.ts:106,143,149,173,183 | yes: 7 agentIds, seedProfiles()=7 |

## Part B — sweep
Runner: /tmp/opencode/orc06k/mut.py, results /tmp/opencode/orc06k/results.json, log run.log.
Distribution: store 48, context 32, knowledge 27, seed 5, tokens 2, errors 3, models 4 (+2 context follow-ups).
Killed 120 / survived 3.

## Part C — survivors (all class ii, non-blocking)
1. R11-031 store.ts:201 drop `if (existing !== null) return toProfile(existing);` — EQUIVALENT: create() then hits E11000 on duplicate _id, catch path re-reads the same row and returns toProfile(stored). Same return value, same pointer behavior; only an extra failed insert (perf/defensive fast path).
2. R11-079 context.ts:104 `findSkills(role, [...task.capabilityTags, agentId])` — injected-constant mutant (extra tag literal equal to agent id). Tag passthrough itself is pinned: R11-122 (fixed tags ['code']) and R11-123 (fixed role) both KILLED (store.scoping.test.ts iot/ceo scoping tests), plus $in->$all and role-drop mutants killed. Not a realistic fault class; listed only.
3. R11-096 knowledge.ts:43 `doc: cloneDoc(doc)` -> `doc` — EQUIVALENT: upsert passes `KnowledgeDocSchema.parse(doc)` which returns a fresh object with a fresh tags array (verified: parsed !== input, parsed.tags !== input.tags), and search() still clones on output. Caller mutation cannot leak.

## Cleanup receipt
- sha256 before == after (cmp OK): store dbc54590…, models 169e225a…, context 85059f06…, knowledge fe662329…, seed 0effb3d5…, tokens fe0e0a94…, errors 97743c3c…, index 1d80824d…, mappers d413bd8c…, 7 seed JSON.
- /tmp copy src files identical to repo after sweep.
- .bak under packages/ apps/: 0. redhunter_test_* DBs: []. Stray processes: 0.
