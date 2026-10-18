# QA — todo 6 render smoke (iso), scratch blend /tmp/hq_scratch_t6.blend

PNG: apps/assets/blender/renders/hq_scratch_t6_iso.png (1280 x 720, 8-bit RGBA)

STATS iso mean_lum=0.856 red_ratio=0.002 unique_colors=1368

Observed by reading the PNG (read tool):
- Scene visible: 4-floor white building, iso angle, clearly silhouetted.
- Window grid visible on all three visible facades (floors 2-4), light blue glass.
- Red SIGN_redhunter visible on the roof-level front facade; small, not dominant (red_ratio 0.002).
- Green ground plane, grey road with lighter sidewalks crossing lower-left.
- Trees visible: round-crown (icosphere) and cone-style, brown trunks.
- Sun shadow cast to the right/front of the building; soft edge (shadow jitter).
- Floor 1 open (no interior walls yet — hq_floor1 is todo 4, not in this scratch);
  area-light glow visible under the Floor-2 slab, as intended.
- No blur/noise; flat palette shading as per guide.

Gate check: 0.15 < 0.856 < 0.9 PASS; 0.002 < 0.08 PASS; 1368 > 200 PASS.

Tuning deviation: SUN_main day energy 1.5 W/m² (plan suggested 4.0). At 4.0 the
near-white exterior walls clipped under the Standard view transform
(mean_lum 0.944 > 0.9 gate, first run in 18-render-smoke.txt history). Area
lights kept at spec 150 W. Gates unchanged.

## Night smoke (18b)
PNG: apps/assets/blender/renders/hq_scratch_t6_iso_night.png
STATS iso mean_lum=0.144 red_ratio=0.000 unique_colors=1195
Read via read tool: dark navy sky, building silhouette, all windows glowing warm
(#FFF3C4 emission strength 2.0), area-light pool under Floor-2 slab, trees dark.
unique_colors 1195 > 200 PASS (night gate); mean_lum 0.144 < 0.15 as expected.
Night sun tuned 0.7 -> 0.02 (sky ramp strength 1.0 alone lifts frame to ~0.145;
spec 0.7 with day-scale sun gave 0.205).
