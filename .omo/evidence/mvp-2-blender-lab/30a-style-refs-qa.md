# 30a — Style reference images QA (todo 7)

Model: nano-banana-2 (Meshy-hosted). Judged against guide §4 anti-patterns: reject photo-realistic / noisy / blurry; want stylized mid-poly, crisp hand-painted, pastel office palette.

## style_reference_kit.png — REF_KIT_TASK_ID=01a14b08-42ed-73ed-ac01-428d651660b7

File: PNG 1376x768 RGB, 808401 B. text-to-image 16:9, 6 cr.

What I see: three objects side by side on an off-white seamless background with soft contact shadows.
- Left: cream wall panel (≈#FFF8F0) with a horizontal chair-rail moulding and a teal (#4DB6AC-ish) baseboard strip. Flat colours, clean bevels.
- Middle: square floor tile, warm light grey (≈#D9D4CB) terrazzo with small scattered orange, teal, grey and white chips. Chips are crisp flat shapes, deliberate pattern, not grain noise.
- Right: door unit: soft orange (#FFB74D-ish) thick frame, teal panel door with recessed panel, round porthole window, silver lever handle; small red (#E53935) keyhole and hinge accents only.

| Check | Result | Reason |
|---|---|---|
| Stylized, not photo-realistic | PASS | Toy-like clay/hand-painted look, simplified forms, chunky bevels |
| No noise / no blur | PASS | Edges sharp, surfaces flat-shaded; terrazzo chips are clean vector-like dots |
| Palette match (cream/grey/orange/teal) | PASS | All four main colours present and pastel |
| Red accent not dominant | PASS | Red only on keyhole + 2 tiny hinges |
| White background, centered | PASS | Off-white seamless, objects evenly spaced |

Content notes (not style failures): door leaf is teal with orange frame, whereas `KIT_wall_door` prompt asks for an orange wooden door; floor is terrazzo, whereas `KIT_floor_1m` asks for grey carpet. Use as style/palette reference only; piece prompts stay authoritative for shape/material.

Verdict: **PASS**. Regenerate: **no** (0/1 used).

## style_reference_character.png — REF_CHAR_TASK_ID=01a14b08-ffc1-73fd-b32a-88cb613bdd2e

File: PNG 1024x1024 RGB, 907529 B. image-to-image 1:1 from REF_KIT, 6 cr.

What I see: single adult male office worker, full body, front view, clean T-pose (arms horizontal, palms down), on off-white background with a soft floor shadow. Short dark hair, simple face with modeled dot eyes, brows, small smile. Teal knit sweater vest over light grey collared long-sleeve shirt with rolled cuffs, light grey trousers with cuffed hems showing speckled lining, brown leather lace-up shoes, small brown wristwatch and ring. Proportions realistic-stylized (≈7 heads), not chibi.

| Check | Result | Reason |
|---|---|---|
| Stylized, not photo-realistic | PASS | Smooth clay/3D-toy rendering, simplified anatomy and face |
| No noise / no blur | PASS | Crisp silhouette; vest knit is a fine regular pattern, not grain |
| Palette match | PASS | Teal accent dominant on torso, cream/grey neutrals, warm brown shoes |
| Red accent not dominant | PASS | No red present |
| T-pose, full body, white bg | PASS | Matches todo 14 rig requirement (pose_mode t-pose) |
| Consistent with REF_KIT style | PASS | Same soft lighting, same teal, same matte toy finish |

Content notes (not style failures): trousers are light grey (CHARACTER prompt says dark trousers) and shoes are brown leather (prompt says sneakers). CHARACTER prompt stays authoritative for todo 14; this image is a texture style reference.

Verdict: **PASS**. Regenerate: **no** (0/1 used).

## Spend

| call | task_id | before | after | delta |
|---|---|---|---|---|
| 1 text-to-image | 01a14b08-42ed-73ed-ac01-428d651660b7 | 4100 | 4094 | 6 |
| 2 image-to-image | 01a14b08-ffc1-73fd-b32a-88cb613bdd2e | 4094 | 4088 | 6 |

Todo 7 total: 12 cr (cap 24). Regenerates used: 0.
