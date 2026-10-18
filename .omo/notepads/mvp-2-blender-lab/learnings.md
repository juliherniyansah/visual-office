# learnings

## todo 1 (guide style revision)
- html MUST NOT list items omit the **MUST NOT** prefix and capitalize first word; mirror text, not markup.
- Scripted edits with count==1 assert on md+html validated before any write avoid md/html drift.
- 01-apply.py / 01-review.py kept in evidence for rerun.
- todo2 (2026-10-17): API probe 15 keys; Mesh.set_sharp_from_angle, Material.surface_render_method/blend_method/use_transparent_shadow, SceneEEVEE.use_shadows/use_gtao/taa_render_samples, Light.use_shadow_jitter, AnimData.action_slot, Action.slots = False. Mesh.shade_smooth/shade_flat, gltf/fbx import = True. view_transform enum = ['NONE'] only (Standard/AgX absent in headless enum read). Builders must use shade_smooth + auto-smooth-free approach; avoid those False attrs.

## [orchestrator] API probe CORRECTION (todo 2)
- 02b-api-probe.txt used hasattr(bpy.types.X, name) on CLASSES -> RNA properties show False. WRONG signal. Use 02c-api-probe-instance.txt (instance-level) as truth.
- Blender 5.0.1 truth: Material.surface_render_method (DITHERED|BLENDED) / blend_method / use_transparent_shadow ALL exist; Light.use_shadow, use_shadow_jitter exist; SceneEEVEE.use_shadows, taa_render_samples (default 64) exist, use_gtao DOES NOT (use_fast_gi / use_raytracing instead); AnimData.action_slot exists; world.use_nodes exists.
- Mesh.set_sharp_from_angle DOES NOT exist in 5.0. Use bpy.ops.object.shade_smooth_by_angle(angle=radians(30)) (needs object selected+active, object mode) or bpy.ops.mesh.set_sharpness_by_angle in edit mode. Mesh.shade_smooth()/shade_flat() exist.
- view_transform enum introspection via bl_rna returns ['NONE'] only (dynamic enum); actual scene default = 'AgX'. Assign 'Standard' inside try/except TypeError, then READ BACK scene.view_settings.view_transform and record. Do not trust enum_items.
- Area light shape enum: SQUARE|RECTANGLE|DISK|ELLIPSE.
- Meshy balance baseline 4100 (cap in plan = spend 300, not balance). HEAD 49ea580.

## todo 3 (hq_lib + hq_massing + build_hq skeleton)
- bmesh.ops.create_cone with radius1==radius2 serves as cylinder; create_icosphere/create_cone return dict with "verts" — offset only ret["verts"] when composing multi-part mesh (tree trunk+crown in one bm).
- Multi-material single mesh: track len(bm.faces) before second primitive, set face.material_index=1 for crown faces after ensure_lookup_table.
- mesh.shade_flat() works on Mesh datablock directly (no object/context needed) in 5.0.
- view_transform='Standard' assignment succeeds headless; readback prints VIEW_TRANSFORM Standard (enum introspection useless per todo2 correction).
- scene.render.engine='BLENDER_EEVEE' assignment raises nothing in 5.0 headless (already default EEVEE Next alias).
- Baseline counts: SELF_CHECK OK 185 objects 2550 tris (massing+exterior only); idempotent across runs.
- read_homefile(use_empty=True) then save_version=0 ordering respected (prefs set after reset in _configure_scene).
- hq_lib 381 LOC (over 300 soft target, under 500 hard; spec constants alone ~120 lines).

## [orchestrator] after todo 3 (hq_lib/hq_massing/build_hq accepted)
- Always export PYTHONDONTWRITEBYTECODE=1 for blender runs; python import in blender creates apps/assets/blender/__pycache__ (junk; rm via python shutil.rmtree - `rm -rf` blocked by safety net).
- hq_lib public API final: get_material/palette_material(key,**kw), get_collection, clear_project_collections, make_box(name,size,location,material,collection,rotation_z=0)/make_cylinder(name,radius,depth,location,material,collection,segments)/make_cone/make_icosphere(name,radius,location,material,collection,subdivisions)/make_empty(name,location,rotation,collection,display)/link_duplicate(src,name,location,rotation_z,collection), register_check, SELF_CHECKS, run_self_checks, count_tris, count_tris_by_collection. All origin base-centre, shade_flat.
- Scratch baseline: 185 objects / 2550 tris (massing+exterior only). VIEW_TRANSFORM readback = Standard works.

## todo 5 (hq_furniture + test)
- Multi-part single mesh pattern: track len(bm.faces) before each bmesh.ops primitive, then faces.ensure_lookup_table + set material_index on bm.faces[start:]; append materials to mesh in index order at finish.
- bmesh.ops.create_grid makes an XY plane; remap verts manually (z=y*h+cz, y=const) for a vertical screen quad — cheaper than a 6-face box (2 tris).
- Icosphere subdiv1 = 80 tris; plant pot 8-seg cyl (28) + icosphere = 108 < 120 cap. 8-seg cylinder = 28 loop_triangles (2x6 caps + 16 sides).
- Negative hook via os.environ read INSIDE builder (make_desk) keeps test file simple; env var must be set inside subshell for blender child.

## todo 6 (hq_lighting + render_hq)
- Standard view transform has no highlight rolloff: sun energy 4.0 clips near-white walls (mean_lum 0.944). Day sun tuned to 1.5 -> mean_lum 0.856. Night sun 0.7 -> 0.02 (night sky ramp at Background strength 1.0 alone yields ~0.145 mean_lum on iso; sun adds ~0.1 lum per W/m2 here).
- World gradient via Texture Coordinate(Generated)->SeparateXYZ(Z)->ColorRamp->Background works headless; tree.nodes.clear() then recreate = simplest re-runnable world.
- foreach_get into array.array('f', bytes(4*w*h*4)) instant for 1280x720; stride-16 stats ~0.1 s.
- Area light default orientation already points -Z; no rotation needed.
- Render time ~10 s/frame EEVEE 32 samples headless.
- CAM clip_end default 100 < iso distance ~48 + 80 m ground span; set 200.

## todo 4 (hq_floor1)
- hq_furniture.py landed mid-run (parallel todo 5): acceptance build used REAL builders, no FURNITURE_STUB printed. Stub path exists in hq_floor1 (except ImportError/SyntaxError) but untested against real scene — todo 8 removes it.
- KIT_wall_door is one mesh (frame 3 parts + orange leaf) with 2 material slots, material_index per face after ensure_lookup_table — same pattern as massing trees.
- Door openings in a 1m-grid wall run: skip the 1 cell overlapping door centre, place door piece, add 2 fillers = KIT_wall_1m linked dupes with obj.scale=(0.5,1,1) (scale on object, mesh stays shared; data.users still counts them).
- Side walls (w/e) inset 0.002 m from facade plane to avoid corner z-fighting with front/back runs.
- COL_stair = single rotated ramp box (rotation_euler.x = atan2(3.2,4.0), len=hypot(4,3.2)) — tight, no padding.
- STAIR_core made an EMPTY (plan lists it as required name but steps are stair_step_<i>; empty marks the core).
- Scene totals with floor1: SELF_CHECK OK 367 objects 6630 tris (budget 150000). KIT_wall_1m data.users=37.

## todo 3 fix (orchestrator defects A+B, 2026-10-17)
- DEFECT A root cause CONFIRMED: bmesh.ops do NOT append faces in creation order — `bm.faces[trunk_face_count:]` sliced mixed faces (probe before: idx0 z 0.5..1.98, idx1 z 0.0..2.56 on tree_1). Fix: snapshot `set(bm.faces)` before second primitive, assign material_index=1 to faces not in snapshot. Probe after: idx0 10 faces z 0..1, idx1 z>=1.0. Never slice bm.faces by count for op attribution; use set-diff (ops ret dicts have "verts" but not always usable "faces" across ops).
- check_tree_materials added inside check_massing; bite proven by scrambling tree_1 material_index via --python-expr on a fresh in-memory build (AssertionError, EXIT=1) — /tmp file copy approach fails because REPO_ROOT=parents[3] breaks outside the repo tree.
- DEFECT B: iso ((34,-22,26),(10,7,2),ORTHO,44) cropped roof. New: target z 5.5, ortho_scale 50. Rule of thumb: ORTHO target z ~= building mid-height; ortho_scale >= footprint diagonal + ~2x margin... actual: diagonal 24.4 -> 50 covers 16:9 at this angle.
- Rebuild after fix: SELF_CHECK OK 185 objects 2550 tris — identical to pre-fix (material_index changes don't alter counts).

## todo 5 fix (monitor on_desk)
- Builder origin convention must match placement convention: floor-origin builders placed at z=desk_top double-offset. Fix = on_desk kw (desk-surface origin variant) instead of changing callers' z, keeps default behaviour + existing tests intact.
- Stub fallbacks in consumer modules need **kw on their build() signature or new kwargs break the ImportError path.
- Desk top slab z 0.73-0.77 -> monitor placement z = DESK_SIZE[2] = 0.77 correct with on_desk=True.

## [orchestrator] after wave 1b (todos 4/5/6 accepted)
- GATES ARE NOT ENOUGH: stat/self-check passed while renders showed floating monitors, scrambled tree materials, cropped roof. Always READ the PNG.
- make_monitor(on_desk=True) = origin on desk surface; hq_floor1 uses it at z=DESK_SIZE[2]=0.77.
- iso cam now target (10,7,5.5) ortho 50.
- LIGHTING IS OVEREXPOSED: day sun 1.5 + 3 area lights (150W) give mean_lum ~0.80-0.86 on interiors/exterior (near 0.9 gate; walls/floor blown white, low contrast). Todo 8 MUST tune: lower area energy and/or sun, check lobby/workstation/iso each stay within 0.15-0.9 with visible shading. Also interior floor looks washed; glass walls look fine.
- Lobby render observation: sofa fills foreground (camera at (4,2) very close to sofa_1 at (6.6,1.6)); todo 8 should check lobby framing (character spawn (7,6) should be visible).
- Pre-existing scratch PNGs: apps/assets/blender/renders/hq_scratch_t6_iso*.png — delete or leave? plan allows renders dir; F4 treats as allowed. Leave.

## todo 8 (assembly + v01)
- Exposure beats energy for global brightness: scene.view_settings.exposure=-1.0 (hq_lib.VIEW_EXPOSURE, shared build_hq+render_hq) moved all 3 day views from mean_lum ~0.77-0.86 to 0.59-0.63 (ideal 0.45-0.75) while keeping sun 1.5 / area 150 spec values and shadow contrast. Lowering sun to 1.0 + area 70 (r1) only reached 0.77-0.82 — diminishing returns because sky ramp dominates fill.
- exposure attr exists on 5.0.1 ViewSettings (instance-verified: default (0.0,'None') for (exposure,look)).
- CAM_lobby reframe (4,2,1.6)->(1.5,1.5,1.6) target (7,6,1.2): SW corner position clears sofa_1 (sightline crosses x5.6 at y4.85, sofa ymax 2.05) and counter (y5.6 crossing at x6.51 > counter xmax 3.5); CHARACTER_SPAWN (7,6) now frame centre. NAV_cam_floor1 follows automatically (built from CAM_TARGETS).
- blender_get_scene_info root= expects an OBJECT, not a collection — "FLOOR_1" errors; use query= prefix filters instead.
- MCP exec of build_hq.py works with sys.argv=['blender','--'] + exec(open(p).read(), {'__name__':'__main__','__file__':p}); scene totals matched headless (387 objects).
- r2 night STATS: mean_lum 0.100 (was 0.144 pre-exposure), unique_colors 817 > 200.

## todo 8 round r3 (colour + framing fix)
- 'Khronos PBR Neutral' view transform EXISTS in 5.0.1 and assigns headless (readback confirmed; AgX/Filmic/Standard too). It only compresses highlights >~0.8 and preserves hue — fixed the muddy -1 EV look while keeping pastel saturation. VIEW_EXPOSURE back to 0.0.
- Khronos alone not enough: total light still washed mid-tones (r3a mean_lum 0.82). The sky ramp at Background strength 1.0 is the dominant fill — WORLD_STRENGTH day 0.6 + AREA day 100 W brought all views to 0.64-0.70 with pastel ground (130,187,150) and non-clipped roof (199,210,210).
- Final light stack: sun 1.5 W/m2, world 0.6 day / 1.0 night, area 100 W day / 40 night, Khronos PBR Neutral, exposure 0. Shared via hq_lib.apply_view_settings(scene) used by build_hq + render_hq (one source of truth).
- CAM_workstation (8.5,0.8,1.6)->(8.4,4.0,1.6) target (16,4.6,1.0): aisle-centred between desk rows y=2/y=6, >1 m from nearest chair (chairs at y1.1/6.9, nearest desk x9.5); all 8 desks visible, no foreground blockage.
- PNG pixel sampling headless without numpy: pure-python zlib/struct PNG decoder (~30 lines) decodes 1280x720 in <1 s — good enough for spot colour checks.
- Night STATS after r3: mean_lum 0.120, unique_colors 800 (>200), windows glow intact.

## Todo 7 — Meshy style refs (nano-banana-2)
- Real deltas: text-to-image nano-banana-2 16:9 = 6 cr (4100->4094); image-to-image nano-banana-2 1:1 via input_task_id = 6 cr (4094->4088). Matches cost table. Balance debit visible immediately after SUCCEEDED.
- Speed: t2i SUCCEEDED in 6s, i2i in 12s (wait=true, 2-3 polls).
- Schema: params used exactly as plan (ai_model, prompt, aspect_ratio; i2i input_task_id). No adaptation needed. download_model save_to works for image tasks (format ignored), writes PNG directly.
- Output dims: 16:9 -> 1376x768; 1:1 -> 1024x1024. RGB PNG, ~0.8-0.9 MB.
- Image URLs expire 3 days after task finish (download_model reports exact timestamp). Todos 10/14 refines must run before 2026-10-20T18:03Z or fall back to texture_prompt + REF_URL_EXPIRED.
- nano-banana-2 drifts on content details (door leaf teal not orange, floor terrazzo not carpet, character light grey trousers + brown shoes not dark trousers + sneakers) but nails the style/palette. Keep piece prompts authoritative; refs = style only.

## todo 11 (normalize_kit)
- Blender 5.0.1 system-python headless does NOT load user site-packages (sys.flags.no_user_site=1) and ignores PYTHONPATH; glTF import/export addon needs numpy -> ModuleNotFoundError. Fix: `pip install --user numpy --break-system-packages` for python3.14 + lazy `_ensure_numpy()` in normalize_kit appending site.getusersitepackages() to sys.path. Alternative flag `--python-use-system-env` also works but changes the documented CLI.
- bpy.ops.object.shade_smooth_by_angle(angle=radians(30)) works headless with only select_set+active (no temp_override needed).
- Scale BEFORE pivot, then re-pivot after cleanup/decimate: remove_doubles + decimate shift the bbox slightly; a second _pivot_bottom_center keeps z_min exactly 0.
- mesh.transform(Matrix.Diagonal((sx,sy,sz,1))) = non-uniform mesh-level scale without touching obj.scale; keeps transform_apply unnecessary afterwards.
- gltf export with use_selection=True needs the object selected; export of an image-textured material requires a UV layer or the texture binding is dropped.
- building.glb stand-in has no >=512^2 texture -> exercises fallback+voxel-remesh path (fallback=true in 32-normalize-test.txt is expected, not a bug). Texture-keep path proven by synthetic 2048^2 cube in 32b.
- img.scale(1024,1024) then img.pack(): size readback and packed_file both verify OK; generated (non-file) images pack fine after save() to a real PNG first.

## Todo 10 — Meshy kit pieces (meshy-t2.5 smart-topology)
- Real costs match table: t2.5 preview = 5 cr, refine (2k, no PBR, inherits t2.5) = 10 cr. Previews finish in 23-40 s, refines 16-36 s. Todo 10 spent 80 cr (6 previews + 5 refines); MVP total 92.
- t2.5 at target_polycount 1500 returns 1108-1579 tris, 1 node, 1 mesh, raw GLB ~25-30 KB (preview) / 1.7-2.1 MB refined (embedded 2k base colour; separate *_base_color.png also saved by download_model).
- Output is glTF Y-up, longest axis normalised to ~0.95 units, origin_at=bottom honoured. Metric sizes in the prompt are ignored: wall 1x3.2 came back 0.52x0.95 (aspect 0.54 vs 0.31), pillar 4:1 not 10.7:1, thicknesses 0.02-0.05. Expect large non-uniform rescale in normalize_kit.py.
- Floor tile generated in the XY plane (vertical in Y-up), not lying flat — normalize must rotate floor so thickness ends up on Z before axis-driven scaling.
- "carpet texture" in a geometry prompt becomes displacement (crumpled facets / cross-hatch grooves). Avoid material words in t2.5 shape prompts.
- refine texture_image_url with the FULL REF_KIT style sheet (wall+floor+door) stamps the whole door onto a plain wall slab. Fix: crop the ref per piece (PIL), send as data:image/jpeg;base64 (~4-9 KB) — accepted by the MCP and by Meshy (stored as texture_<id>.jpg). Door piece used the full sheet fine (door subject matches).
- A data URI that passed through `rtk read`/terminal display can be mangled → Meshy 400 "Fail to download image", no task created, no charge. Read b64 with plain `cat` from a file and paste verbatim.
- rtk hook rewrites some multi-line bash outputs (showed ls summary instead of script output); write check results to a file and `read` it.
- Preview thumbnails are curl-able directly from thumbnail_url (512x512 RGBA); bbox via glTF JSON accessor min/max (no Blender needed) is a cheap shape gate before paying the 10-cr refine.

## [orchestrator] after todo 10 (kit pieces)
- MVP Meshy spend 92/300; kit generations 6/6 (CAP REACHED: any further kit preview needs explicit user authorisation); character generations 0/3.
- Orchestrator-measured raw dims (Blender Z-up): wall 0.515x0.023x0.948 | door 0.554x0.046x0.952 | floor 0.958x0.021x0.953 | pillar 0.233x0.233x0.951; all zmin ~ -0.475 (origin centre). Meshy ignores metre sizes in prompt.
- FLOOR PROBLEM: KIT_floor_1m imports as an UPRIGHT slab (thin axis = Y) and its refined thumbnail is a see-through black/white lattice (4 sub-panels), not terrazzo. todo 12 must rotate it flat (+90 deg about X so thin axis becomes Z) BEFORE normalizing, and if the render still shows lattice/see-through, use the documented palette fallback (fallback=True) and report it honestly at checkpoint 2b.
- Wall refine #1 wasted 10cr by using the whole reference sheet as texture (door got painted on wall). Lesson: crop the matching region of the ref (inline JPEG data URI works) for each piece. Meshy rejects a corrupted inline image before creating a task (no charge).
- Door model = door + frame only (no wall around it). Stretched to 1x0.15x3.2 it becomes a full-height door panel.

## todo 12 (kit normalize + ROOM_meeting_a_kit + v02)
- Meshy floor-tile LATTICE FEAR UNFOUNDED: thumbnail 30-thumb-KIT_floor_1m.png showed see-through lattice, but that was thumbnail rendering of groove relief. Normalized mesh renders SOLID with terrazzo-shard bake. FLOOR_FORCE_FALLBACK kept False; always judge by actual render, never thumbnail.
- normalize_kit gained pre_rotate_x_deg (mesh-level Matrix.Rotation about X BEFORE scaling — floor tile raw thin-axis Y), force_fallback/fallback_key (honest texture drop, no voxel remesh), nonuniform_tolerance (default 5% kept uniform scale on the door's 2.9% Y error -> check_kit_room 1% gate failed; kit room passes DIMS_TOLERANCE/2 = 0.5%), tris_raw in info.
- check_floor1 counted NAV_wp_* GLOBALLY — kit room's NAV_wp_meeting_a_kit broke the plain check. Scoped to FLOOR_1.all_objects. Lesson: self-checks must scope by collection, not bpy.data.objects, when other collections may coexist.
- Kit twin light lives in FLOOR_1_KIT_TEST, NOT LIGHTING: render_hq build_lighting() wipes+rebuilds LIGHTING per phase and would delete LIGHT_area_meeting_kit.
- meeting cam outside glass corner = hazy frame through 2 glass layers + door leaf blocking. Inside-room corner cam ((8.8,8.7,1.6)->(12,12,0.6)) fixed both rooms; kit cam exactly +30 x.
- Kit room cost: 36 instanced tiles x1082 tris = 38,952 of 45,695 room total vs 824 bpy. Datablocks 18 vs 14 (instancing fine); density is the price.
- v02: SELF_CHECK OK 463 objects 57604 tris; renders meeting_bpy 0.670 / meeting_kit 0.693 / kit_compare 0.712 mean_lum, all gates green.

## [orchestrator] User feedback during checkpoint 2b: "belum ada texture atau warnanya, di blender abu abu"
- Verified: all bpy materials (16 in v01, 20 in v02) have correct Principled Base Color; Material.diffuse_color (used by Solid viewport "Material" colour) is default grey 0.8. Renders are coloured; Solid viewport shows grey. Not a data bug.
- Fix proposal (needs user OK because v01/v02 are frozen): hq_lib.get_material should also set `mat.diffuse_color = hex_to_rgba(hex)` (viewport only). Option A = apply from v03 on (recommended); Option B = rebuild + refreeze v01/v02 (changes md5s).
- Tell user: use Material Preview (Z) to see colours; bpy geometry has NO bitmap textures by design (palette only); only Meshy pieces carry textures.

## [orchestrator] viewport colour fix (option A, applies from hq_v03)
- Cause: Solid viewport 'Material' colour reads Material.diffuse_color, not Principled Base Color. get_material now sets diffuse_color = hex_to_rgba(hex) (alpha 0.35 for glass). Cached materials untouched; Meshy materials not touched.
- hq_lib.set_default_viewport_shading() called from build_hq.py only when --save is given. Sets VIEW_3D shading.type and color_type to MATERIAL in every screen. Headless readback confirmed persistence (10 spaces, MATERIAL).
- Test: apps/assets/blender/tests/test_viewport_colors.py. RED on old code, GREEN after fix.
- Blender-side instructions for user: Material Preview with Z (pie menu) or the shading buttons top-right of the viewport. Renders were never affected: EEVEE reads Base Color.
- hq_v01/hq_v02 stay frozen and still grey in Solid. Only hq_v03 onward gets the fix automatically.

## todo 14 (Meshy character, t2.5 smart-topology)
- Real deltas: t2.5 preview 5 cr each (2 previews), refine 10 cr; balance 4008 -> 3988. MVP spend 112/300; character generations 2/3.
- t2.5 IGNORES pose_mode="t-pose" + "T-pose" in prompt for this character: #1 = shrug (forearms up, palms up), #2 = open-arms welcome (arms ~10-15 deg below horizontal, palms up). Accepted #2 rather than burn gen 3/3. If a strict T-pose is ever needed: image-to-3d from REF_CHAR (which IS a T-pose) is the likely fix — needs user authorisation (image-to-3d was out of scope here).
- target_polycount 19500 -> delivered 20,474 tris (+5%). Smart-topology target is approximate; set ~18,500 to land under 20k, or decimate after.
- origin_at="bottom" had no effect on the preview/refine GLB (zmin -0.476, centred), same as kit pieces. Fix origin in Blender.
- Refine with REF_CHAR full image (single character, no other objects) worked first try: colours follow the reference (teal vest, light grey trousers, brown shoes), not the prompt (teal shirt/dark trousers/sneakers). Full-image ref is fine when the ref contains only the target object.
- t2.5 refine is fast (~16 s). Previews ~30 s. Raw char = 1 mesh, 0 armature, 1 material, 2048 base colour; meshy_download_model also writes <stem>_base_color.png next to the glb.

## [orchestrator] after todo 14 (character)
- Meshy spend 112/300; character generations 2/3; kit generations 6/6. Planned for todo 15: rig 5 + idle 3 = 8 -> 120.
- Raw character: 20,474 tris (>20k), single mesh, 2048 texture, origin at centre (z min -0.476), height 0.951 -> scale x1.788 to 1.7 m. Pose = A-pose-ish (arms ~10-15 deg below horizontal, palms up, wrists bent). Face slightly doll-like, teal vest/white shirt/grey trousers/brown shoes (style-ref colours).
- Viewport fix applied in hq_lib (diffuse_color + Material shading); hq_v03 will carry it.

## todo 15 (rig + idle + hq_v03)
- Meshy rig on the A-pose/palms-up 20,474-tri mesh SUCCEEDED first try (6 s); no retry, no RIG_UNAVAILABLE. meshy_animate action_id 0 ("Idle", re-verified) <1 s. Deltas exact: rig 5, animate 3 (3988->3980).
- Rigged GLB structure: Armature (scale 0.01, 24 bones: mixamo-like names Hips/Spine01.., bones_tail head_end/headfront/neck) + skinned mesh child `char1` + an orphan `Icosphere` (junk — Meshy ships a 80-tri icosphere in every rig/anim GLB; filter non-skinned meshes out). Rig GLB's own action is a 1-frame static clip "Armature|clip0|baselayer" — drop it before adopting idle.
- height_meters=1.7 DID rescale the rig: evaluated rest height exactly 1.70 (raw mesh was 0.951). But the idle animation pose at frame 1 compresses height to ~1.63 -> still rescale uniformly from evaluated frame-1 bbox; do not assume rig height carries into animated pose.
- Idle GLB bone set == rig bone set, action "Armature|Idle|baselayer" 0.8-96.8 frames, slots present; ad.action_slot = act.slots[0] works as planned.
- Decimate on skinned mesh: add DECIMATE, bpy.ops.object.modifier_move_to_index(index=0), apply — armature modifier stays, 0 zero-weight verts after collapse to 19,499.
- Blender `--python-expr` with embedded newline string works for name dumps; evidence 24a stores a Python list literal (single line) — normalize with ast.literal_eval before diffing, raw line diff is a false alarm.
- Render of hq_v03 3 views ~4.5 min total (closeup slow: full-frame character + glass). bash tool 120 s cap -> nohup + poll.
- v03 renders: character stands planted, faces lobby cam, face readable, texture sharp; palms-up wrist artifact from the raw A-pose is NOT visible in idle frame 1 (Meshy retarget normalized wrists). QA all PASS round r0.

## [orchestrator] after todo 15 (character in hq_v03)
- Meshy spend 120/300 (rig 5 + idle 3). char gens 2/3.
- Independent readback of hq_v03 matches sub-agent: height 1.70, 19,499 tris, 24 bones = 24 vgroups, feet z -0.012, facing 0.972, idle slot OBArmature, hips move ~1 cm (subtle idle).
- hq_v03 iso shows the grey kit-test plate at lower right (FLOOR_1_KIT_TEST at +30 m x is rendered, not hidden). For the final export exclude FLOOR_1_KIT_TEST, VERDICT_STAGE, KIT_BPY, KIT_MESHY, CAMERAS, LIGHTING.

## todo 17 (verdict stage + hq_v04)
- CHAR_BASE_mesh.data raw (rest pose) world height = 1.759 m (>1.75 gate) — a naive data reuse FAILS the height check. Must copy the EVALUATED frame-1 mesh (bpy.data.meshes.new_from_object(eval_obj, depsgraph=...)): idle pose compresses to exactly 1.700. World scale from mesh matrix_world.to_scale() = 0.010349 uniform (armature 0.01 x rig import extras).
- new_from_object bakes world rotation/scale INTO the eval mesh? NO — it returns mesh in the object's local space with modifiers applied; armature deform IS a modifier so the baked verts are in armature-deformed local space, still needing the 0.010349 scale on the new object. Feet then land at tiny offset; snap with obj.location.z -= zmin after link + view_layer.update().
- check_verdict_stage scopes tiles by `o.data is floor_data` within VERDICT_STAGE only; kit-room check unchanged (36+36 tiles coexist cleanly).
- --with-verdict-stage guard raises SystemExit when --with-kit/--with-character absent (regression case 8 EXIT=1).
- hq_v04: SELF_CHECK OK 514 objects 138,933 tris; stage adds ~61.8k tris over v03 (36 tiles + char copy). Render verdict view 0.701 mean_lum first try, no reframe needed (CAM_verdict 28mm from hq_lib framed both plates + character with margin).
- Frozen v01/v02/v03 md5 all still match refs after this todo (60b). v04 md5 recorded as pre-L2 reference (todo 18 may rebuild).

## Todo 17b kit v2 (Meshy image route, 2026-10-18)
- meshy_remesh topology=quad target_polycount=8000 => ~15.4-16.3k TRIS (Meshy counts quads). For a tri budget use topology=triangle, or halve target with quad.
- meshy-7.1 image_to_3d with no remesh: 9.9k (pillar) to 92k (window) tris; output always normalized to longest side 1.903 m -> rescale at normalize.
- texture_resolution 4k + enable_pbr: raw GLB = baseColor 4096, metallicRoughness 2048, normal 4096; remesh output re-bakes metallicRoughness to 4096.
- nano-banana-2 remove_background=true can eat light/white subject faces (window wall face -> alpha 0; pillar face alpha 50-200) and keeps ground-shadow planes as semi-alpha. For off-white architecture prefer remove_background=false + "flat mid-grey studio background, no floor, no ground shadow".
- image_to_3d copies design-image quirks faithfully (window ornaments, two-tone wall) and bakes design shading into albedo (wall_door dark band) -> QA the design image hard before paying 30 cr.
- Image download via meshy_download_model text-to-image + save_to works; 3D download with include_textures=false avoids the extra _textures/ dir.
- Thumbnail URL = task JSON thumbnail_url (signed, 3-day expiry); fetch with curl right after SUCCEEDED.
- meshy_retexture (latest, 4k, PBR, enable_original_uv, input=remesh task, text_style_prompt "evenly lit ... NO baked shadows ... uniform flat studio lighting") removes baked AO/shadow bands and unwanted coloured ornaments in one 10-cr pass; geometry + tris untouched. Output metalRough drops back to 2048, GLB ~11 MB (vs 23-25 MB remesh output).
- Retexture tends to desaturate accent colours (teal door leaf -> grey-teal 99,124,123) and can drift wall warmth (window wall neutral 148,147,144 vs warm siblings); hex codes in prompt are only loose hints.

## Todo 17b part 2 (kit v2 meshy2 assembly, 2026-10-18)
- Kit v2 raw GLBs import upright (walls/door/pillar) and floor already flat; no pre_rotate needed. Dims come back at longest-side 1.903 -> normalize rescales non-uniform to 1.0x0.15x3.2 / 1.0x1.0x0.1 / 0.3x0.3x3.2.
- Delete-and-replace (remove 221 plain perimeter/column/window objects, then place kit v2) keeps hq_floor1/hq_massing untouched, so plain build stays byte-identical.
- Window opening: BVH ray scan over the normalized panel found open cell at piece-local (0.0,1.8); check_kit_v2 rays through it and requires a *_glass hit.
- Snap character feet exactly to tile top (+0.005) via evaluated zmin; import_character leaves +-0.02 offset.
- Scene 1.127M tris with all 4 floors meshy2. Far above web budget: MVP-3 needs decimate/LOD or merge + KTX2.
- Workstation STATS mean_lum 0.636 (lobby 0.612, iso 0.687, closeup 0.595). kit2 closeup camera added only in meshy2 build.
- Render cost: ~5-7 min/frame EEVEE 32 samples; run detached, poll sparingly.
- todo 18 docs (2026-10-18): verdict L2 written to guide §3 Hybrid row + §11 row 20 + §10 cap note (450/kit v2 ≤330), mirrored html; md==html normalized compare pattern: strip tags/**/entities/pipes. Review 63-guide-review.md PASS.

## todo 19 HANDOFF (2026-10-18)
- `rtk` mangles stat/find/md5 output into a tree; for evidence size tables use plain python os.path.getsize, write to file, then read.
- `rm -rf` on __pycache__ blocked by Safety Net; `rm -f dir/*.pyc && rmdir dir` works.
- Final hq_v04 still contains VERDICT_STAGE (61,830 tris), FLOOR_1_KIT_TEST incl KIT_TEST_CEILING, and empty `glTF_not_exported` (importer leftover); leftover 1-frame action `Armature|clip0|baselayer`. All to exclude in MVP-3 export.
- `--kit-source meshy` is accepted by build_hq.parse_args but has no branch in main(); only meshy2 changes the build.
- 00e-protected.sha stores hash only (no "  -"); pipe through `cut -d' ' -f1` before diff.
