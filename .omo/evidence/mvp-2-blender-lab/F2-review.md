# F2 Code Quality Review — apps/assets/blender/

Reviewer: F2 (read-only). Blender 5.0.1 headless. Date 2026-10-18.

## Per-file findings

| File | LOC | Worst fn (lines) | fns >50 | Issues |
|---|---|---|---|---|
| build_hq.py | 138 | parse_args 41 | 0 | engine set `except TypeError: pass`, no engine readback print (view transform readback OK via apply_view_settings) |
| hq_lib.py | 443 | get_material 36 | 0 | `except RuntimeError: pass` in get_collection (commented: already linked — benign); `except TypeError: pass` on surface_render_method (hasattr-guarded, fallback benign); run_self_checks re-raises AssertionError (good) |
| hq_massing.py | 278 | build_exterior / _make_tree 35 | 0 | none |
| hq_floor1.py | 387 | _build_meeting 40 | 0 | negative hook HQ_INJECT_MISSING_NAV env-gated (OK) |
| hq_furniture.py | 203 | make_monitor 33 | 0 | negative hook HQ_TEST_BREAK_DESK env-gated (OK) |
| hq_lighting.py | 191 | build_lighting 35 | 0 | hasattr guards for eevee/sun attrs; node lookup by `.type` |
| hq_kit_room.py | 496 | check_verdict_stage 52 | 1 | 4 LOC under 500 soft cap — next addition breaches; hooks HQ_INJECT_BAD_KIT_TILE / HQ_INJECT_BAD_STAGE env-gated |
| hq_kit2.py | 440 | check_kit_v2 72 | 1 | check_kit_v2 long; constants named + commented |
| normalize_kit.py | 361 | normalize_kit_piece 62 | 1 | `except ModuleNotFoundError` falls back to user site (handled, not swallowed) |
| import_character.py | 488 | check_character 104 | 2 | biggest offender (104 lines); _import_static 53; near 500 cap; hook HQ_INJECT_BAD_CHAR_HEIGHT env-gated |
| render_hq.py | 201 | parse_args 51 | 1 | engine set `except TypeError: pass`, no engine readback |
| tests/test_furniture.py | 90 | main 39 | 0 | 6 asserts, bbox/behavior checks |
| tests/test_normalize_kit.py | 209 | build_textured_cube_glb 31 | 0 | 21 asserts (texture downscale, tris cap, upright, v1 defaults) |
| tests/test_viewport_colors.py | 54 | main 24 | 0 | 6 asserts (palette colors w/ tolerance, glass alpha, cache identity) |

Total 3979 LOC. No file >500; none near 1000.

## Global checks

- `ast.parse` all 14 files: exit 0.
- `grep /home/`: 0 hits.
- Secrets: no os.environ printing; `environ` only reads HQ_* test-hook flags; "token" hits are CLI arg parsing only.
- Identifiers: English throughout.
- Shader nodes looked up by `.type` (`BSDF_PRINCIPLED`, `TEX_IMAGE`, generic node_type) — no name lookups.
- Blender 5 renames hasattr-guarded: surface_render_method/blend_method, use_transparent_shadow, taa_render_samples, use_shadows, use_shadow_jitter, exposure, action_slot.
- View transform: try/except loop with fallbacks (Khronos PBR Neutral → AgX → Standard) + readback print. 
- Collections: get_collection never clears; single clear path clear_project_collections (idempotent rebuild).
- Broad/bare except: none bare. 6 typed excepts, all judged benign (listed above); none hide build failures.
- Negative hooks: only via CLI flags (--inject-*) or HQ_* env vars.

## Tests run (this review)

`PYTHONDONTWRITEBYTECODE=1 blender -b --python-exit-code 1 -P apps/assets/blender/tests/<t>.py`
- test_furniture → `FURNITURE OK`, 0 tracebacks
- test_normalize_kit → `NORMALIZE_EXTRA OK`, 0 tracebacks
- test_viewport_colors → `VIEWPORT_COLORS OK`, 0 tracebacks
(Success markers print after all asserts; consistent with E/65c-regression.txt EXIT=0.) __pycache__: none remaining. No .blend touched.

## Blocking issues

None.

## Non-blocking notes

1. `render.engine = "BLENDER_EEVEE"` in build_hq.py:79 and render_hq.py:124 swallows TypeError with no readback; add `print(f"ENGINE {scene.render.engine}")` after the try so a silent fallback is visible. Also duplicated `_configure_scene`/`configure_scene` — could live in hq_lib next to apply_view_settings.
2. Long functions: import_character.check_character 104, hq_kit2.check_kit_v2 72, normalize_kit.normalize_kit_piece 62, import_character._import_static 53, hq_kit_room.check_verdict_stage 52, render_hq.parse_args 51. Split check_* into per-assertion helpers when next touched.
3. hq_kit_room.py (496) and import_character.py (488) sit at the 500 soft cap; split before adding features.

RESULT: PASS
