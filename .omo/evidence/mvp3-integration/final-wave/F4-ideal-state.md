# F4 Ideal-State Fidelity — round 2 (2026-10-19)

Checker: F4 worker, read-only. Every result below comes from artifacts I opened or commands I re-ran myself.

| IS | Ideal state (plan) | Delivered | Proof | Result |
|----|--------------------|-----------|-------|--------|
| IS-1 | Shell + cutaway of the active floor, chosen via FloorSelector; only the active floor is loaded | Shell + floor_1 load on start; floor-1 facade is hidden (102 nodes); `?nocut=1` shows the full facade; F2 loads lazily. Round 2: a failed floor GLB now shows "Gagal memuat model lantai" plus a "Coba lagi" button, the selector stays mounted, and the next floor change recovers | `task-6-cutaway-diff.png` viewed (cut side shows lobby interior, nocut side shows full facade); `task-6-loader-network.txt` (hq_shell/floor_1 1x200, floor_2 only after click, f3/f4=0); `task-11-e2e-pass.txt` 2 runs x 2 passed; `task-14-floor-failure.txt` RED (WebGL fallback, no buttons) → GREEN, full spec `3 passed`, baseline md5 unchanged; `task-14-floor-failure-error.png` viewed (message + F1-F4 selector visible); `OfficeCanvas.tsx` L57-58: `FloorSelector` is a sibling outside `FloorLoadBoundary`, which wraps only `<Canvas>`; `FloorLoadBoundary.tsx` clears the drei cache on reset/retry | PASS. Note: `final-wave/F3-manual-qa/report.md` is still the round-1 file (same md5 0fd33047… as `round1/`, mtime is older than task-14), so a live round-2 S8 run is not available yet. The automated RED→GREEN covers the same scenario |
| IS-2 | Geometry identical (tris ±0.1%), sharp textures, only reduction = 2048² cap | Tris delta 0.00% on all 6 files; char 19,499; KTX2 max 2048x2048 everywhere | Independent python struct parse of the 6 GLBs: hq_shell 561,718 / floor_1 103,148 / floor_2-4 107,260 / char 19,499 (EXT_mesh_gpu_instancing counts applied), every image `image/ktx2`, pixelWidth/Height max (2048,2048); extensionsUsed = basisu + meshopt (+ gpu_instancing on floors); matches `task-3-glb-table.md` and `task-2-optimize-happy.txt` (Δ% 0.00). Decimation grep: only `prune_character_actions` (action pruning, not geometry). `CHECKPOINT-3-APPROVED.md` + `CHECKPOINT-11-APPROVED.md` ("setuju lanjutkan") exist | PASS (CHECKPOINT-3 has no verbatim quote: documentation gap only, not an IS shortfall) |
| IS-3 | One character (CHAR_BASE + skeleton) idle-animating at NAV_spawn_lobby on F1 | char_base has 1 skin and 1 anim (`idle`); `window.__hqChar` = (7,0,-6), distance 0; frame diff 185 px; fallback clip plays (199 px) | `task-9-char-happy/{position,animation,console}.txt`, `task-9-char-fallback.txt`, `CharAgent.tsx`, F3 S6 (dist 0, 201 px) | PASS. Non-vacuous? Partly: at runtime the group position is set from the same `nodeWorldPosition` value it is later compared with, so that runtime check is close to circular. But my raw JSON parse shows NAV_spawn_lobby is a scene root with translation [7,0,-6] (chain depth 1), which confirms (7,0,-6) independently. The claim holds |
| IS-4 | F2-4 selectable and loaded; inactive floors not rendered, GPU memory freed; re-fetch allowed | Only the active `<FloorModel n>` is mounted; unmount runs `disposeScene` + `useGLTF.clear`; F3/F4 are not fetched until clicked; F2→F1 re-fetches floor_1 with 200 | `Scene.tsx`, `FloorModel.tsx` L36-40; `task-6-loader-network.txt`; F3 results.json S2/S3/S4 (totalFloorFetches 1:3, 2:2, 3:1, 4:1); `task-10-stats-per-floor.md` | PASS |
| IS-5 | COL_ hidden in web but still in GLB; NAV_/TASK_/ROOM_ stay as nodes after optimization | floor_1 after optimization: COL 20 / NAV 7 / TASK 9 / ROOM 3 (all 7 NAV names listed); floors 2-4 COL 1; runtime log "hid 20 COL_ nodes" / "hid 1 COL_ nodes" | Own parse; `FloorModel.tsx` L36-37 console.debug; `task-6-loader-network.txt` console | PASS |
| IS-6 | renderer.info calls/triangles + FPS per floor recorded as info | 4 floors + F1 recheck; table matches results.json digit for digit: S1 568/576326, S4 F1 303/364045, S2 F2 296/380033, S4 F3 305/388681, S4 F4 307/391679; FPS 0-4 INFO | `task-10-stats-per-floor.md` vs `final-wave/F3-manual-qa/results.json`; `task-11-checkpoint/README.md` L20-24 and the HANDOFF MVP-3 section (L27-33 of the last `##`) show the same numbers; old values are marked SUPERSEDED in all three places; no contradicting caveat left (CHECKPOINT-11 open note has a Resolution section) | PASS |
| IS-7 | typecheck passes; touched-file lint clean | Re-run by me: `bun run typecheck` TC_EXIT=0; biome lint on FloorLoadBoundary.tsx + OfficeCanvas.tsx: BIOME_EXIT=0, 1 warning (OfficeCanvas:16 useImportType, accepted/pre-existing) | live run + `task-12-typecheck-lint.txt` | PASS |
| IS-8 | MVP-4/5 can resolve nodes by prefix from the real GLB (floor_1) via one helper file | `nodes.ts` (findNodesByPrefix/findFirstByPrefix/hideByPrefix/nodeWorldPosition); 5 unit tests pass; real-file run gives COL 20 / NAV 7 / TASK 9 / ROOM 3, NAV_spawn_lobby found | `nodes.ts`, `task-5-nodes-test.txt`, `task-3-glb-table.md` | PASS. Side note: the real-file script reports a spawn world position of (0,0,0), but the raw JSON root translation is [7,0,-6]. The script is wrong, the helper is not (runtime gives 7,0,-6). HANDOFF documents this, but says the cause is "tidak terverifikasi". The cause is now known: the script did not apply node translation |

## Intent checks
- (a) No decimation: grep of optimize-hq.sh / optimize_hq_helpers.py / export_hq.py finds only `prune_character_actions` (removes animation actions, not geometry); tris Δ 0.00%. PASS
- (b) Meshy balance 3748 (checked live). No spend. PASS
- (c) building.glb/character.glb deleted (git status `D`), 0 refs in apps/web/src + e2e (grep exit 1). PASS
- (d) Lighting.tsx = guide day phase (`#BFE3F7`/`#E3F4FC` hemisphere, white directional @1.4). PASS
- (e) git log top 3 = chore(omo) commits, no MVP-3 commit; changes only in the working tree. PASS
- (f) `git check-ignore -v` → `.gitignore:25:apps/web/public/models/hq_shell.glb`; other 5 not ignored. PASS

## Judged items
- Floors 2-4 have identical placeholder content: IS-4 only says "blockout dapat dipilih dan termuat". Not a shortfall; HANDOFF L46 documents it for MVP-4.
- NAV_spawn_lobby (0,0,0) in the verification script vs (7,0,-6) at runtime: documentation accuracy only. IS-3/IS-8 behaviour is correct.

## Proposed todo rows
None required for any IS row.

Optional future considerations (not blocking):
1. HANDOFF MVP-3 L168: replace "penyebab selisih tidak terverifikasi" with the fact that NAV_spawn_lobby is a root node with translation [7,0,-6] and the verification script ignored node TRS.
2. Rerun live F3 S8 against the round-2 build so `final-wave/F3-manual-qa/report.md` stops being the round-1 copy (owned by the F3 worker).

VERDICT: APPROVE
