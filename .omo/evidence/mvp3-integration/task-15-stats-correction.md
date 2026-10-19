# Todo 15 — Stats correction evidence

Source of truth: `.omo/evidence/mvp3-integration/final-wave/F3-manual-qa/results.json` (S1, S2, S4). Validated values: F1 (with CharAgent) 568 / 576,326; F1 re-check 303 / 364,045; F2 296 / 380,033; F3 305 / 388,681; F4 307 / 391,679; FPS 0-4 INFO.

## Changed files (old -> new)
| File | Change |
|---|---|
| `task-10-stats-per-floor.md` | Rewritten. Header correction note, method line, 5-row table (F1 with char, F1 re-check, F2, F3, F4), raw JSON replaced by new samples, "Superseded data" section keeps old values (F1 627/583,228; F2 301/325,047; F3 296/380,033; F4 307/391,679) marked SUPERSEDED. |
| `task-11-checkpoint/README.md` | Only the "Stats per floor" section replaced (table + caveat paragraph). Old caveat "Caveat (accepted at approval) ... coincidence" -> "Correction of the earlier caveat" (old rows stale, old F3 row = real F2, spec asserts only calls>0 && triangles>0, unchanged, probe sample not reliable). Other sections untouched. |
| `docs/mvp/HANDOFF.md` (MVP-3 section only) | Table rows floor_1..4: `627 / 583.228 / 3` -> `568 / 576.326 / 0-4 INFO` (+ re-check `303 / 364.045`); `301 / 325.047 / 4` -> `296 / 380.033 / 0-4 INFO`; `296 / 380.033 / 2` -> `305 / 388.681 / 0-4 INFO`; `307 / 391.679 / 1` -> `307 / 391.679 / 0-4 INFO`. "Catatan angka renderer" caveat rewritten as correction (valid re-measure, old values superseded, F3 old row = F2, spec probe not reliable). "Untuk MVP-4" `__hqStats` caveat -> wait for `floorId` match + floor GLB response + ~3 s settle, then two samples. "Stats per lantai" limitation line -> points to corrected table, FPS 0-4. |
| `task-13-handoff.md` | Same sentences/rows patched (plus checklist row 3 label: "probe-equals-F3 caveat" -> "angka dikoreksi oleh F3 re-measure (2026-10-18)"). |
| `CHECKPOINT-11-APPROVED.md` | Appended `## Resolution (final wave, 2026-10-18)`; existing text untouched. |
| `.omo/notepads/mvp3-integration/learnings.md` | One line appended. |

## Verification
- `git diff --numstat -- docs/mvp/HANDOFF.md` -> `58 0` (0 deletions); `git diff -- docs/mvp/HANDOFF.md | grep -c '^-[^-]'` -> 0.
- Lines 1..130 of HANDOFF.md byte-identical to pre-edit copy (`diff` of `head -130`: PREFIX_OK).
- `grep -rn "296 / 380|296/380|296 calls|380.033|380,033"` over the four files reports only: F2 rows (valid), the "Superseded data" row (task-10), the labelled superseded old-value list (README correction paragraph), and HANDOFF/task-13 paragraph that lists old values explicitly as SUPERSEDED.
- `grep -riE "suspend|coincidence|belum terverifikasi selesai|sampel F1 spec = baris F3|probe-equals|suspect|caveat sampel"` over the four files -> no matches.
