# CHECKPOINT 11 package - MVP-3 integration

Status: APPROVED by user 2026-10-18 (quote: "setuju lanjutkan"). See `../CHECKPOINT-11-APPROVED.md`.

## Screenshots (1280x800, SwiftShader, dark, produced by the e2e spec)
| File | What |
|---|---|
| `dashboard-f1.png` | First load, F1 selected, cutaway on (ground-floor facade hidden, lobby interior visible) |
| `dashboard-f2.png` | After clicking F2 (lazy-loaded floor_2.glb), camera moved to floor 2 |
| `dashboard-nocut.png` | `/dashboard?nocut=1`, full facade, cutaway disabled |

md5: f1 `c3c57338108046398d4a76810398598f`, f2 `e646d2a167cf8ef9a920ecd9d664a3a3`, nocut `9148abcf4bfa35553be3a772ddc408bf`
(f1 md5 is not stable across runs: idle animation frame differs; refreshed 2026-10-18 after F1 PW_NEG run)

## Stats per floor (corrected 2026-10-18 by final-wave F3 re-measure; see task-10-stats-per-floor.md; headless SwiftShader, FPS 0-4 INFO only)
Method: `waitForResponse(floor_N.glb)` + settle, two stable samples 1.5 s apart; source: `final-wave/F3-manual-qa/results.json` (S1, S2, S4).

| Floor | Calls | Triangles | FPS | Notes |
|-------|-------|-----------|-----|-------|
| F1 (with CharAgent, first sample after initial load) | 568 | 576,326 | 0-4 (SwiftShader, INFO) | Includes CharAgent |
| F1 re-check (without character, after round trip) | 303 | 364,045 | 0-4 (SwiftShader, INFO) | Same floor, no CharAgent |
| F2 | 296 | 380,033 | 0-4 (SwiftShader, INFO) | Shell ~561k tris accepted per decision #21 |
| F3 | 305 | 388,681 | 0-4 (SwiftShader, INFO) | Shell ~561k tris accepted per decision #21 |
| F4 | 307 | 391,679 | 0-4 (SwiftShader, INFO) | Shell ~561k tris accepted per decision #21 |

Spec probe sample (`task-11-hq-stats-run.json`, taken after F2->F1 round trip): floorId 1, calls 296, triangles 380033, fps 2.
Correction of the earlier caveat: the old table rows in this README (F1 627/583,228; F2 301/325,047; F3 296/380,033; F4 307/391,679) were stale/shell-only samples, taken before the target floor GLB finished loading, and are superseded. The old "F3" row was actually the floor 2 value, which is why the spec probe sample (296 / 380033) matched it. The spec only asserts `calls > 0 && triangles > 0` and was not changed, so its own probe sample (taken right after the round trip, before floor_1 finished reloading) is not a reliable measurement. Use the corrected table above.

Renderer (`task-11-renderer-run.txt`): ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)

## Blender EEVEE vs WebGL (observed by viewing the images)
References: `apps/assets/blender/renders/hq_v04_kit2_iso.png`, `apps/assets/blender/renders/hq_v04_kit2_lobby.png`
- Background: Blender shows green ground/sky world all around; web shows flat clear colour `#0a0a0a` (black) above the horizon.
- Camera: iso render frames the whole building centred with roof visible; web default camera is lower and the building sits right of centre, cropped by the right edge, with the floor selector overlapping the red sign.
- Lighting: Blender has soft, wide ambient and soft shadows; web uses hemisphere + one directional (shadow map PCF, PCFSoft removed in this three version) with ACES tone mapping, so contrast is flatter and shadows harder/less visible.
- Materials: Blender lobby shows terrazzo floor, translucent glass partitions with reflections; web shows the same textures (KTX2) but glass reads as pale blue panes with no reflections.
- Character: Blender lobby render has the man large in frame; web F1 shows him tiny near the stairs at default distance (CharAgent at (7,0,-6)).
- Roof: visible in iso render; not visible from web default camera.
- Floor 2 (`dashboard-f2.png`): shows floor slab and columns from outside; no furniture visible from this angle. Not verified whether furniture is occluded or missing, user should check.

## Gate evidence (all under `.omo/evidence/mvp3-integration/`)
- `task-11-e2e-regen.txt` - baseline regen, 2 passed
- `task-11-e2e-pass.txt` - RUN 1 and RUN 2, both EXIT=0, 2 passed each; baseline md5 and post-green records appended
- `task-11-e2e-negative.txt` - temp spec with `.not.toHaveScreenshot` against baseline copy: FAILED, NEG_EXIT=1 (temp spec deleted)
- Baseline md5 NEW `4816ac7234930a6aea5e65856c2e759e` (OLD `a273b6d34ea3689d65a817f6b125e15c`)
- Spec-written: `task-11-console-run.json`, `task-11-console-nocut-run.json`, `task-11-dashboard-run.png`, `task-11-renderer-run.txt`, `task-11-hq-stats-run.json`
- tsc `--noEmit` EXIT=0

## Cleanup done in this task
Old `building.glb` and `character.glb` removed (unstaged deletions, 0 references). 6 new GLBs and `basis/` untouched. Nothing committed.
