# Oracle adversarial verify ROUND 2 — T6 RH-HERMES-001 (packages/hermes)

## Baseline receipt
- Before: `bun test packages/hermes` 110 pass / 0 fail / 281 expect, 6 files. After all runs: 110 / 0 / 281 (identical).
- typecheck 3 workspaces listed exit 0 (shared, hermes, api); `bunx biome check .` 127 files clean.
- sha256 of all 23 files under packages/hermes/{src,seed} + package.json: /tmp/opencode/orc06b/before.sha; `sha256sum -c` after the last run: 0 mismatches.
  Incident: the first runner (run1.log) was killed by the tool timeout while store.ts carried mutant `R-skill any id`. I detected it with `sha256sum -c` (1 mismatch), reverted it with an exact single-match replace, re-verified 23/23 OK, dropped the orphan DB, then re-ran everything detached (run2.log). Nothing was left modified.
- apps/api/src/db/mappers.ts sha256 d413bd8c...a5740f (match). `find apps packages/shared .omo/{plans,start-work,boulder.json,notepads} -newer ref-start` returned only `.omo/plans/vyron-landing-page.md`. That file is unrelated to T6, I did not touch it, and it was most likely written by another session.
- Leftover `redhunter_test_*` DBs: `[]`.
- Runners: /tmp/opencode/orc06b/mut.py (full round-1 set + new N*), mutb.py (loosened field = `z.any().optional()`), mut3.py / mut4.py (3x repeats). Logs: run2.log, runB.log, run3.log, run4.log. Throwaway probes: probe.ts, extra.test.ts.

## Mutation table (151 mutants: 128 KILLED, 19 SURVIVED-EQ, 4 SURVIVED non-equivalent, 0 FLAKY, 0 INVALID)
Each mutant: pattern count == 1 asserted, in-place edit, `finally` byte restore. CONTROL and RESTORED-CONTROL 110/0 in every run. All survivors re-run 3x (run3.log), same result each time.

| ids | file | mutation | result |
|---|---|---|---|
| A1-A5 | store.ts | assertOwnData removed/inverted/after query | KILLED |
| R-prof passthrough,id,name,role,traits,voice,constitutionRef | store.ts toProfile | loosen | KILLED (role: z.any() keeps the key required in zod 4.6.5 and survives; z.any().optional() KILLED, runB.log) |
| R-prof agentId, version | store.ts | loosen | SURVIVED-EQ (query filter pins both; accepted round 1) |
| R-mem passthrough,id,runId,kind,text,embedding,importance,ttl | store.ts | loosen | KILLED |
| R-mem agentId, createdAt, no Date check | store.ts | | SURVIVED-EQ (accepted round 1) |
| R-skill passthrough + 5 fields | store.ts | | KILLED |
| R-exp passthrough,id,taskType,outcome,lessons,runId | store.ts | | KILLED (runId via .optional() variant) |
| R-exp agentId | store.ts | | SURVIVED-EQ (query filter) |
| R-ptr passthrough, activeVersion | store.ts | | KILLED |
| R-ptr any agentId | store.ts:131 | loosen pointer agentId | SURVIVED-EQ: the new guard at :133 rejects any value != the requested (already valid) AgentId, so a corrupt agentId throws HermesNotFoundError instead of ZodError. Same rejection, different error class. |
| R-kb passthrough,title,text,tags | knowledge.ts | | KILLED; id SURVIVED-EQ (accepted) |
| T1-T4 | store.ts | ttl | KILLED |
| O1-O18 | store/knowledge/context | sort keys, rank keys | KILLED (O8, O15 now killed; O14 KILLED 3/3, deterministic) |
| F2-F4 | | skills filters | KILLED; F1 SURVIVED-EQ (`$in: []`) |
| K2, K4-K14, K16, K17, K19, K20 | knowledge.ts | | KILLED (K2, K6, K7, K10 now killed) |
| K1, K3, K15 | | | SURVIVED-EQ (accepted); K18 SURVIVED (accepted minor) |
| C1, C3-C18, C20-C24 | context.ts | | KILLED (C6, C11-C15, C23 now killed) |
| C2, C19 | | | SURVIVED-EQ (accepted) |
| V1-V5, V8-V11 | store.ts / models.ts | | KILLED (V1, V3, V8, V10 now killed; V3 KILLED 3/3) |
| V6' | store.ts:201 | fast path returns input instead of stored row | KILLED |
| V7' | store.ts:201 | fast path removed (always create) | SURVIVED-EQ: create on an existing _id hits E11000, the catch re-reads it and returns the stored row. Same result, one extra round trip. |
| S1, S2, S4, E1, E2 | | | KILLED; S3 SURVIVED-EQ |
| N1 | store.ts:133 | D6 guard `if (false)` | KILLED |
| N2 | store.ts:133-137 | guard removed + query by pointer.agentId (the original bug) | KILLED |
| N3 | store.ts:137 | query by pointer.agentId, guard kept | SURVIVED-EQ (guard ensures pointer.agentId === agentId) |
| N4 | store.ts:134 | NotFound -> generic Error | KILLED |
| N5 | store.ts:133 | guard inverted | KILLED |
| N17 | store.ts:137 | agentId dropped from findOne | KILLED |
| N6 | store.ts:206 | no catch, rethrow all | KILLED 3/3 |
| N7 | store.ts:35 | isDuplicateKeyError always false | KILLED 3/3 |
| N13 | store.ts:31 | code 11001 | KILLED 3/3 |
| N9 | store.ts:209 | loser returns own input | KILLED 3/3 |
| N14 | store.ts:114 | pointer upsert false | KILLED |
| N16 | store.ts:216 | setActiveVersion drops agentId | KILLED |
| N18 | store.ts:113 | $setOnInsert agentId 'ceo' | KILLED |
| N15 | store.ts:204 | return `{...fields,id}` without re-parse | SURVIVED-EQ (fields already parsed and stripped by ProfileVersionSchema) |
| **N8** | store.ts:35 | isDuplicateKeyError always true | **SURVIVED 3/3** |
| **N12** | store.ts:206 | non-duplicate error -> return input as success | **SURVIVED 3/3** |
| **N10** | store.ts:208 | duplicate with no row by _id -> return input as success | **SURVIVED 3/3** |
| **N11** | store.ts:208 | duplicate with no row -> generic Error | **SURVIVED 3/3** |

## D1-D9 checklist
- D1 FIXED — C11, C12, C13, C14, C15, C23 KILLED (context.limits "per-layer caps", block-id behavior).
- D2 FIXED — C6 KILLED (greedy-fill test).
- D3 FIXED — K6, K7, K10 KILLED (exact-score test, hand-derived constants).
- D4 FIXED — K2 KILLED (k=-1 with 2 hits).
- D5 FIXED — O8, O15 KILLED; O14 KILLED 3/3 (fixed ids/createdAt, no uuid dependence).
- D6 FIXED (real bug) — N1, N2, N4, N5, N17 KILLED. Probes: P1 mismatch -> HermesNotFoundError "Pointer for programming belongs to ceo"; P1b (no own row) -> same; P1c legit activate v2 then v3 -> returns v2 then v3 (cross-version activation intact); P1d cross-agent -> HermesAccessError.
- D7 FIXED — V1, V3, V8 KILLED.
- D8 FIXED — V10 KILLED; P2 -> HermesNotFoundError "Profile iot v4 missing".
- D9 FIXED as behavior (real bug) — N6, N7, N9, N13 KILLED 3/3. P3 concurrent ensure with n = 2/5/10/20: 0 rejected, 1 distinct returned name == the stored row's name, 1 row, 1 pointer. P3b mixed v1/v2 seeds x4: all fulfilled, 2 rows, pointer stays at the first inserted version. Versioning file run 30/30 green (not flaky). **But the error-discrimination half of the fix is untested — see D10.**
- P4 concurrent createProfileVersion x3: [E11000, ok, E11000], 1 row (accepted, reported).

## New-defect hunt
- The D9 catch does NOT swallow non-duplicate errors in the current code. Probes X2 (error code 64 with a row present) and X3 (plain Error) both rethrow the original error.
- Duplicate on the `{agentId, version}` index under a different _id (P3d / X1) rethrows E11000 and writes no pointer. Correct.
- After E11000 with different fields, the loser returns the stored (winner's) row and nothing is overwritten (P3: distinct names = 1 = stored).
- A corrupt existing row throws ZodError (P3c), not overwritten.
- No vacuous tests found. All new assertions are awaited, and the winner/name comparisons fail when there is no winner or the stored row is null.

## Defects
D10 store.ts:33-37,205-208 — UNOBSERVABLE GUARD (blocks confirmed). The error discrimination in `insertProfileIfMissing` has no test, so N8, N10, N11 and N12 survive. If a refactor regresses it, two things can happen silently: (a) a genuine write failure (network, write-concern, validation) is reported as a successful seed, then a pointer is upserted to a row that does not exist, and the next boot's getProfile fails with NotFound; (b) a duplicate on `{agentId, version}` under a foreign _id is reported as success. Either way the seed "succeeds" while data is missing.
  Reproduction: apply N12 (`if (!isDuplicateKeyError(error)) return HermesProfileSchema.parse({ ...fields, id });`) and `bun test packages/hermes` still shows 110 pass.
  Test-first fix (Quick, <1h, tests only; the current source already passes): add to store.versioning.test.ts
  1. raw-insert `{_id:'other', agentId:'programming', version:1, ...}` then `ensureProfileVersion(v1)` -> rejects `{code: 11000}` and pointer count 0 (kills N10, N11);
  2. `spyOn(models.Profile,'create').mockImplementationOnce` that raw-inserts the row and throws `{code:64}` -> `rejects.toBe(thatError)` (kills N8);
  3. spy throwing a plain `Error('network')` -> `rejects.toBe(it)` (kills N12).
  Verified: /tmp/opencode/orc06b/extra.test.ts (exactly these 3 tests) passes on the current source and kills N8 (X2), N10 (X1), N11 (X1) and N12 (X2, X3).

## Accepted / not defects
K18; the agentId/version mapper fields pinned by the query filter; R-ptr agentId (subsumed by the D6 guard); V7', N3, N15 (equivalent, argued above); P4 raw E11000; code-point token estimate.

## Verdict rationale
All of D1-D9 are fixed and proven by behavior-level kills, and both real bugs (D6, D9) are fixed in behavior with no new behavior bug. One new unobservable guard remains in the D9 fix itself (D10: 4 non-equivalent survivors). Under the task rules an unobservable guard blocks confirmation.

VERDICT: rejected
