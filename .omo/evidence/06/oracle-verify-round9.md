# T6 Hermes — Independent Adversarial Verification, Round 9

VERDICT: rejected

Date: 2026-10-10. Method: sequential in-place mutation testing (one exact-match replacement per mutant, `bun test packages/hermes`, 120 s timeout, restore in `finally` + sha256 assert against pre.sha). Runner: /tmp/opencode/orc06i/{mutants.py,run.py}. Full log: `.omo/evidence/06/oracle-round9-mutants.log`.

## 1. Baseline
- All 25 files under packages/hermes/{src,seed}: sha256 recorded. Production hashes matched the expected values (store dbc54590…, models 169e225a…, context 85059f06…, seed 0effb3d5…, tokens fe0e0a94…, index 1d80824d…, knowledge fe66232917d4721…, errors 97743c3c…). apps/api/src/db/mappers.ts d413bd8c… untouched.
- Control run: 175 pass / 0 fail.

## 2. Counts
| Metric | Value |
|---|---|
| Mutants generated | 339 (all 8 production files + 7 seed JSON) |
| Invalid (pattern/compile) | 0 |
| Valid | 339 |
| Killed | 286 |
| Survived | 53 |
| Equivalent | 28 |
| REAL GAP | 25 |
| Timeouts | 0 |

Per file, valid/survived: store.ts 101/7, context.ts 63/1, knowledge.ts 48/5, models.ts 28/16, seed.ts 11/1, errors.ts 7/2, tokens.ts 6/0, index.ts 9/0, seed/*.json 66/21.

Note on runner: the first runner process was killed by the shell timeout while running M018. store.ts was left mutated and was restored manually with the inverse replacement (sha256 verified). The run then resumed from M018 in a detached process. M001–M017 results come from run_part1, which is included in the log.

## 3. REAL GAPS (25)
Each gap is reproduced through the public API by /tmp/opencode/orc06i/probe.ts. That script runs original vs mutant in its own `redhunter_test_probe_*` DB and drops it afterwards.

| ID | File:line | Mutation | Observable effect (probe) | Suggested test |
|---|---|---|---|---|
| M215 | knowledge.ts:103 | `score +=` -> `score =` (only the last matched query term counts) | `search('apple cherry')` on the 3-doc BM25 corpus: original `b 0.9568, c 0.562, a 0.4901`; mutant `c 0.562, a 0.4901, b 0.3902`, so both ranking and scores change | Add an exact-score case for a multi-term query: score(b) = Σ over terms of idf·tf-part, with `toBeCloseTo` |
| M223 | knowledge.ts:115-117 | `.find({})` -> `.find({ tags: { $ne: [] } })` | Hydrating rows `{x, tags: []}` and `{y, tags: ['t']}` gives original `2 / size 2` but mutant `1 / size 1`. Every hydrate test fixture has non-empty tags | In the hydrate test, include a row with `tags: []` and assert it is counted and searchable |
| M002 | store.ts:28 | ProfilePointerSchema `activeVersion: z.number().int().positive()` -> drop `.int()` | Pointer row `activeVersion: 1.5` gives original `ZodError` but mutant `HermesNotFoundError`, so the error class differs | Next to the existing "activeVersion 0 throws ZodError" test, add a fractional `1.5` case that expects ZodError |
| M018 | store.ts:55 | `{ ...fields, id: _id }` -> `{ id: _id, ...fields }` | A corrupt profile row carrying a stray `id: 'hermes-ceo-v1'` under `_id hermes-iot-v1` makes `getProfile('iot','iot').id` return `hermes-iot-v1` originally but `hermes-ceo-v1` in the mutant. Rows are documented as untrusted (store.ts:52) | Insert a raw row with a stray `id` field and assert the returned id equals `_id` |
| M326–M339 (14) | seed/{ceo,coo,cto,programming,game,iot,ai_development}.json `personalityTraits[1]`, `[2]` | Change the 2nd or 3rd trait (e.g. `"decisive"` -> `"decisivex"`) | Visible in `getProfile` and in the `Traits:` line of assembleContext's profile block. seed.test.ts pins only `personalityTraits[0]` | Pin the full seed objects: `expect(SEED_PROFILES).toEqual([...7 literal objects])`, or pin the full traits arrays |
| M289, M295, M301, M307, M313, M319, M325 (7) | seed/*.json `voiceGuidelines` | Prefix `"X"` to voiceGuidelines | Visible in the `Voice:` line of the context. Tests assert only `length > 0` | Covered by the same full-object pin |

The seed gaps (21) apply the same standard Round 8 used for E06–E12 (names). The names were fixed, but traits[1..2] and voiceGuidelines are still not pinned.

## 4. EQUIVALENT (28)
| ID | File:line | Mutation | Reason |
|---|---|---|---|
| M019 | store.ts:62 | remove `instanceof Date` guard | Accepted (R8 S34). `toISOString` on a non-Date throws anyway, and every write goes through the Date-typed mongoose schema |
| M032 | store.ts:90 | drop `ProfileInputSchema.parse` | Accepted (redundant parse). `HermesProfileSchema.parse` at line 95 validates the same fields |
| M062 | store.ts:154 | create memory with `createdAt` ISO string | The mongoose `Date` schema casts the string to an identical Date, so the stored value is the same |
| M074 | store.ts:175 | remove empty-tags guard | Accepted (R8 S19). `$in: []` matches nothing |
| M088 | store.ts:201 | remove existing-row pre-check | Accepted (R8 S30). The E11000 path returns the stored row |
| M147 | context.ts:136 | drop `budget < 0` | Every profile has `tokens >= 0 > budget` (the profile text is non-empty), so line 144 still throws HermesBudgetError. Only the message differs. Same family as the accepted "budget < -1 still throws" |
| M179 | knowledge.ts:43 | store `doc` without clone | `doc` is already a fresh object from `KnowledgeDocSchema.parse` (zod returns new objects and arrays), and `search` clones on output, so no aliasing is observable |
| M188 | knowledge.ts:65 | drop `queryTerms.length === 0` | Accepted family (early return). An empty query scores 0 for every doc, and `score > 0` filters them all out, giving `[]` |
| M209 | knowledge.ts:88 | drop `a === b` in compareIds | The ids are unique Map keys, so equal ids never get compared |
| M257 | seed.ts:21 | `raw as ProfileVersion` (no parse) | The seed JSON is static and valid, so output is identical. `ensureProfileVersion` re-parses anyway |
| M229, M230, M232, M235, M236, M238, M244, M246 | models.ts | remove enum/required/min validators | Accepted (R8 M07–M13). Zod validates every write and read |
| M231, M241, M242, M245 | models.ts | change or remove `default` on voiceGuidelines, markdown, appliesToRoles, lessons | Zod requires these fields on every write, so the default never applies |
| M240, M243, M247 | models.ts | remove the memory, skill, and experience indexes | Performance only |
| M248 | models.ts:58 | remove `versionKey: false` | Accepted (R8 M14). `__v` is stripped by the zod object parse |
| M268, M269 | errors.ts | Budget extends TypeError; NotFound extends RangeError | Accepted (base-class variants). `instanceof Hermes*Error`, `name`, and `message` are unchanged |

## 5. Hands-on acceptance (/tmp/opencode/orc06i/handson.ts; own DB `redhunter_test_handson_1791627508076_f808aba6`, dropped)
- a) `seedProfiles` returned 7 (7 rows). There were 6 `programming` memories plus 1 `ceo` memory. `assembleContext('programming', 'debug hermes store mongo memories', 400)` returned the Pip profile and 3 relevant memories (mongo/hermes/memories). No ceo, coffee, or lunch memories appeared. totalTokens 76 <= 400, and it equals the sum of the layers. PASS
- b) `ceo` returned profile `hermes-ceo-v1` (Cara) and only its own memory. `iot` returned `hermes-iot-v1` (Ivy) with no foreign blocks. PASS
- c) `getMemories`, `getProfile`, and `getExperience` across (programming,ceo), (ceo,programming), and (iot,cto) all threw HermesAccessError (9/9). PASS
- d) budget = profileTokens-1 (39) threw HermesBudgetError. budget = profileTokens kept only the profile, and the rest went to `dropped`. PASS
- e) `createProfileVersion` v2 followed by `seedProfiles` left the active version at v2 (Pip2), with 8 rows. PASS

## 6. Cleanup receipt
- `sha256sum -c pre.sha`: 25/25 OK (packages/hermes/src + seed byte-identical). mappers.ts d413bd8c… unchanged. The mtimes are newer because of the in-place mutate/restore, but the content is identical.
- `bun test packages/hermes`: 175 pass / 0 fail. `bun run typecheck`: 6/6 exit 0. `bunx biome check .`: 130 files, no issues.
- `.bak` count (`/usr/bin/find packages -name "*.bak" -not -path "*/node_modules/*" | wc -l`): 0
- `redhunter_test*` DBs: `[]`
- New repo files: only `.omo/evidence/06/oracle-verify-round9.md` and `.omo/evidence/06/oracle-round9-mutants.log`. Scratch files are only in /tmp/opencode/orc06i/.

## 7. Why rejected
25 observable survivors are not pinned by any test. The two most significant are M215 (multi-term BM25 accumulation is untested; the exact-score test uses a single-term query) and M223 (hydration of docs with empty tags is untested). The fix is small, about 5 assertions:
1. A full-object `toEqual` on SEED_PROFILES
2. An exact score for a multi-term query
3. A hydrate row with `tags: []`
4. A pointer with `activeVersion: 1.5` that expects ZodError
5. A profile row with a stray `id` field
