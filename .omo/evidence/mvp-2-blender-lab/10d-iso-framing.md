# todo-3 fix: iso framing (DEFECT B)

Before: CAM_TARGETS["iso"] = ((34,-22,26),(10,7,2),"ORTHO",44) — roof edge cropped at frame top, building sat high (seen in hq_scratch_t6_iso.png).

After: ((34,-22,26),(10,7,5.5),"ORTHO",50). Same diagonal direction; target z 2->5.5 (building mid-height), ortho_scale 44->50 (building diagonal ~24.4m + margin at 16:9).

Render /tmp/orch_fix_renders/hq_scratch_t3fix_iso.png (read with read tool):
- full roof edge inside frame with margin top
- SIGN_redhunter visible on front facade
- 3 window bands (floors 2-4; floor 1 has no walls until todo 4)
- ground, road, sidewalk, trees visible on all sides
- trees correct after DEFECT A fix: brown trunks, green crowns

STATS iso mean_lum=0.853 red_ratio=0.002 unique_colors=1275 (all gates pass; lum near 0.9 ceiling — sun retune deferred to todo 8 per orchestrator).
