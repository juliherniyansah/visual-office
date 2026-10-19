# F1 — Plan Compliance Audit (mvp3-integration)

Auditor: F1 (read-only). Date: 2026-10-18. Source of truth: `.omo/plans/mvp3-integration.md` (297 lines) vs files on disk.
Read-only commands only (`git status/diff/log/check-ignore/ls-files`, `md5sum`, `ls`, grep). Meshy balance checked: 3748 credits.

## Per-todo table

| Todo | Clause | Evidence (opened) | Verdict |
|---|---|---|---|
| 1 | export_hq.py exists, argparse, never saves .blend | `apps/assets/blender/export_hq.py` (L3 "NEVER saves", L72 `--inject-missing-exclusions`); `hq_v04.blend` not in `git status`, mtime 07:20 < export 17:42 | PASS |
| 1 | Facade allowlist anchored `door_f\d+_[nswe]$`; door_f1_meeting in floor_1, not shell | export_hq.py L32, L328-346; task-1-export-happy.txt "CHECK PASS floor_1 contains door_f1_meeting", "hq_shell excludes door_f1_meeting" | PASS |
| 1 | Exclusion list (9 collections + CHAR_BASE_stage) | export_hq.py L40-50; failure log flags CHAR_BASE_stage leak under inject | PASS |
| 1 | Prune actions except idle; ACTIONS mode; exactly 1 `idle` | export_hq.py L190-200, L236; happy log "char_base exactly 1 animation 'idle'" | PASS |
| 1 | Transform apply only single-user; bbox 1e-4 invariant | export_hq.py L54, L143-151, L168-180; happy log L5 applied=112 skipped_shared=1505, L9 "bbox invariant 1618 meshes within 0.0001" | PASS |
| 1 | Self-check counts from .blend, footprint, mesh-sharing log | happy log L4 footprint 20x14, MESH_SHARING lines, `EXPORT_SELF_CHECK OK all outputs` | PASS |
| 1 | 6 staging GLB; negative hook EXIT≠0 | `apps/assets/models/export/*_src.glb` (6 files); task-1-export-failure.txt "SELF_CHECK FAILED: 2 failure(s)" | PASS |
| 2 | @gltf-transform/cli root devDep only | `git diff package.json` (+1 line root devDeps); no apps/web package.json change | PASS |
| 2 | ktx preflight | task-2-preflight-smoke.txt "ktx version: v4.4.2, MODE=ktx2" | PASS |
| 2 | dedup→instance --min 9 (floors only)→meshopt→uastc slots/--level 2 --rdo→etc1s 255; resize only >2048; no prune/weld/simplify; optimize.sh untouched | optimize-hq.sh L168-201; happy log L12 "[hq_shell:instance] skipped"; `git status` optimize.sh clean | PASS |
| 2 | Post-verify: extensions, instancing only floors, tris 0.00%, char 19499, max tex 2048, ALL PASS | task-2-optimize-happy.txt L183-190 | PASS |
| 2 | basis_transcoder.wasm present | `apps/web/public/basis/basis_transcoder.{js,wasm}` | PASS |
| 2 | Failure scenario textureless → skip EXIT 0 | task-2-optimize-failure.txt "SKIP: no textures (EXIT 0)" | PASS |
| 3 | Table 6 rows + draw-call formula + nodes.ts real-file verify | task-3-glb-table.md (formula, 6 rows, real floor_1 assertions PASS) | PASS |
| 3 | CHECKPOINT-3-APPROVED.md with table + **verbatim user quote** + timestamp | CHECKPOINT-3-APPROVED.md: table + timestamp present; "Approved by: user (checkpoint question via orchestrator)" — **no verbatim quote** of the user's reply | **FAIL** |
| 4 | Staging dir ignored | `git check-ignore -v apps/assets/models/export/x.glb` → .gitignore:22 | PASS |
| 4 | AC: "`git check-ignore -v` match untuk file >10 MB" | `hq_shell.glb` = 12.8 MB; `git check-ignore -v apps/web/public/models/hq_shell.glb` → exit 1 (no match). `.gitignore` only has comment "ignored by explicit name when they appear" with no entry. task-4-gitignore.txt never tested hq_shell.glb | **FAIL** (disclosed in HANDOFF, but AC text literally requires it; not a user-accepted caveat) |
| 4 | Small files not ignored | floor_*/char_base not ignored (check-ignore no match) | PASS |
| 5 | nodes.ts 4 named exports, strict, no any | `nodes.ts` L3,13,26,34 | PASS |
| 5 | bun test EXIT 0 | task-5-nodes-test.txt "5 pass 0 fail" | PASS |
| 6 | KTX2 from `three/addons/loaders/KTX2Loader.js`, created in component via useMemo(gl), extendLoader, useDraco=false, meshopt=true | `useHqGltf.ts` L6, L16-25 | PASS |
| 6 | HqShell cutaway wall/window/door `_f{n}_`, restore others, console.debug, no material override | `HqShell.tsx` L11-37 | PASS |
| 6 | FloorModel hide COL_, dispose geometry/material/textures then useGLTF.clear | `FloorModel.tsx` L11-42 | PASS |
| 6 | Default floor 1, FLOOR_HEIGHT 3.2, camera [14,12,18], preload in-component (shell+floor_1 only) | `OfficeCanvas.tsx` L23-40, L59; `constants.ts` L3 | PASS |
| 6 | Scene renders HqShell + Suspense FloorModel; Building/BUILDING_MODEL_URL gone | `Scene.tsx`; Building.tsx deleted (git status D); grep BUILDING_MODEL_URL apps/web = 0 | PASS |
| 6 | Network AC + `?nocut=1` diff | task-6-loader-network.txt 10/10 PASS; task-6-cutaway-diff.png exists (138 KB) | PASS |
| 7 | Lighting values, ambientLight removed | `Lighting.tsx` via task-7-lighting.txt grep (L6, L9-21); HANDOFF matches | PASS |
| 8 | FloorPlane/DeskMarkers/Agent deleted; refs 0; deskLayout kept | git status D ×3; grep apps/web/src+e2e = 0 hits; task-8-cleanup.txt | PASS |
| 9 | CharAgent: useHqGltf, useAnimations idle+fallback names[0], spawn via NAV_spawn_lobby from FloorModel scene, castShadow, `__hqChar` declare global | `CharAgent.tsx` L11-73; `FloorModel.tsx` L47-50 | PASS |
| 9 | AC 3 assertions (pos <0.5 m, anim diff >0, console clean) | task-9-char-happy/position.txt (0.0000 m), animation.txt (185 px), console.txt | PASS |
| 9 | QA failure scenario evidence `task-9-char-fallback.txt` | file **absent** (`ls` → No such file) | **FAIL** (minor; code path exists, scenario never evidenced) |
| 10 | PerfProbe, declare global `__hqStats`, max per 1 s window, no stats dep | `PerfProbe.tsx` L7-56 | PASS |
| 10 | AC table 4 floors, calls/tris >0 | task-10-stats-per-floor.md (F1-F4 all >0) | PASS (caveat (a) sample-equality accepted at checkpoint 11) |
| 11 | EVIDENCE_DIR mvp3; AGENT_TITLE_ANCHOR removed; waitForResponse before goto/click; F1 substring anchor (no exact); request collector; floor_3/4 never | `dashboard-office.e2e.ts` L8-10, L56-69, L84, L96-117; grep AGENT_TITLE_ANCHOR = 0 | PASS |
| 11 | maxDiffPixelRatio not loosened; PW_NEG kept | spec L137, L140 `0.01` (only per-assertion timeout added, disclosed) | PASS |
| 11 | Regen with --output pw-output; 2 normal runs pass; md5 recorded | task-11-e2e-regen.txt, task-11-e2e-pass.txt RUN1/2 EXIT 0; `md5sum` baseline = 4816ac7234930a6aea5e65856c2e759e | PASS |
| 11 | AC "PW_NEG gagal di toHaveScreenshot" | task-11-e2e-negative.txt: proof used a temp spec with **`.not.toHaveScreenshot`** vs baseline copy, NOT `PW_NEG=1` on the real spec. That proves screenshots match, not that the comparator detects an inverted canvas. PW_NEG path never executed | **FAIL** |
| 11 | Old building.glb/character.glb deleted, refs 0 | git status D ×2; grep apps/web/src+e2e = 0 | PASS (deletion unstaged by no-commit rule) |
| 11 | CHECKPOINT-11-APPROVED.md quote "setuju lanjutkan" | CHECKPOINT-11-APPROVED.md | PASS |
| 12 | typecheck EXIT 0; biome 0 new errors | task-12-typecheck-lint.txt EXIT=0 both; 3 new warnings (caveat c) | PASS |
| 13 | Section at end, 3 sub-parts + table, required items (regen + ktx, GLB table, nodes.ts signatures + real verify, /basis/, three/addons KTX2, cutaway prefixes, dispose/re-fetch, md5, no-Meshy, cap 2048 + veto, limitations) | `docs/mvp/HANDOFF.md` L130-186 (last `##`); signatures match nodes.ts; KTX2 path matches useHqGltf.ts L6; cutaway matches HqShell.tsx; md5 matches; Meshy 3748 matches live balance | PASS |

## Must-NOT checks

| Clause | Evidence | Verdict |
|---|---|---|
| No decimate/weld/prune/simplify | optimize-hq.sh grep; tris delta 0.00% all files | PASS |
| No downscale below 2048 | max tex 2048 all 6 | PASS |
| hq_v04.blend not re-saved | not in git status | PASS |
| apps/api, packages untouched | `git status --short apps/api packages` empty | PASS |
| No commit/push | HEAD `99a0f67 chore(omo): sinkronkan state sesi terakhir` (pre-MVP-3); all MVP-3 work unstaged/untracked | PASS |
| No Meshy spend | balance 3748 == HANDOFF MVP-2 end | PASS |
| No new web runtime dep | only root package.json devDep diff | PASS |
| No three-stdlib import | only comment in useHqGltf.ts L8 | PASS |
| No CDN transcoder; useDraco false | useHqGltf.ts L23, setTranscoderPath('/basis/') | PASS |
| No day-night/FPV/task board | not present in touched files | PASS |

## Success criteria IS-1..IS-8

| IS | Evidence file exists | Verdict |
|---|---|---|
| IS-1 | task-6-cutaway-diff.png, task-11-e2e-pass.txt | PASS |
| IS-2 | task-2-optimize-happy.txt, task-3-glb-table.md, CHECKPOINT-11-APPROVED.md | PASS |
| IS-3 | task-9-char-happy/ | PASS |
| IS-4 | task-11-e2e-pass.txt, task-10-stats-per-floor.md | PASS |
| IS-5 | task-2-optimize-happy.txt, task-6-loader-network.txt (hid 20 COL_) | PASS |
| IS-6 | task-10-stats-per-floor.md | PASS (caveat a) |
| IS-7 | task-12-typecheck-lint.txt | PASS |
| IS-8 | task-5-nodes-test.txt, task-3-glb-table.md | PASS |

## Adversarial HANDOFF checks
All checked claims matched source: nodes.ts signatures; KTX2 import path; cutaway prefixes `{wall,window,door}_f{n}_` for all 4 floors with active hidden; `?nocut` via URLSearchParams; dispose then clear; md5; Meshy 3748; `.gitignore` finding self-disclosed. No false claim found.

## Shortfalls (REJECT reasons)
1. Todo 4 — `.gitignore` / `apps/web/public/models/hq_shell.glb` (12.8 MB): AC "git check-ignore -v match untuk file >10 MB" fails (exit 1). Fix: add `apps/web/public/models/hq_shell.glb` to `.gitignore` (or get explicit user decision to track it, recorded).
2. Todo 3 — `.omo/evidence/mvp3-integration/CHECKPOINT-3-APPROVED.md`: plan requires "kutipan verbatim balasan user"; file has none. Fix: add the user's verbatim reply.
3. Todo 11 — `task-11-e2e-negative.txt`: AC "PW_NEG gagal di toHaveScreenshot" not executed; substitute `.not.toHaveScreenshot` temp-spec proves equality, not detection. Fix: run `PW_NEG=1` on real spec, capture expected FAIL.
4. Todo 9 — `task-9-char-fallback.txt` absent (QA failure scenario). Minor.

VERDICT: REJECT
