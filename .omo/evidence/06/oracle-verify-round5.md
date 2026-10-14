# Oracle verify round 5 — RH-HERMES-001 (packages/hermes)

Fresh verifier, scratch `/tmp/opencode/orc06e/`. Every mutant ran in scratch copies (`w0..w3`, node_modules symlinked). Production files were never edited, so no `.bak` files were created.

## Baseline
- Production sha256 matches the expected values (store dbc54590…, models 169e225a…, context 85059f06…, knowledge fe662329…, seed 0effb3d5…, tokens fe0e0a94…, errors 97743c3c…, index 1d80824d…, mappers d413bd8c…).
- `bun test packages/hermes`: 151 pass, 0 fail, 8 files. Typecheck 4/4 workspaces exit 0. `biome check .`: 129 files, clean.

## Mutation sweep (new set N001–N626; log: oracle-round5-mutants.log)
- 219 valid mutants: 216 first pass (3 had patterns with count 0), plus 3 corrected (N002b, N145b, N231b).
- 182 killed, 34 survived, 3 invalid (re-run as the corrected versions).
- 32 survivors are equivalent and map to classes already accepted:
  - N008=S48, N020=S34, N048=S49, N143=C14, N151=C44, N210=K16, N217=K03, N218=K04, N229=K21, N231b=K22, N235=K31, N506=E08.
  - N402/N403/N404: error supertype widening, same as R05.
  - N603/N604: pointer and version `min`. Zod parses on write and on read, same as O09.
  - N606=O03. N607/N608=O20/O21. N609=O04. N615/N616/N617=O08/O22/O23. N619/N620=O11 class. N622=O10. N625/N626=O24/O25 class.
  - N621/N623: mongoose `required` dropped, but zod requires runId and constitutionRef (min 1) before the write.
  - N061: dropping the `existing` short-circuit falls into create, which hits E11000 and returns the stored row. Same observable result.
- 2 survivors are non-equivalent; see D31 and D32 below.

## D22–D30 re-proof (oracle-round5-d22-d30.json)
A05 A07 A08 A21 A25 C78 T05 R01–R04 C71 I01–I08: all KILLED.

## Hands-on acceptance (throwaway test in scratch copy, deleted after)
All 8 tests pass:
- Seed has 7 profiles: ai_development Ada, ceo Cara, coo Otto, cto Tess, game Gale, iot Ivy, programming Pip.
- (a) Seeded `programming`: Pip profile plus the top-3 relevant memories in relevance order. The ceo memory is excluded. Total stays within budget at 500 and at profile+3.
- (b) Cross-agent getMemories, getProfile and getExperience throw HermesAccessError with 0 find/findOne/findById calls.
- (c) Budget: profile−1 throws HermesBudgetError, budget == profile is OK, and 1.5, NaN, Infinity and −1 throw HermesBudgetError.
- (d) TTL 10 s: live at +9999 ms, expired at +10000 ms.
- (e) 12 concurrent ensureProfileVersion calls: 1 profile row, 1 pointer, no E11000.

Plan T6 ACCEPTANCE is met in behavior.

## Constraints
- No new files under apps/, packages/shared or .omo/plans newer than production. No `@redhunter/hermes` import or Hermes route in apps/api.
- Dependencies are only @redhunter/shared, mongoose ~8.24.5 and zod. No mongodb-memory-server, vector DB or embeddings dependency.
- Only `.env.example` files exist; no `.env`.

## Defects

### D31 — store.ts:85 default clock not test-observable
- Mutant N074: `private readonly now: Clock = () => new Date(0)` survives.
- Every test that checks time injects a clock. seed.test uses the default but never checks timestamps.
- Production impact if broken: every memory gets createdAt at the epoch, every ttl memory is already expired, and recency ranking collapses.
- Test-first fix (store.test.ts): `new HermesStore(models)` (no clock) → addMemory → expect `Date.parse(createdAt)` ≥ `Date.now()` captured before the call. Do the same for an experience or profile row read back.
- Verified: this probe kills N074.

### D32 — context.ts:82 importance tiebreak kill is flaky
- Mutant N122 (delete the `b.memory.importance - a.memory.importance ||` line) was killed in 3 of 6 runs and survived in 3.
- Cause: in the "programming @2000" test, the 0-hit memories share createdAt (fixed clock T0), so their order falls to random-UUID id order. The round-3 C26 KILLED result was luck.
- Test-first fix (context.limits.test.ts, pure `rankMemories`): two memories with equal hits and equal createdAt, ids 'a' (importance 0.1) and 'b' (0.9) → expect ['b','a'].
- Verified: this probe kills N122 deterministically.

## Cleanup receipt
- Production sha256 pre == post (diff empty, recorded in /tmp/opencode/orc06e/sha-pre.txt).
- `*.bak` under packages/ and apps/: 0.
- `redhunter_test_*` DBs: [].
- Scratch test file deleted. Scratch copies are byte-identical to production (cmp).

VERDICT: rejected
