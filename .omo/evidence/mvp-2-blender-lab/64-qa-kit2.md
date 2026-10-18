# QA kit v2 (hq_v04 meshy2 build)

Renders: renders/hq_v04_kit2_{iso,lobby,workstation,closeup}.png. STATS: iso mean_lum 0.687 / lobby 0.612 / workstation 0.636 / closeup 0.595, red_ratio 0.000 all, unique_colors 2996 / 7588 / 5996 / 3626. All gates (0.15<lum<0.9, red<0.08, colors>200) PASS.

| check | result | evidence |
|---|---|---|
| walls read as kit v2 panels on all floors | PASS (Floor 1 lobby/workstation read KIT2 wall panels; 138 wall_1m instances over F1-F4) | CHECK_KIT_V2 counts |
| windows have glass + frames | PASS (134 window panels, each with KIT2_glass_pane; check_kit_v2 ray through opening hits glass) | renders show dark frames + mullion + glass |
| floor terrazzo visible | PASS (1048 tiles; workstation/closeup show terrazzo chips, grout lines) | hq_v04_kit2_workstation.png |
| door panels at room doors | PASS (door_f1_s, door_f1_w, door_f1_meeting; 3 wall_door instances) | build log |
| pillars | PASS (36 column instances F2-F4, pillar kit, teal plinth) | CHECK_KIT_V2 |
| no visible joint gaps / z-fight | PASS at render scale (workstation floor and wall base show no flicker); not inspected at pixel level | workstation PNG |
| character feet above tiles | PASS (feet_z 0.0050 = tile top; was -0.0071 before exact snap) | CHECK_CHARACTER |
| stair void clear | PASS (check_kit_v2 rejects tiles/walls in STAIR void x16-19 y9-13) | build log |
| exterior iso coherent | PASS (iso render shows building + ground) | iso PNG |
| tri total | 1,127,156 (SELF_CHECK), budget 1,500,000 PASS. Note: far above a web budget. MVP-3 must decimate, LOD or merge + KTX2. | build log |
| texture memory estimate | 5 kit v2 GLBs x (base 4096^2 + normal 4096^2 + metalRough 2048^2 or 4096^2) x 4 B. Kit: ~5 x (64 MiB + 64 MiB + 16..64 MiB) ~ 0.6-0.7 GiB uncompressed. Estimate only, not measured. | calc |

FLAGS (honest, not fixed in this pass):
- door leaf is grey-teal, not the brief teal (retexture drift, see 64a).
- window wall is slightly cool grey vs warm siblings.
- tri count 1.13M; scene is heavy for web use.
- texture memory ~0.6-0.7 GiB uncompressed, needs KTX2/downscale before web.

RESULT: PASS (all rows PASS; flags above are known material/perf issues carried to MVP-3, not render failures).
