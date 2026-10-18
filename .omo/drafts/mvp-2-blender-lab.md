---
slug: mvp-2-blender-lab
status: approved
intent: clear
review_required: true
plan_path: .omo/plans/mvp-2-blender-lab.md
plan_sha256: "computed-by-reviewers (planner session has no shell); both lanes must echo the same digest"
review_round_id: r5
round_status: complete
pending-action: none — plan reviewed and ready; user starts execution via $start-work
decisions_approved: "user m0022 'oke tulis plan jangan lumpa high review' => Q1 cap 300, Q2 t2.5 all, Q3 tests-after self-check; m0019 mid poly + textures"
metis: { status: done, session: ses_eb5bfc8c2ffekQkimRwmm21LjZ, findings: 38 (3 blockers, 21 major, 14 minor) all folded into plan }
review:
  r1:
    momus: { status: done, plan_sha256: 59d5a2d35d1020379105a204678f6183d3da32c7a14b12f52ac87ec73fddf0ad, launch_id: r1-momus-1, session: ses_eb5af31b8ffesYMiHZacMatvBE, result: REJECT, findings: 3 blocker (python-exit-code, tail -1 capture, F4 diffstat on dirty tree) + 5 major (kit name collision, kit_compare framing/ceiling/ROOF, ensure_collection wipes slab, wave1 not independent, image model not confirmed) + 10 minor }
    independent: { status: done, plan_sha256: 59d5a2d35d1020379105a204678f6183d3da32c7a14b12f52ac87ec73fddf0ad, launch_id: r1-oracle-1, session: ses_eb5aef88dffezG7WtgniyUwduX, result: REJECT, findings: 2 blocker (tail -1 capture, scope checks undetectable on dirty tree) + 12 major (stair void 4 boxes, slab z sinks floor, stair run overshoot, startup Camera/Light, kit names, pixels O(N), character out of lobby frame, kit_compare, interiors too dark, action slot + duplicate anim import, wave1, image model) + 11 minor }
    fold: all r1 findings folded into plan (edits m0066-m0077); r2 launched on the revised file.
  r2:
    momus: { status: done, plan_sha256: 4b8282a46a1e6f58941f2bfa17abffec4863ab1c91d06339c43c143e510bb521, launch_id: r2-momus-1, session: ses_eb5989842ffe62LhVtHnR6oIjb, result: APPROVE, findings: 0 blocker + 3 major (ROOM_meeting_a_kit plane hides Meshy tiles, ground top coplanar z-fight, character faces away from cameras) + 2 minor (night --no-gate exception, todo 6 smoke needs build_cameras) }
    independent: { status: done, plan_sha256: 4b8282a46a1e6f58941f2bfa17abffec4863ab1c91d06339c43c143e510bb521, launch_id: r2-oracle-1, session: ses_eb5aef88dffezG7WtgniyUwduX, result: REJECT, findings: 0 blocker + 2 major (same tile/ground z-fight N1, character facing N2) + 8 minor (env-var subshell syntax, todo 8 main drops reset_startup_scene, tile in NAME_PART_RE, kit ceiling z 3.0, verdict cam framing 28 mm, 00e per-file list for parallel MVP-1, explore-task fallback, 8 waves) }
    fold: all r2 findings folded (edits m0087-m0092): CHARACTER_SPAWN rot −37°, closeup cam (5.7,4.25,1.5), verdict cam (3,−46,4)→(3,−27,1) 28 mm, ground top z −0.01, tiles location z −0.095 (top +0.005), ROOM_*_kit hide_render + check, kit floor visible QA row, LIGHT_area z 2.9, kit ceiling top z 3.2, night --no-gate exception, smoke build_cameras, main() reset_startup_scene, NAME_PART_RE + tile / tile_f1_<i>, facing dot > 0.5 in check_character, env-in-subshell syntax, 00e-protected.list, explore fallback, 8 wave. r3 launched.
  r3:
    momus: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r3, plan_sha256: 874b5ec9a3243d693230869c2cf38562a38c9162dc4500af226677b2fe75847c, launch_id: r3-momus-1, session: ses_eb5902599ffesSV8dZb2nexcjZ, bg: bg_d1878130, result: OKAY, findings: "2 minor: ground 80×80 too small for verdict cam (bottom ray hits y −38.8 < edge −33); tile z-max check would include source tile in KIT_MESHY" }
    independent: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r3, plan_sha256: 874b5ec9a3243d693230869c2cf38562a38c9162dc4500af226677b2fe75847c, launch_id: r3-oracle-1, session: ses_eb5aef88dffezG7WtgniyUwduX (continued), bg: bg_02af76f6, result: REJECT, findings: "R1 major: RIG_UNAVAILABLE path fails check_character (expects 1 armature + CHAR_BASE_mesh, no spawn placement); R2 major: sofa group unpinned, may block CAM_lobby→character sightline; R3 minor: verdict cam sees past ground south edge; R4 minor: night --no-gate exception missing from stats rule" }
    fold: all r3 findings folded (m0104-m0106): ground_main 100×100 (y −43..57; covers Momus-1 + Oracle-R3 without a second ground slab), tile z-max check scoped to FLOOR_1_KIT_TEST objects sharing data (source excluded), fallback path writes character_mode.txt=static/rigged + places CHAR_BASE at CHARACTER_SPAWN, check_character mode-aware (1 armature+1 mesh rigged / 1 mesh static) + ray_cast line-of-sight at z 0.3 and 1.5, sofa_1 (6.6,1.6) rot 0 / sofa_2 (6.6,3.6) rot 180 / coffee_table (6.6,2.6) east of sightline, make_sofa footprint/orientation pinned, night --no-gate exception added to render-stats rule, TL;DR exterior row updated. r4 launched (Oracle rejected r3; Momus OKAY).
  r4:
    momus: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r4, plan_sha256: df636d1c4f5fcb1d35520b80dac871805a6a9ec3e5b2415b9879c4812ff980f3, launch_id: r4-momus-1, session: ses_eb58c58c5ffeOr8I4419Z51nUR, bg: bg_3e68e3bb, result: OKAY, findings: "0 blocker, 0 major; 3 non-blocking notes: z 0.3 ray may pass between legs, COL_* boxes hit by ray_cast, verdict cam sees thin horizon wedges at side edges" }
    independent: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r4, plan_sha256: df636d1c4f5fcb1d35520b80dac871805a6a9ec3e5b2415b9879c4812ff980f3, launch_id: r4-oracle-1, session: ses_eb5aef88dffezG7WtgniyUwduX (continued), bg: bg_02af76f6, result: REJECT, findings: "G1 major: ground_main 100×100 contradicts guide §4.1 'ground plane 80×80 m' (guide wins); G2 minor: stage character scale source in static mode; G3 minor: character_mode.txt missing/stale guard + feet-in-frame assert" }
    fold: all r4 findings folded (m0118-m0120): ground_main back to 80×80 (x −30..50, y −33..47, guide §4.1) in TL;DR + todo 3; `ground_verdict` 40×28×0.05 in VERDICT_STAGE (x −17..23, y −61..−33, abuts south edge, no overlap) in todo 17 (Oracle option A, no guide edit); stage scale copied from `CHAR_BASE` (armature rigged / mesh static); check_character: low ray at z 0.9 (hips) instead of 0.3, `COL_` hits skipped by re-cast (cap 8), mode file missing/invalid → AssertionError, rewritten every import, feet-in-frame `world_to_camera_view(...).y > 0.02`; colliders pinned to exact furniture footprint × height (todo 4). Horizon side wedges accepted as cosmetic. r5 launched.
  r5:
momus: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r5, plan_sha256: ea575f1ee66955ee5e09bc10fddfb80b54e3e89a7e4054dfef99bd8eb11d67ef, launch_id: r5-momus-1, session: ses_eb5887be4ffeeEypP3dvnmuliU, bg: bg_79eb28ba, result: OKAY, findings: "0 blocker, 0 major; 2 minor: stage scale should come from CHAR_BASE_mesh.matrix_world.to_scale() (mesh child may carry its own scale); commit strategy says v01-v03, success criteria v04" }
independent: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, runtime_home: null, target: .omo/plans/mvp-2-blender-lab.md, round_id: r5, plan_sha256: ea575f1ee66955ee5e09bc10fddfb80b54e3e89a7e4054dfef99bd8eb11d67ef, launch_id: r5-oracle-1, session: ses_eb5aef88dffezG7WtgniyUwduX (continued), bg: bg_02af76f6, result: APPROVE, findings: "0 blocker, 0 major; 3 minor: M1 COL_desk 1.4×0.7×0.75 stale vs desk 1.6×0.8×0.77; M2 check_character needs view_layer.update() + depsgraph before transform reads, compare ray hit by name; M3 tree positions unpinned" }
fold: all r5 minors folded (m0138, m0140), no re-review required by either lane: COL_desk_<n> 1.6×0.8×0.77 (todo 4); stage scale = (CHAR_BASE_mesh.matrix_world if rigged else CHAR_BASE.matrix_world).to_scale() (todo 17); check_character does view_layer.update() + evaluated_depsgraph_get() first and compares ray hit by name in {CHAR_BASE, CHAR_BASE_mesh} (todo 15); TREE_POSITIONS pinned to 10 literal (x,y) in hq_lib.py clear of road/kit room/verdict stage (todo 3); commit strategy says .blend v01-v04 + todo 17. Both lanes concur plan sha256 ea575f1e…; post-fold sha differs by these minor edits only.
review_outcome: PASS (r5 — Momus OKAY, Oracle APPROVE, minors folded). High-accuracy review complete; plan ready for $start-work.
approach: Procedural bpy building (4-floor massing + Floor 1 detail + §4.1 exterior/lighting) in apps/assets/blender/build_hq.py; Meshy Pro via MCP (REST fallback) for 3-4 KIT_* pieces + 1 character; side-by-side Eevee renders; verdict Level 1 vs Level 2 written to guide §3/§11 + .html; HANDOFF appended. Four user checkpoints (2a/2b/2c/2d) kept as STOP-and-wait gates.
---

# Draft: mvp-2-blender-lab

<!-- hand-written: bash tool unavailable in this session; mirrors scaffold-plan.mjs buildDraft() so a later script run is a no-op -->

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
- C1 | FASE 2a: `apps/assets/blender/build_hq.py` idempotent (MCP + headless), 4-floor massing 20×14 m / 3.2 m, Floor 1 rooms+furniture, §4.1 palette/lighting/exterior, naming §6 incl. NAV_wp_*, renders iso+lobby+workstation (+ night iso), `hq_v01.blend` | active | .omo/evidence/mvp-2-blender-lab/2a-*
- C2 | FASE 2b: 3-4 Meshy KIT_* pieces generated (Pro, MCP), normalized by bpy, `ROOM_meeting_a_kit` stitched, side-by-side render, metrics (polycount/credits/seams), `hq_v02.blend` | active | .omo/evidence/mvp-2-blender-lab/2b-*
- C3 | FASE 2c: 1 Meshy character (t-pose, ≤8k tris) imported at NAV_spawn_lobby, rig + idle via Meshy MCP, lobby render, `hq_v03.blend` | active | .omo/evidence/mvp-2-blender-lab/2c-*
- C4 | FASE 2d: comparison render, verdict Level 1/2 asked to user, guide §3 + §11 + .html updated, build_hq.py switched to KIT_* if Level 2 | active | .omo/evidence/mvp-2-blender-lab/2d-*
- C5 | HANDOFF report appended to docs/mvp/HANDOFF.md (paths, object list, polycount, credits, mode, verdict, licence, limits) | active | docs/mvp/HANDOFF.md

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
- Meshy mode | Pro via Meshy MCP tools (meshy_text_to_3d / refine / rig / animate / download); REST with MESHY_API_KEY only if an MCP tool errors | user message m0011 | yes
- Generation route | text-to-3d Smart Topology `ai_model: meshy-t2.5`, `model_type: smart-topology` (5 cr preview) + refine (10 cr) with shared `texture_image_url` = one approved style-reference image from meshy_text_to_image (nano-banana-2, 6 cr) | cheapest clean low-poly triangles, matches §4; prompt demands same reference image for all pieces | yes (alt: image-to-3d meshy-7.1 30 cr/piece)
- Credit cap | ≤ 300 credits total for MVP-2 (ref image 6 + kit ≤6×15 + char ≤3×15 + rig 5 + animate 3 + remesh/convert margin) — worker pre-authorized within cap + per-phase counts from prompt (max 6 kit, max 3 char); above cap → STOP ask | balance 4100; user said "maks N generate tanpa izin ulang" | yes
- Rig/animate cost | Meshy MCP lists rig 5 cr, animate 3 cr/action (guide §10 says 0) — MCP price table wins; discrepancy recorded in HANDOFF + guide §10 | source of truth = live tool | yes
- Licence | Meshy Pro output = Meshy commercial licence, not CC BY 4.0; HANDOFF notes licence + plan tier | prompt's CC BY note applies to Free only | yes
- Renders | MCP for iteration; QA renders via headless `blender -b <blend> -P apps/assets/blender/render_hq.py` to `apps/assets/blender/renders/hq_vNN_<view>.png` (deterministic, probe: headless Eevee OK 14 s) then `read` | §1 MUST 6, §9 quirk | yes
- Day-night | render fase siang (required) + 1 iso malam (optional per HANDOFF MVP-0) | cheap extra | yes
- Exterior | §4.1 "Dunia luar" (ground 80×80 #A5D6A7, road 6 m #9E9E9E, sidewalk #CFCFCF, 8-12 trees, 1-2 cars) included in build_hq.py as collection `EXTERIOR` | HANDOFF MVP-0 assigns to MVP-2 P0 | yes
- Workstations | 8 desks `TASK_desk_1..8` in ROOM_workstation_a (guide §7.3 P0) | guide | yes
- Lighting in Blender | Sun lamp (siang #FFFFFF 1.4) + World gradient sky (#BFE3F7→#E3F4FC) as HemisphereLight stand-in; Eevee soft shadows | §4.1 values are R3F; Blender approximation | yes
- Materials | flat shading, 1 shared material per palette colour using vertex colors (`Color Attribute` node) — no bitmap textures from bpy | §4 | yes
- Raw assets | `apps/assets/raw/meshy/{kit,}`; no .gitignore change; sizes listed in HANDOFF; >10 MB flagged not-for-git (no LFS installed) | prompt | yes
- Test strategy | tests-after, framework-less: `blender -b -P apps/assets/blender/build_hq.py -- --check` runs assert self-check (naming §6 present, COL_* hide_render, polycount budget, floor heights) exit≠0 on fail; agent-executed QA every todo | prompt + AGENTS.md | yes
- Git | no commit/branch/stash; worktree already dirty (31 M + 74 ??) → out of scope, never touched | global gate | n/a

## Findings (cited - path:lines)
- docs/redhunter-hq-brainstorming-guided.md — §1 MUST 4-6 (save hq_vNN.blend, build_hq.py source of truth, render PNG verify); MUST NOT 3 (no monolithic room gen; kit pieces OK), 5 (MCP localhost), 8; §3 rows Hybrid Meshy L96, Langganan L100; §4 L111-136 (grid 1 m, floor 3.2 m, column grid 4 m, QA checklist); §4.1 L138-150 palette/sky/sun/lighting/exterior; §5.1 L158-168 (1.7 m, T/A-pose, ≤8k tris, ring 0.25 m ≤200 tris); §6 L192-203 naming incl. KIT_*; §7.1 L209-219 step 6a; §7.2 L221-231; §7.4 L241-246 (20×14 m, 3.2 m, 8 workstations); §9 L294-305 Blender quirks; §10 L327-333 Meshy pricing; §11 L339-358 changelog (next #19).
- docs/mvp/HANDOFF.md:15 — MVP-2 must add `NAV_wp_<room_id>` empty per ROOM_* + sofa area in ROOM_lobby; render QA siang+malam suggested. L61-67 correction: MVP-2 pure Blender, forbidden apps/web, apps/api, packages/*, apps/web/public/models/.
- docs/redhunter-hq-brainstorming-guided.html — 374 lines; §3 Hybrid Meshy row L127; §11 h2 L345, row #11 L358 (anchor for append #19).
- .env — only key `MESHY_API_KEY`, non-empty (value never printed). .gitignore ignores .env.
- Meshy MCP: balance 4100 (3100 monthly + 1000 permanent). Tools: meshy_text_to_image, meshy_text_to_3d (smart-topology meshy-t2.5 5 cr), meshy_text_to_3d_refine (10 cr), meshy_image_to_3d, meshy_rig (5 cr, incl. walk/run), meshy_animate (3 cr/action), meshy_list_animations (free), meshy_download_model (save_to), meshy_get_task_status.
- Blender MCP: addon 1.8 protocol 13 up-to-date, Blender 5.0.1, libraries/generators all off; scene = default Cube (unsaved), engine BLENDER_EEVEE. Headless: engine enum = ['BLENDER_EEVEE'] only; headless Eevee render of default scene OK (14 s, /tmp/mvp2_probe.png 44.7 KB). numpy absent in Blender python (`look` image mode unusable). GPU RTX 3090, 48 cores, 123 GB RAM. Addon file ~/.config/blender/5.0/scripts/addons/blender_mcp.py.
- apps/assets/: scripts/{build.sh,generate-assets.ts,optimize.sh}, models/{building.glb,character.glb}, package.json; `apps/assets/blender/` and `apps/assets/raw/` do NOT exist.
- Git: HEAD 49ea580 main, single worktree, no index.lock; 31 tracked modified (incl. docs/mvp/HANDOFF.md, guide .md/.html) + 74 untracked (incl. docs/mvp/MVP-2-blender-lab.md). No .gitattributes, no git-lfs.
- Precedent: .omo/plans/mvp-1-foundation.md (todo format, evidence dir pattern `.omo/evidence/<slug>/NN-*.txt`, shell discipline `R=$(git rev-parse --show-toplevel)` + subshell).

## Decisions (with rationale)
- Four ⏸ checkpoints from the prompt stay as explicit STOP-and-wait todos (user approval is the prompt's requirement, not QA).
- Kit pieces: KIT_wall_1m (1×0.15×3.2 m), KIT_wall_door (1×3.2 m with door), KIT_floor_1m (1×1×0.1 m), optional KIT_pillar (0.4×0.4×3.2 m); generated one object per task, `origin_at: bottom`, `target_formats: ["glb"]`, `target_polycount` ≤ 800.
- Character: text-to-3d smart-topology meshy-t2.5, `pose_mode: "t-pose"`, `target_polycount: 7500` (ring budget 200 reserved for bpy torus), refine with `texture_image_url` = same reference image; rig via meshy_rig (height 1.7) → walk/run free; idle via meshy_list_animations(search "idle") → meshy_animate.
- Normalisation (step 6a) implemented as `apps/assets/blender/normalize_kit.py` functions imported by build_hq.py (scale to bbox target, origin to base-centre, apply transforms, optional Remesh modifier, flat shading, vertex-colour fallback).
- Verdict todo writes guide §3 row "Hybrid Meshy" status + §11 row #19 + .html mirror ONLY after user answers Level 1/2 question (owner decision inside execution, as the prompt dictates).

## Scope IN
- New: apps/assets/blender/build_hq.py, normalize_kit.py, render_hq.py, hq_v01..v03.blend, renders/*.png; apps/assets/raw/meshy/{kit/,}*.glb (+ reference image png).
- Edits: docs/redhunter-hq-brainstorming-guided.md (§3, §10 price note, §11 #19), .html mirror, docs/mvp/HANDOFF.md (append MVP-2).
- Evidence: .omo/evidence/mvp-2-blender-lab/.

## Scope OUT (Must NOT have)
- No apps/web, apps/api, packages/*, apps/web/public/models/, apps/assets/scripts/*, package.json edits. No GLB export for web. No Sloyd/Tripo/Hyper3D. No git commit/branch/stash/push. No .env edits or printing. No MCP socket exposure. No monolithic room generation via Meshy. No smooth shading/bitmap textures from bpy. No face shape keys / 7 clips (MVP-4). No credits beyond cap without asking.

## Scope change (user m0019: "mid poly aja saya butuh texture juga walau poly")
- Style shifts from "low-poly flat-shaded vertex-color" to **mid-poly stylized + crisp textures**. Guide edits required BEFORE 2a (new todo 0): §3 Style row, §4 rows Shading/Material/Tekstur bitmap, §5.1 Polycount (≤ 20.000 tris/char, texture ≤ 2048²), §1 MUST NOT 4 reworded (blur/melting still banned; smooth-by-angle allowed), §11 row #19; .html mirror.
- Meshy params: `target_polycount` kit ≤ 1500, character 20000 (t2.5 max 30k); refine `texture_resolution: "2k"` kit, `"4k"` character (same price), `enable_pbr: false` (flat-lit stylized look, smaller GLB), texture prompt "stylized hand-painted, clean edges, no noise/blur".
- bpy building: stays palette colours (vertex colour) — procedural textures not baked in MVP-2 (would need UV + bake pipeline; deferred to verdict: if textured Meshy furniture clashes with flat bpy walls, that is exactly what the 2d comparison must judge). Announced default, reversible.
- Shading default: bpy objects flat; Meshy imports keep auto-smooth ≤ 30° (edges stay sharp). Announced default.
- Polycount budget scene: 10 agents ≈ 200k tris; building target ≤ 150k tris Floor 1 incl. kit.

## Open questions
1. Credit cap for MVP-2? default ≤ 300 cr.
2. Generation route? default Smart Topology text-to-3d (meshy-t2.5, mid-poly targets above) + refine with shared reference image; alt image-to-3d meshy-7.1 (~30 cr/piece).
3. Test strategy? default tests-after assert self-check `build_hq.py -- --check`.
4. (answered m0019) Poly level = mid poly + textures.

## Approval gate
status: approved (m0022) → plan written → metis + 5 review rounds done → review PASS
next action: user runs $start-work on .omo/plans/mvp-2-blender-lab.md. Planner stops here.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
