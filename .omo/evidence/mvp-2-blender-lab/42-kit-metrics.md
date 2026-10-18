# Kit metrics — todo 12 (hq_v02)

Source JSON: apps/assets/blender/renders/kit_metrics.json

## Per piece (raw Meshy GLB -> normalized KIT_meshy_*)

| piece | bpy name | meshy name | tris raw | tris norm | texture | fallback | smooth | nonuniform | notes |
|---|---|---|---|---|---|---|---|---|---|
| wall_1m | KIT_wall_1m | KIT_meshy_wall_1m | 1542 | 1500 | 1024x1024 | no | yes | yes | 0.515x0.023x0.948 -> 1x0.15x3.2; thickness x6.5 stretch |
| wall_door | KIT_wall_door | KIT_meshy_wall_door | 1414 | 1407 | 1024x1024 | no | yes | yes | door+frame only, leaf stretched to full 3.2 m height |
| floor_1m | KIT_floor_1m | KIT_meshy_floor_1m | 1108 | 1082 | 1024x1024 | no | yes | yes | pre_rotate_x_deg=90 (raw upright, thin axis Y); solid in render, lattice fear unfounded |
| pillar | KIT_pillar | KIT_meshy_pillar | 1540 | 1290 | 1024x1024 | no | yes | yes | aspect 4:1 -> 10.7:1 stretch; unused in room (KIT_UNUSED_OK) |

All textures downscaled 2048 -> 1024 and packed. No MISSING pieces, no palette
fallback, no QUALITY_FAIL (all tris <= 1500 gate green).
Nonuniform=yes everywhere is expected and honest: Meshy t2.5 ignores metric sizes
in prompts (longest axis normalized ~0.95), so strong per-axis snap was required.

## Room totals (from hq_v02.blend, evaluated depsgraph)

| room | tris | unique mesh datablocks (draw-call proxy) |
|---|---|---|
| ROOM_meeting_a (bpy, FLOOR_1 meeting objects) | 824 | 14 |
| FLOOR_1_KIT_TEST (whole kit test room) | 45,695 | 18 |

Kit room tris dominated by instanced Meshy pieces: 36 floor tiles x 1082 =
38,952 + walls/door ~4,407 + slabs/furniture. Datablock counts comparable
(14 vs 18) — instancing works; the cost is per-piece density (1082-1500 tris vs
12 tris for a bpy box), ~55x tri cost for the visual upgrade.

## Meshy credits (ledger .omo/evidence/mvp-2-blender-lab/meshy-ledger.md)

- Kit spend (todo 10, rows 3-13): **80 credits** (6 previews x5 + 5 refines x10).
- This todo (12): **0 credits** (no Meshy calls).
- Whole MVP so far: **92/300** (12 style refs + 80 kit).
- Kit generations 6/6 used (cap reached; regeneration needs user authorization).
