# F1 — Plan compliance audit (mvp-2-blender-lab)

Auditor: F1 (read-only; only this file written). Date 2026-10-18.

| todo | criterion | result | evidence |
|---|---|---|---|
| 1 | review ends RESULT: PASS, 17 `equal? yes` rows | PASS | 01-guide-review.md |
| 1 | `| 19 |` in guide.md = 1; html parses; `8.000 tris` = 0 / `Low-poly flat-shaded ala bruno` = 0 in md+html | PASS | re-run grep + html.parser (exit 0) |
| 2 | files 00,00b,00d,00e,02,02b,03,03b,ledger exist; kit/ + renders/ dirs | PASS | ls |
| 2 | BLENDER_EEVEE ≥1; 02b dict ≥15 keys | PASS (1; 15 keys) | 02-blender-version.txt, 02b-api-probe.txt |
| 3 | build EXIT=0 SELF_CHECK OK; 10b == 10 (185 obj / 2550 tris) | PASS | 10, 10b, 10c |
| 3 | negative EXIT≠0 + AssertionError | PASS (EXIT=1) | 12-selfcheck-negative.txt |
| 3 | ast parse 3 files; `__main__` guard =1, `^main(` =0; each ≤500 LOC | PASS (max 496 hq_kit_room.py) | re-run |
| 4 | 13 EXIT=0 SELF_CHECK OK | PASS | 13-build-t4.txt |
| 4 | 14-names non-empty, all 24 required exactly once | PASS (NAMES_ASSERT OK) | 14-names.txt; nav negative 15 EXIT=1 |
| 5 | furniture test EXIT=0 FURNITURE OK; break-desk negative EXIT≠0 | PASS | 16, 17-furniture-negative.txt |
| 6 | RENDER OK + STATS iso; PNG 1280x720; unknown view EXIT=2 | PASS | 18-render-smoke.txt, `file`, 19-render-negative.txt |
| 7 | both style refs non-empty; REF_KIT/REF_CHAR ids =1 each; ledger rows 1-2 reconcile, 12 ≤ 24 | PASS | PROMPTS.md, meshy-ledger.md |
| 8 | hq_v01.blend; 4 PNG 1280x720; QA 15 PASS 0 FAIL; build EXIT=0; repro diff empty, 24a non-empty; FURNITURE_STUB=0; 24c md5 | PASS | 20, 22-qa-v01.md, 24, 24a, 24c |
| 9 | checkpoint 2a approval + IMAGE_MODEL_CONFIRMED | PASS (USER_APPROVED_2A =1, nano-banana-2) | 25-checkpoint-2a.md |
| 10 | 4 KIT_*.glb >10 KB; rows = files; kit gens ≤6 (6); ledger ≤ cap; 31 listing | PASS | 30-kit-tasks.md, 31-kit-files.txt |
| 11 | NORMALIZE OK dims [1.0,0.15,3.2], z_min 0, EXIT=0 | PASS | 32-normalize-test.txt (+33 negative) |
| 12 | hq_v02.blend; v01 md5 unchanged (43); 43b; 3 PNG with STATS; QA both-rooms-framed + kit-floor-visible PASS; metrics 4 pieces + 2 rooms; build EXIT=0 | PASS | 40, 40a, 40b, 41, 42, 43, 43b |
| 12 | hide_render not leaked in v02 save | PASS (re-run now: all False, EXIT=0) | live blender check |
| 13 | USER_APPROVED_2B = 1 | PASS | 45-checkpoint-2b.md |
| 14 | char_base_raw.glb; ≤3 generations (2 preview + 1 refine) | PASS | 51-char-tasks.md |
| 15 | hq_v03.blend; build EXIT=0 SELF_CHECK OK; 3 PNG STATS; 53 rows filled; 51b exists | PASS | 52, 52a, 53, 51b-idle-lookup.json |
| 16 | USER_APPROVED_2C = 1 | PASS | 55-checkpoint-2c.md |
| 17 | hq_v04_verdict.png exists (1280x720) | PASS | renders/ |
| 17 | 60b frozen md5 == 24c/43b/54 | PASS | 60b-frozen-md5.txt |
| 17 | analysis sections a-g + Recommendation | PASS | 60-verdict-analysis.md |
| 17 | verbatim reply + `VERDICT: level=2 furniture=meshy` + USER_APPROVED_CAP_450 | PASS | 61-verdict-answer.md |
| 17b | 5 GLB in kit_v2/ (wall, window, door, floor, pillar) | PASS | ls kit_v2 |
| 17b | ledger reconciles row by row | PASS (39 rows, 0 mismatch, 0 chain breaks) | meshy-ledger.md |
| 17b | meshy2 build EXIT=0 SELF_CHECK OK (CHECK_KIT_V2 present) | PASS (1794 obj, 1,127,156 tris) | 65-build-v04-kit2.txt |
| 17b | fallback `--kit-source bpy` EXIT=0 | PASS | 65b-build-bpy-fallback.txt |
| 17b | frozen md5 v01-v03 unchanged; regression green | PASS | 65c-regression.txt, live md5sum |
| 17b | renders read, QA rows PASS | PASS | 64-qa-kit2.md (RESULT: PASS) |
| 18 | review RESULT: PASS; `| 20 |` = 1; html parses | PASS | 63-guide-review.md, re-run |
| 18 | L2 switch: `--kit-source` (bpy/meshy/meshy2) in build_hq.py; L2 build + fallback EXIT=0 | PASS via deviation (see notes) | build_hq.py:62-66, 65, 65b |
| 19 | handoff review RESULT: PASS; `## MVP-2` = 1; no forbidden paths in status diff; protected sha identical | PASS | 72, HANDOFF.md, 71-status-diff.txt, 00e vs 71b |

## Global gates
- Checkpoint tokens exact: USER_APPROVED_2A (25), USER_APPROVED_2B (45), USER_APPROVED_2C (55) — each count 1. PASS.
- Meshy spend: ledger sum 352 = 4100 − 3748; live `meshy_check_balance` = 3748. Within cap 450. PASS.
- Frozen md5 (live): hq_v01 29a9335853af9bc029aea4eb88445110, hq_v02 559159834244a82a3d996a783675774a, hq_v03 8845bc7eadbbb6566f66ece44ea8a837 — match. hq_v04 edc83c06afbc3e2b416e08947931bbf6 = 65d. PASS.

## Notes / accepted deviations
1. Credit cap 300 → 450 (USER_APPROVED_CAP_450 in 61). Todos 10/14/15 "ledger ≤ 300" held at their time; final 352 ≤ 450.
2. Kit source: user chose kit v2 `--kit-source meshy2` on ALL floors (todo 17b, orchestrator-added on user request) instead of plan's `--kit-source meshy` on Floor 1. `meshy` accepted by argparse but has no own branch.
3. `grep -c kit_source apps/assets/blender/hq_floor1.py` = 0 (switch lives in build_hq.py); `62-build-v04-L2.txt` absent — L2 build evidence is 65 / 65b. Covered by deviation 4.
4. Todo 18 script part done inside 17b.
5. hq_v04.blend + VERDICT_STAGE overwritten by kit2 build (pre-L2 md5 143be116… backup /tmp); pre-L2 verdict PNG kept.
6. Perf flag: 1.13M tris in v04 (under 1.5M build budget; far above web budget) — carried to MVP-3, not an MVP-2 gate.

RESULT: PASS
