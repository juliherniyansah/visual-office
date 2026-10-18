# 16c monitor-on-desk fix

Defect: monitors floated ~0.8 m above desks in integrated Floor 1 render.
Cause: make_monitor was floor-origin (foot z0, stand to 0.835, panel
0.835-1.165) while hq_floor1 _build_workstation placed it at
z = DESK_SIZE[2] = 0.77 -> whole monitor lifted 0.77 m.

## Change
- hq_furniture.make_monitor(..., on_desk=False): new kw.
  - on_desk=False (default): unchanged floor variant, top 1.165, 54 tris.
  - on_desk=True: desk-surface origin. foot z 0..0.02, stand r0.02
    z 0.02..0.10 (h 0.08), panel 0.55x0.03x0.33 z 0.10..0.43, screen quad
    centred z 0.265 on -Y face. Same 2 material slots, one object.
- tests/test_furniture.py: new case monitor_desk (on_desk=True) top
  0.40-0.46, tris <= 60.
- hq_floor1.py: monitor call -> on_desk=True at z=0.77 (desk top slab is
  0.73-0.77, correct); _stub_box build() accepts **kw.

## Before/after (on-desk variant)
| | before | after |
|---|---|---|
| origin | floor | desk surface |
| placed at z | 0.77 (floor builder -> float) | 0.77 on_desk=True |
| panel span (local z) | 0.835-1.165 | 0.10-0.43 |
| bbox height | 1.165 | 0.430 |
| tris | 54 | 54 |

## Verification
- test_furniture: FURNITURE OK, EXIT=0 (10 cases incl. monitor_desk
  0.550 x 0.150 x 0.430 m, 54 tris).
- negative HQ_TEST_BREAK_DESK=1: EXIT=1, AssertionError desk height 1.500.
- /tmp/orch_int.py rebuild: SELF_CHECK OK 387 objects 6630 tris, EXIT=0.
- Render /tmp/orch_fix_renders/hq_orch_int_mfix_workstation.png:
  STATS workstation mean_lum=0.807 red_ratio=0.000 unique_colors=3699
  (mean_lum 0.807 noted; lighting gate is todo 8's concern.)

## Image
All visible workstation monitors sit ON their desks: foot touching the
desk top, short stand, panel just above the surface. Front and back rows
correct, rotated back-row monitors too. No floating poles. Red stair
accent and teal chairs render as before.
