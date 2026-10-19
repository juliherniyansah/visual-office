
## Todo 1 — export_hq.py (verified 2026-10-18)
- Preflight numpy: `blender -b --factory-startup --python-use-system-env --python-exit-code 1 --python-expr "import numpy"` EXIT=0 (numpy 2.5.4 via PYTHONPATH=~/.local/lib/python3.14/site-packages). Without `--python-use-system-env` PYTHONPATH is ignored.
- Ground truth hq_v04: FLOOR_1=455 objs (facade 102), FLOOR_2/3=387 (facade 114), FLOOR_4=389 (facade 114 + roof_top + SIGN_redhunter), EXTERIOR=16, CHARACTERS=2, VERDICT_STAGE=49. Actions: `idle` (0.8-96.8f) + leftover `Armature|clip0|baselayer`.
- Selection-by-allowlist (EXTERIOR + FLOOR_N + CHARACTERS only) makes the mandatory exclusion list self-enforcing: KIT_BPY/KIT_MESHY(_V2)/CAMERAS/LIGHTING/FLOOR_1_KIT_TEST/KIT_TEST_CEILING/glTF_not_exported/VERDICT_STAGE never queried; CHAR_BASE_stage lives inside VERDICT_STAGE.
- Facade regex set: `^wall_f\d+_[nswe]`, `^window_f\d+_`, `^column_f\d+`, `^door_f\d+_[nswe]$`. `_glass` panes ride the window prefix; `wall_f1_meeting_*`/`door_f1_meeting`/`wall_stair_core` correctly excluded from shell.
- glTF exporter: 1 node per selected object for plain meshes/empties (node-name set == object-name set, verified). Skinned armature exports bones as nodes (char_base GLB = 26 nodes from 2 objects) — assert animations/named nodes, not node count, for char.
- Transform apply: only 112 of 1617 building meshes were single-user; 1505 skipped (shared link_duplicate). One batched `bpy.ops.object.transform_apply` call on the selection works headless. World-bbox invariant 1e-4 held across all 1618 meshes.
- Mesh-sharing evidence (for todo 2 instancing): floor_1 353 nodes/82 meshes, floor_2..4 273 nodes/6 meshes, shell 462 nodes/23 meshes, char 26 nodes/1 mesh.
- Negative hook `--inject-missing-exclusions`: +49 VERDICT_STAGE into shell -> SELF_CHECK FAILED 2 failures (leaked names + forbidden tile_*/meeting pattern), EXIT=1.
- 93 MB blend, 6 GLB export ~90 s headless; nohup+poll pattern required (120 s tool cap).

## Todo 5 — nodes.ts helper (2026-10-18)
- `Object3D.traverse` gives deterministic depth-first order; sufficient for stable prefix search.
- `nodeWorldPosition` uses `updateWorldMatrix(true, false)` then `setFromMatrixPosition(matrixWorld)` to avoid relying on renderer-side matrix updates.
- Bun test with `bun:test` + three works out of the box in apps/web ESM setup.

## Todo 2 — optimize-hq.sh (completed 2026-10-18)
- Preflight: KTX-Software v4.4.2 installed from GitHub release to `~/.local/ktx/KTX-Software-4.4.2-Linux-x86_64`; mode resolved to `ktx2`.
- Pipeline per file: `dedup` → `instance --min 9` (floors only) → `meshopt` → `uastc` (slots normal/occlusion/metallicRoughness, --level 2 --rdo, --resize 2048 when needed) → `etc1s --quality 255` → final `meshopt`. Final meshopt is required because `uastc`/`etc1s` decode the intermediate `EXT_meshopt_compression`.
- Texture cap: all files with kit textures had max 4096x4096, so `--resize 2048` applied to both uastc and etc1s; char_base texture was already 2048x2048, no resize.
- Instancing: floor_1 created 2 batches / 256 instances; floor_2..4 each 1 batch / 268 instances. Shell and char_base not instanced.
- Final sizes: hq_shell 12.84 MB (from 52.53 MB), floor_1 6.73 MB (from 44.67 MB), floor_2..4 3.90 MB each (from 34.31 MB), char_base 0.93 MB (from 3.81 MB).
- Verification all PASS: extensionsUsed include `KHR_texture_basisu` + `EXT_meshopt_compression` (ktx2), `EXT_mesh_gpu_instancing` only on floors with instance count >0, node prefixes identical to staging, tris preserved within 0.1%, char tris 19499 ±1%, max texture 2048x2048.
- Transcoder copied from `node_modules/.bun/three@0.186.1/node_modules/three/examples/jsm/libs/basis` to `apps/web/public/basis/`.
- Failure-path probe on textureless `building.glb` skipped uastc/etc1s and exited 0 as expected.
- `rtk` output compression mangled size tables; evidence sizes were written via Python `os.path.getsize` into the evidence file.

## Todo 4 — .gitignore for staging + large GLBs (2026-10-18)
- Added `apps/assets/models/export/` (full staging dir, regenerable via export_hq.py + optimize-hq.sh).
- No current final GLB in apps/web/public/models is >10 MB, so none are gitignored; documented the >10 MB rule in comments for explicit future names.
- Defensively added `apps/web/public/models/*_src.glb` to prevent source-style GLBs from being committed.
- Verification: `git check-ignore -v apps/assets/models/export/floor_1.glb` matches `.gitignore:22`; `apps/web/public/models/floor_1.glb` does NOT match; `apps/web/public/models/floor_1_src.glb` matches `.gitignore:26`.
- Legacy models `apps/web/public/models/building.glb` and `character.glb` remain tracked (to be deleted in todo 11).
- Fix: preflight recovery path called `find_ktx_dir` instead of `find_ktx_bin`; with `set -euo pipefail` this would silently downgrade to meshopt on a clean host after a successful KTX install.

## Task 3 — GLB table + nodes.ts real-file verification

- For compressed GLBs (EXT_meshopt_compression / KHR_mesh_quantization), JSON accessor counts are compressed; use the post-optimization verification table for true tri counts.
- KTX2 image dimensions are not in glTF JSON; parse the KTX2 header (`pixelWidth` at offset 20) from the image bufferView for reproducible max texture size.
- `nodes.ts` helpers can be verified against real GLBs without a browser by parsing the GLB JSON chunk and building a minimal `THREE.Object3D` tree with the same hierarchy and names.
- Verified on `floor_1.glb`: COL_=20, NAV_=7, TASK_=9, ROOM_=3, NAV_spawn_lobby present.
- Shell remains ~561,718 tris; accepted as INFO per decision #21; decimate is not allowed; fallback is per-floor facade split.

## Todo 7
- Lighting.tsx rewritten to daytime spec (§4.1 fase siang): hemisphereLight #BFE3F7/#E3F4FC @1.0, directionalLight #FFFFFF @1.4 pos [12,22,8], shadows 2048² bias -0.0005 cam ±18 far 60. ambientLight removed.
- Gotcha: R3F/three has NO `skyColor` prop on hemisphereLight (TS2322). Use `args={['#BFE3F7','#E3F4FC']}` — constructor order (skyColor, groundColor, intensity). Keeps spec values greppable, type-clean, runtime-correct.
- Verify loop: `bunx tsc --noEmit` inside apps/web (root lsp has no TS); dev server served / and /dashboard 200 with no new errors.

## Todo 8 — Cleanup komponen prosedural lama (2026-10-18)
- Deleted: FloorPlane.tsx, DeskMarkers.tsx, Agent.tsx.
- Zero remaining references in apps/web/src or apps/web/e2e (verified before and after deletion).
- deskLayout.ts and constants.ts kept: OfficeCanvas.tsx still imports floorCenter and AgentStatuses.
- deskToWorld is now only the definition in deskLayout.ts (no callers); left intact per plan.
- Typecheck fails pre-existing KTX2Loader mismatch in OfficeCanvas.tsx (ModelPreloader callback) and useHqGltf.ts; identical before and after deletion, not caused by cleanup.
- Biome lint on office/ reports only pre-existing useImportType warnings and FloorSelector useButtonType error; no new errors from deletion.

## Todo 9 — CharAgent idle di lobby (2026-10-18)
- CharAgent.tsx loads `/models/char_base.glb` via `useHqGltf`, plays clip `idle` (happy path — GLB JSON chunk confirms single animation named `idle`), fallback `names[0]` with console.warn if missing.
- Rendered inside `FloorModel` for `n === 1` only, wrapped in own `<Suspense>` so floor stays visible while char suspends. Floor scene passed via `floorScene` prop — no second floor_1.glb fetch.
- `disposeScene` exported from FloorModel and reused for char dispose + `useGLTF.clear(CHAR_URL)` on unmount (floor switch cleanup).
- `window.__hqChar` updated every `useFrame` via `group.getWorldPosition`; `declare global` block in CharAgent.tsx keeps tsc happy.
- Playwright scratch (apps/web/e2e/task9-scratch.mjs, deleted after): NAV_spawn_lobby worldPos computed from floor_1.glb JSON chunk only (TRS chain, no mesh decode) = (7,0,-6); runtime `__hqChar` = (7,0,-6), distance 0.0000 < 0.5 PASS. Two screenshots 600 ms apart diffed in-browser via canvas Image+getImageData (no pngjs/pixelmatch/sharp in repo, no new deps): 185 px changed in 21x28 bbox — idle alive. Zero console errors, zero pageerrors, zero setKTX2Loader errors.
- `bunx tsc --noEmit` in apps/web EXIT=0 (pre-existing KTX2Loader errors from todo 8 apparently resolved by review rounds).
- Gotcha: `pkill -f "next dev"` in same command chain as other statements hung the shell tool — run kill/rm in separate calls or with `-9` and short timeout.

## Todo 10 — renderer.info + FPS per lantai (2026-10-18)
- `PerfProbe.tsx` uses `useFrame` to accumulate frames and track per-frame max of `gl.info.render.calls` / `gl.info.render.triangles`; writes `window.__hqStats` once per second.
- `declare global` block inside the component file keeps TS strict happy without touching `global.d.ts`.
- Mounted inside `Scene.tsx` (child of Canvas) with minimal diff.
- Playwright evidence captured all 4 floors; F1 shows higher calls/triangles due to CharAgent.
- Shell ~561k tris remains accepted per decision #21; no decimation action taken.
- Scratch script `apps/web/e2e/task10-scratch.mjs` deleted after capture; dev server and browser terminated by script finally block.

## Todo 11 - E2E gate update + baseline regen (2026-10-18)
- New baseline md5 `4816ac7234930a6aea5e65856c2e759e` (316223 B); old MVP-1 baseline was `a273b6d34ea3689d65a817f6b125e15c` (29439 B).
- Timings: regen 1.8m, pass run1 1.7m, run2 1.6m, NEG 1.4m (test 1 ~1.1-1.4m, nocut ~23s).
- Quirk: toHaveScreenshot default 5s timeout fails with "waiting for element to be stable" on the heavy scene under SwiftShader (1-4 FPS). Fixed with per-assertion `timeout: 30_000`; maxDiffPixelRatio untouched.
- PW_NEG: env flag inversion left in spec (canvas invert) but the proof used a temp spec with `.not.toHaveScreenshot` against a copy of the baseline; failed as expected, temp spec + snapshot dir deleted.
- Added second spec test (`?nocut=1`) that writes checkpoint PNG and asserts no console errors. Checkpoint PNGs are written by the spec into task-11-checkpoint/.
- Gotcha: aborted playwright runs leave orphan `next dev` / `next-server` on :3100 and config has reuseExistingServer:false. Kill by PID in a separate call (pkill -f in a chain hangs the shell again). Another user's `next-server` (pid 12098) and Chrome processes are not ours, left alone.
- Gotcha: run long playwright via nohup script + poll (tool cap 120s).
- SUSPECT: spec stats sample (floor 1: 296 calls / 380033 tris) equals the task-10 F3 row exactly and is far below task-10 F1 (627 / 583228). PerfProbe floorId flips on click before the floor model finishes loading, so waitForFunction can accept a shell-only sample. Task-10 F3 row may be shell-only too. Spec only asserts >0. Fix idea (not done, out of scope): read stats after the 3s settle and require a fresh sample, or compare against shell-only baseline.
- Deleted building.glb + character.glb (0 refs verified, unstaged). tsc EXIT=0.
- Visual notes: web default camera crops building at right edge and selector overlaps sign; F2 view shows slab+columns with no visible furniture (unverified if occluded). Reported in checkpoint README, no component changes.
- Checkpoint README finalized post-approval; stats equality caveat documented as accepted (2026-10-18).

## Todo 12 (typecheck + lint gate)
- `bun run typecheck` (apps/web) EXIT=0.
- biome lint on 12 touched files: EXIT=0, 0 errors, 3 NEW warnings (not fixed): CharAgent.tsx:21 noNonNullAssertion; FloorModel.tsx:4 useImportType; OfficeCanvas.tsx:15 useImportType. All trivial; fix candidates: `useRef<THREE.Group>(null)`/cast, `import type * as THREE`, merge into `import { DEFAULT_STATUSES, type AgentStatuses }`.
- Pre-existing MVP-1: Agent.tsx + DeskMarkers.tsx diagnostics vanished (files deleted); CameraRig.tsx:13, FloorSelector.tsx:29, dashboard/page.tsx:38 remain untouched.
- Evidence: .omo/evidence/mvp3-integration/task-12-typecheck-lint.txt
- [2026-10-18T23:41:48+00:00] Todo 13: appended '## MVP-3' to docs/mvp/HANDOFF.md (58 lines, 0 removed). Finding: .gitignore has no active >10MB pattern, hq_shell.glb (12.84MB) not ignored/untracked; documented in Keterbatasan. Evidence task-13-handoff.md.
- F1 fix: hq_shell.glb now git-ignored by explicit name; HANDOFF MVP-3 section + task-13 evidence copy corrected (2026-10-18).
- [2026-10-18] F1 fix: REAL spec PW_NEG=1 run fails at toHaveScreenshot (749312 px, ratio 0.81, EXIT=1); evidence appended to task-11-e2e-negative.txt; README f1 md5 refreshed (idle frame makes it unstable). Orphan next dev (228803/228804/231394) found holding :3100 at start, killed by PID.
- [2026-10-18] F1 fix todo 9: patched char_base ('idle'->'idlx', /tmp only) via page.route -> warn "[CharAgent] clip 'idle' missing; falling back to 'idlx'" printed, 199 px diff 700ms apart, 0 errors. Evidence task-9-char-fallback.txt. PIL/numpy used for diff (no pngjs in repo).
- F3 manual QA: S1-S7,S9 PASS; S8 FAIL (floor_3.glb network abort -> whole canvas replaced by 'WebGL not available' fallback, floor selector removed, unrecoverable w/o reload; cause: error boundary in OfficeCanvas wraps whole canvas+selector). Evidence in final-wave/F3-manual-qa/. Verdict REJECT.
- Todo 15: stats tables corrected from F3 re-measure; old F2-F4 rows were stale/shell-only (2026-10-18).
- [2026-10-19] Todo 14 (F3 S8 fix): FloorLoadBoundary.tsx wraps only <Canvas> in OfficeCanvas; selector is sibling outside. drei useGLTF caches the rejected promise -> must `useGLTF.clear(url)` before resetting boundary or retry rethrows. No `key` on boundary (would remount Canvas/WebGL ctx). Browser console "Failed to load resource: net::ERR_FAILED" text has no URL: filter via msg.location().url. New 3rd e2e test passes; full spec 3 passed; baseline md5 unchanged 4816ac72.... Evidence task-14-floor-failure.txt.
- F3 round 2 manual QA: S1-S9 PASS incl. S8 failure path + variants a/b (FloorLoadBoundary works, selector stays, retry+floor switch recover); e2e 3 passed, md5 unchanged. Evidence: .omo/evidence/mvp3-integration/final-wave/F3-manual-qa/

- (2026-10-19 final polish) Selisih NAV_spawn_lobby (0,0,0) vs runtime (7,0,-6) TERVERIFIKASI: node NAV_spawn_lobby ada di level atas hierarki floor_1.glb dengan translasi [7,0,-6]; skrip ev/task-3-glb-table rebuild hierarki TANPA translasi node → baca (0,0,0). Runtime nodeWorldPosition (nodes.ts) memuat translasi → (7,0,-6) benar. Koreksi dicatat di HANDOFF MVP-3 (sub-bullet setelah bullet verifikasi GLB) + ev/task-13-handoff.md. HANDOFF tetap additions-only (git diff --numstat 59 0).
- [2026-10-19] F4 final-wave: koreksi NAV_spawn_lobby appended ke HANDOFF MVP-3 (line 169, additions-only diff 59/0) + task-13-handoff.md. Penyebab selisih terverifikasi: node di level atas hierarki dengan translasi [7,0,-6]; skrip task-3 abaikan translasi -> baca (0,0,0); runtime nodeWorldPosition benar (7,0,-6).

- 2026-10-19 (final polish): selisih posisi NAV_spawn_lobby terverifikasi — node ada di level hierarki atas dengan translasi [7,0,-6]; skrip verifikasi task-3 (rebuild hierarki tanpa translasi) membaca (0,0,0), runtime nodeWorldPosition memuat translasi dan benar (7,0,-6). Koreksi ditambahkan append-only ke HANDOFF MVP-3 dan ev/task-13-handoff.md.
