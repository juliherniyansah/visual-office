# 51 — todo 14 character generation (Meshy t2.5 smart-topology)

Precondition: `grep -c USER_APPROVED_2B 45-checkpoint-2b.md` = 1 (user verbatim "lanjut A").

## Tasks
| step | task_id | credits | result |
|---|---|---|---|
| preview #1 | 01a14d19-6965-719d-b548-9b6355d96b5b | 5 | REJECTED — thumb 50-char-thumb-1.png / -1-alpha.png |
| preview #2 | 01a14d1a-a962-718d-8736-36d1acd6dfbc | 5 | ACCEPTED (with pose flag) — thumb 50-char-thumb-2.png / -2-alpha.png |
| refine (of #2) | 01a14d1c-0f98-77e9-8eb6-20472a0d379d | 10 | ACCEPTED — thumb 50-char-thumb-refined.png; file apps/assets/raw/meshy/char_base_raw.glb |

Params (both previews): prompt = PROMPTS.md CHARACTER verbatim, model_type=smart-topology, ai_model=meshy-t2.5, target_polycount=19500, pose_mode=t-pose, origin_at=bottom, target_formats=[glb], alpha_thumbnail=true.
Refine: inherit t2.5 (ai_model omitted), texture_image_url = fresh REF_CHAR (01a14b08-ffc1-73fd-b32a-88cb613bdd2e) image_urls[0] (ref valid until ~2026-10-20T18:04Z, not expired), texture_resolution=2k, enable_pbr=false, no texture_prompt.

Character generations used: **2 / 3**. Credits: 4008 -> 3988 (delta 20 = 5+5+10). MVP cumulative spend 112 / 300 (ledger rows 14-16, all reconcile).

## What the thumbnails actually show
- **#1 (rejected):** untextured grey humanoid man, face with nose/eyes/mouth, short side-parted hair, collared shirt, trousers, shoes, feet on ground. Pose = SHRUG: upper arms down ~45 deg, elbows bent, forearms pointing UP, palms up. Not a T-pose -> unusable for rigging.
- **#2 (accepted):** same style man, face OK, feet on ground, no extra limbs/props. Pose = "open-arms welcome": arms out to the sides, slightly drooping (between A- and T-pose), elbows almost straight, wrists bent so palms face UP and fingers curl up. Closest usable result; accepted instead of spending the last generation (3/3) on the same prompt with an uncertain outcome.
- **refined:** textured. Short dark hair, cream skin, face with eyes + smiling mouth (slightly smeared/doll-like, readable at office-camera distance). Teal V-neck vest with chest pocket and white buttons over white long-sleeve collared shirt, light grey trousers with white belt, white rolled cuffs/socks, brown shoes, dark wristband on left wrist. Colours follow the style reference (teal vest / grey trousers / brown shoes), NOT the prompt text (teal shirt / dark trousers / sneakers) — expected, reference wins. No visible texture defects in the thumbnail.

## Raw model (Blender 5.0.1 headless probe, glTF importer, Z-up after import)
Probe: `/tmp/opencode/t14/probe_char.py`, `blender -b --python-exit-code 1`, EXIT=0.
- file: 3,562,972 B (3.40 MB) + extracted texture `apps/assets/raw/meshy/char_base_raw_base_color.png` 2048x2048 RGB (4.7 MB)
- objects: 1 mesh (`Mesh_0`), 0 armatures, 1 material (`Material_0`), 1 image 2048x2048
- dims (x,y,z): 0.7974 x 0.2070 x 0.9507 (arm span x depth x height); min z -0.4758, max z 0.4749 -> **origin at centre, origin_at=bottom had no effect**
- tris: **20,474** (verts 20,860) — **OVER the 20k budget by 474**; Meshy overshot target_polycount 19500 by 5%
- hand tips at z = 0.758 x height; arm span / height = 0.839 (true T-pose ~1.0, hands ~0.82 height) -> arms ~10-15 deg below horizontal

## Acceptance
- `test -s char_base_raw.glb` -> 0
- glTF magic check -> 0
- ledger reconcile: 18 rows, 0 bad, total 112 <= 300
- generations 2 <= 3
- PASS (with flags below)

## For todo 15 (must handle)
1. Tris 20,474 > 20,000: decimate (Collapse ~0.96) or limited-dissolve to <= 19,800 before rigging.
2. Pose is open-arms/A-T hybrid with palms-up bent wrists, not a strict T-pose: auto-riggers (Mixamo/Meshy rig) accept A-pose, but expect wrist/hand weights to need a check; bind pose rest wrists are rotated.
3. Origin is mesh centre (z from -0.476): move origin to feet (z min = 0) then scale height 0.9507 -> 1.70 m (factor ~1.788).
4. Single mesh, no armature, 1 material, 2k base colour only (no PBR maps).

## todo 15 — rig + idle (Meshy)
| step | task_id | credits | result |
|---|---|---|---|
| rig (height 1.7) | 01a14d22-2671-70fa-b382-21aa910c2328 | 5 | SUCCEEDED 6s; rigged GLB 4,283,216 B + walk/run GLBs (free); 51c-rig-urls.txt |
| animate idle (action_id 0) | 01a14d23-6cf3-76c6-bd63-5802c870ea97 | 3 | SUCCEEDED <1s; char_idle.glb 4,342,096 B; 51c-anim-urls.txt |

Idle lookup re-verified at run time: key "Idle" == action_id 0, DailyActions/Idle (51b-idle-lookup.json). Credits 3988 -> 3980 (delta 8 = 5+3), MVP spend 120/300 (ledger rows 17-18 reconcile). Rig did NOT fail on the A-pose/palms-up mesh — no retry needed, no RIG_UNAVAILABLE.

## Import results (hq_v03)
- mode=rigged (character_mode.txt), decimate COLLAPSE 20,474 -> 19,499 tris (ratio 0.952, modifier moved to index 0 before apply), zero-weight verts after decimate: 0, vertex_groups 24 == bones 24.
- Armature import scale 0.01 (Meshy cm rig); rig height already 1.70 m evaluated at frame 1 BUT frame 1 of the idle action compresses pose height to ~1.63, so _place_and_scale rescaled armature by 1.7/1.63 => evaluated height 1.700, feet_z -0.0121 (within ±0.02 after z offset).
- idle action "Armature|Idle|baselayer" renamed `idle`, 96 frames, slot assigned (action_slot), scene.frame_end 96; hips motion proof passed.
- facing_dot 0.972 toward CAM_lobby; both ray_cast probes (z 0.9/1.5) hit CHAR_BASE_mesh.
