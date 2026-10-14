# Oracle adversarial verify — T6 RH-HERMES-001 (packages/hermes)

VERDICT: rejected

Baseline reproduced: `bun test packages/hermes` 96 pass / 0 fail / 246 expect; typecheck 6/6 exit 0; biome 125 files clean; leftover test DBs `[]`.
Mutation runner: /tmp/opencode/orc06/mut.py (+ mut2.py, same list, loosened field = `z.any().optional()`), logs run1.log / run2.log.
Each mutation: pattern count==1 asserted, in-place edit, `finally` byte restore. CONTROL 96/0 and RESTORED-CONTROL 96/0.
Restore proof: `sha256sum -c /tmp/opencode/orc06/before.sha` -> 0 mismatches (all hermes src, test-support, seed json, package.json).
Scope: apps/api/src/db/mappers.ts sha256 = d413bd8c...a5740f (match); `find packages/shared apps -newer ref-start.txt` -> empty.

## Mutation table (133 mutants; EQ = equivalent mutant, no observable behavior change)

| # | Guard | Mutant | Result |
|---|---|---|---|
| 1 | assertOwnData | A1-A3 remove per method; A4 invert; A5 assert after query | all KILLED (cross-agent %s read rejected before any query / seedProfiles) |
| 2 | mapper profile | passthrough, id,name,role,traits,voice,constitutionRef | KILLED |
| 2 | mapper profile | agentId, version loosened | SURVIVED, EQ (query pins both to validated pointer values) |
| 2 | mapper memory | passthrough,id,runId,kind,text,embedding,importance,ttl | KILLED |
| 2 | mapper memory | agentId (EQ, query filter), createdAt (EQ, toISOString always valid), Date check removed (EQ, string.toISOString throws TypeError anyway) | SURVIVED-EQ |
| 2 | mapper skill | passthrough + all 5 fields | KILLED |
| 2 | mapper experience | passthrough,id,taskType,outcome,lessons,runId | KILLED; agentId SURVIVED-EQ |
| 2 | pointer | passthrough, activeVersion | KILLED; agentId SURVIVED (see D6) |
| 2 | knowledge hydrate | passthrough,title,text,tags | KILLED; id SURVIVED-EQ (InMemory upsert re-parses) |
| 3 | TTL | `<`->`<=`, ms unit, filter removed, real clock | all KILLED |
| 4 | sort | memories createdAt/_id (O1-O3), experience (O4-O5), skills name desc / _id desc (O6-O7) | KILLED |
| 4 | sort | O8 findSkills `{ _id: 1 }` only (name key dropped) | **SURVIVED** |
| 4 | sort | BM25 tiebreak reversed/removed (O9-O10) | KILLED |
| 4 | rankMemories | hits removed, importance removed/asc, recency reversed | KILLED |
| 4 | rankMemories | O14 recency removed | **FLAKY** (killed 1/7 runs; depends on random uuid order) |
| 4 | rankMemories | O15 id tiebreak reversed | **SURVIVED** |
| 4 | rankExperience | others-first, identity | KILLED |
| 5 | findSkills | role filter, tag filter, role lookup | KILLED; F1 empty-tags guard SURVIVED-EQ (`$in: []` matches nothing) |
| 6 | knowledge | idf=1, classic idf, k1=0, b=0, score>=0, tag filter, out clone, deep tags clone, hydrate per-row, hydrate count, upsert validate, tags indexed | KILLED |
| 6 | knowledge | K2 `k<=0` guard removed (k=-1 -> slice(0,-1)) | **SURVIVED** |
| 6 | knowledge | K6 idf `+0.5`->`+5`, K7 k1=2, K10 b=0.5 | **SURVIVED** |
| 6 | knowledge | K1 `k<0`, K3 no-terms guard, K15 no input clone (zod parse already copies) | SURVIVED-EQ |
| 6 | knowledge | K18 avgLength over filtered docs | SURVIVED (documented minor, accepted) |
| 7 | assembleContext | int guard, profile `>=`, no profile check, fit `<`, dropped unshift/none, TOP_MEMORIES 4/2, no slice, fill order x2, layer order, layer tokens, cross-agent memories, profile render | KILLED |
| 7 | assembleContext | C2 negative guard removed (EQ: profile.tokens >= 0 > budget still throws), C19 total=budget-remaining (EQ arithmetically) | SURVIVED-EQ |
| 7 | assembleContext | C6 stop filling after first drop | **SURVIVED** |
| 7 | assembleContext | C11 TOP_EXPERIENCE=4, C12 =1 | **SURVIVED** |
| 7 | assembleContext | C13 TOP_RAG=4, C14 =1, C23 search k=100 | **SURVIVED** |
| 7 | assembleContext | C15 skills capped to 1 | **SURVIVED** |
| 8 | versioning | V2 version fixed, V4 activate unknown ok, V5 ensure `$set`, V6/V7 ensure, V9 no pointer on create, V11 | KILLED |
| 8 | versioning | V1 latest `.sort({version:1})` | **SURVIVED** |
| 8 | versioning | V3 create via replaceOne upsert (overwrite) | **SURVIVED** |
| 8 | versioning | V8 unique `{agentId,version}` index removed | **SURVIVED** |
| 8 | versioning | V10 missing-row NotFound -> generic Error | **SURVIVED** |
| 9 | seed | order swap, drop one, seed via create | KILLED; S3 return literal 7 SURVIVED-EQ |
| - | tokens | utf16 length, floor | KILLED |

## Defects

D1 context.ts:49-50,110 — TOP_EXPERIENCE / TOP_RAG = 3 and "skills uncapped" unobservable (C11-C15, C23 survive).
  Repro: set `TOP_RAG = 1` or `skills.slice(0,1)`; 96 pass.
  Fix: one test with 4 bugfix experiences, 4 matching knowledge docs, 4 matching skills @2000 -> expect 3 / 3 / 4 block ids exactly.

D2 context.ts:150-160 — "later smaller block still fits after a larger one dropped" unobservable (C6: `remaining=-1` after first drop survives).
  Repro: insert `remaining = -1;` after `dropped.push`; 96 pass.
  Fix: budget = profile + small rag; big memory (dropped) then small rag kept -> expect rag ids [kb] and dropped [{memories,id}].

D3 knowledge.ts:5-7,83 — k1, b and idf constant not pinned (K6 `+5`, K7 k1=2, K10 b=0.5 survive). Plan guard 6 requires idf formula + k1/b constants observable.
  Fix: one exact-score test: 3 known docs, `expect(hit.score).toBeCloseTo(<hand-computed BM25>, 10)`.

D4 knowledge.ts:65 — `k<=0` guard untested for negative k with >=2 hits (K2 survives; slice(0,-1) returns n-1 hits).
  Repro: remove `k <= 0 ||`; existing `search('mongo',-1)` has only 1 hit so slice(0,-1)=[] passes.
  Fix: in that test use a query hitting >=2 docs (e.g. 'mongo deploy') with k=-1 -> [].

D5 store.ts:171 / context.ts:83-84 — sort keys unpinned: findSkills `name` (O8: test ids sort same as names: skill-a/Architecture, skill-review/Code review); rankMemories id tiebreak (O15 survives) and recency (O14 flaky, uuid-dependent).
  Fix: skills test with id 'z'/name 'A' vs id 'a'/name 'B' -> expect ['z','a']. rankMemories: call exported `rankMemories` directly with fixed ids/createdAt (equal createdAt, ids 'b','a' -> ['a','b']; distinct createdAt with ids reversed).

D6 store.ts:129-133 — behavior bug: pointer row agentId is validated as AgentId but not checked == requested agentId. Pointer `hermes-programming` with `agentId:'ceo'` makes `getProfile('programming','programming')` return CEO profile (probe P1: OK hermes-ceo-v1). Cross-agent leak via corrupt/misrouted pointer bypasses assertOwnData intent.
  Fix: query `{ agentId, version: pointer.activeVersion }` (requested agentId) or `if (pointer.agentId !== agentId) throw new HermesNotFoundError(...)`; add test.

D7 store.ts:84-95 / models.ts:60 — append-only guarantees unobservable: V1 (latest by ascending version) survives because no test creates v3; V3 (replaceOne upsert overwrite) and V8 (unique index removed) survive — nothing asserts that writing an existing version fails.
  Fix: (a) create 3 versions -> expect v3 id `hermes-programming-v3`; (b) raw-insert `{agentId:'programming',version:1,_id:'other'}` after v1 -> expect E11000; (c) `Promise.all` two createProfileVersion -> exactly one rejects, count==1 (kills V3).

D8 store.ts:134-136 — missing-row branch (pointer exists, version row absent) has no test (V10 survives). Behavior is correct (probe P2: HermesNotFoundError "Profile iot v4 missing").
  Fix: insert pointer activeVersion 4 with no row -> `rejects.toBeInstanceOf(HermesNotFoundError)`.

D9 store.ts:100-108 — behavior bug: concurrent `ensureProfileVersion` same seed (two api instances booting) -> one rejects `MongoServerError E11000` (probe P3), breaking "idempotent" claim.
  Fix: wrap `Profile.create` in try/catch, on `code === 11000` re-read via findById and `toProfile`; add `Promise.all([ensure, ensure])` test -> both resolve equal, count 1.

## Accepted / equivalent (not defects)
- K18 BM25 averageLength over all docs incl. tag-filtered: affects only normalization constant, ranking among filtered set still monotone in tf/length; accepted as documented minor.
- Equivalent mutants listed as SURVIVED-EQ above (C2, C19, F1, K1, K3, K15, S3, mapper fields pinned by query filter).
- Concurrent createProfileVersion: one rejects with raw E11000 (P4) — append-only safety holds; raw driver error instead of domain error is optional polish.
- Unicode token estimate: code-point based, tested (emoji, é). Grapheme clusters (ZWJ emoji) count >1 — heuristic, ponytail-documented.

## Verdict rationale
Guards 1, 3, 9 fully observable. Guards 2 (non-equivalent), 5 ok. Guards 4, 6, 7, 8 each have non-equivalent survivors (D1-D5, D7, D8). Two real behavior bugs (D6, D9). Effort to fix: Short (1-2h, ~8 tests + 2 small source fixes).
