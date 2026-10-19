# CHECKPOINT 11 — APPROVED

## Approval
- Approver: user
- Quote: "setuju lanjutkan"
- Date: 2026-10-18
- Scope: checkpoint package `.omo/evidence/mvp3-integration/task-11-checkpoint/` (screenshots dashboard-f1/f2/nocut, per-floor stats table, baseline md5, delta EEVEE-vs-WebGL)

## Gates Passed Before Approval
- Spec e2e `apps/web/e2e/dashboard-office.e2e.ts` updated: regen clean, 2 normal runs PASS (`task-11-e2e-pass.txt`).
- Negative test: reversed assertion fails correctly (`task-11-e2e-negative.txt`).
- New baseline md5: `4816ac7234930a6aea5e65856c2e759e` (`dashboard-office-linux.png`).
- Legacy GLBs `building.glb` + `character.glb` deleted; zero references remain.
- `bunx tsc --noEmit` (apps/web) exit 0.

## Open Notes (accepted at approval time)
- Per-floor stats table in `task-10-stats-per-floor.md` suspect (F2–F4 rows likely shell-only samples: F1 spec sample 296 calls / 380033 tris == F3 row). Stats re-capture fix is in progress post-approval; checkpoint README table to be updated with the corrected numbers.
- Camera default framing crops building at right edge; background black above horizon vs Blender green. Accepted as-is by user.

## Resolution (final wave, 2026-10-18)
- The open stats note above is resolved. Final-wave F3 re-measured the per-floor stats with proper waits (`waitForResponse(floor_N.glb)` + settle, two stable samples 1.5 s apart).
- Corrected values are in `task-10-stats-per-floor.md` (source: `final-wave/F3-manual-qa/results.json`): F1 568 / 576,326 (with CharAgent) and 303 / 364,045 (re-check); F2 296 / 380,033; F3 305 / 388,681; F4 307 / 391,679.
- The old rows (F1 627/583,228; F2 301/325,047; F3 296/380,033; F4 307/391,679) were stale/shell-only and are superseded. The checkpoint README table and `docs/mvp/HANDOFF.md` MVP-3 section carry the corrected numbers.
