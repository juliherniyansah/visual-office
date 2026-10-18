# issues

## todo 1 deviations
- §1 MUST NOT 4 html <li> has no MUST NOT prefix (pre-existing); mirrored text only.
- §4 Konsistensi interior "tetap flat-shaded" is a list item, replaced only `whiteboard, sofa), tetap flat-shaded`.
- md: 16 anchor replacements = 17 review cells (Style description+reason in one row edit).

## todo 3 deviations
- hq_lib.py 381 LOC > 300 soft target (spec-mandated constants + 4 base checks); within 500 hard cap.
- Plan says engine try/except TypeError only; also catching ValueError on view_transform (defensive, orchestrator facts allow).
- Windows: plan "every 2 m" implemented as centres at odd x/y 1..19 / 1..13 (10+10 per long facade, 7+7 short, 34/floor) width 1.4 m — plan did not fix width; 1.4 chosen to leave 0.6 m gaps.
- Tree styles: i 1..5 round (icosphere), 6..10 cone per plan "5 round / 5 cone".

## todo 5 deviations
- make_monitor: plan says stand cylinder h0.2, but panel bottom sits at z 0.835 (centre z 1.0, height 0.33); h0.2 stand leaves a floating panel. Stand extended to h0.815 (foot top 0.02 -> panel bottom) so geometry connects. Heights/tris unaffected (top 1.165 in 1.15-1.4; 54 <= 60 tris).
- make_chair: plan sketch "5-spoke base" approximated as one 8-seg disk cylinder r0.25 h0.03 (as plan's own geometry line specifies) — no separate spokes; 80 tris < 120 cap.

## todo 8 deviations
- MCP parity: get_scene_info(root="FLOOR_1") errored (root= wants an object; FLOOR_1 is a collection). Substituted query= prefix reads (ROOM_/COL_/NAV_/TASK_) with same fields/limit — recorded in 21-mcp-floor1.txt.
- Lighting tune uses view_settings.exposure=-1.0 (hq_lib.VIEW_EXPOSURE) instead of lowering spec light energies; sun 1.5 (todo 6 value), area 150 (plan spec) retained. Gates untouched.
- CAM_lobby + its target changed in CAM_TARGETS (allowed by todo 8); other keys untouched.

## todo 8 r3 deviations
- VIEW_EXPOSURE kept as constant (0.0) + VIEW_TRANSFORM/'fallbacks' + apply_view_settings() added to hq_lib (shared view config; replaces per-file duplicates in build_hq/render_hq configure).
- WORLD_STRENGTH dict added to hq_lighting (day 0.6 deviates from plan's implicit strength 1.0; reason: sky ramp was dominant fill washing mid-tones; night stays 1.0 so night look unchanged).
- AREA day 100 W (spec 150): required to keep interiors <=0.75 mean_lum under Khronos.
- MCP parity not rerun in r3 (only constants changed); settings-only re-check recorded in 21-mcp-floor1.txt addendum.

## todo 12
- Modified accepted module hq_floor1.py (1 line): check_floor1 NAV_wp_* count used bpy.data.objects (global) — any later collection adding NAV_wp_* broke the plain build. Scoped to FLOOR_1. Forced by real bug: plain --check still green (387 objects), names diff vs 24a empty.
- Modified accepted module normalize_kit.py: added opt-in params (pre_rotate_x_deg, force_fallback, fallback_key, nonuniform_tolerance, tris_raw in info). Defaults preserve old behaviour; old tests still pass unchanged semantics (tris_raw added to info dict only).
- hq_lib.py CAM_TARGETS meeting_bpy/meeting_kit reframed (allowed by todo spec); other entries untouched.
- Meshy door leaf stretched to 3.2 m full height (no transom) — nonstandard proportions, honest flag for checkpoint 2b.

## todo 17
- Verdict frame cosmetics (accepted per plan): road + kit-test room shed visible at frame right edge behind the bpy plate; building fills top half. Plan calls these cosmetic.
- Stage character is a FULL static mesh copy (19,499 tris) — remember VERDICT_STAGE excluded from MVP-3 export.

## [2026-10-18T10:16:32+00:00] FALSE BOULDER COMPLETE fired again (F4 [~] counted as done). boulder.json reset to active. MVP-2 NOT closed: waiting human okay.
