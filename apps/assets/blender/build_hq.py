"""Build the RedHunter HQ scene end-to-end (Floor 1 detailed, floors 2-4 shell).

Headless: blender -b --python-exit-code 1 -P build_hq.py -- --save <path> --check
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from hq_lib import (  # noqa: E402
    apply_view_settings,
    clear_project_collections,
    get_collection,
    make_box,
    reset_startup_scene,
    run_self_checks,
    set_default_viewport_shading,
)
from hq_massing import build_exterior, build_massing  # noqa: E402
from hq_floor1 import build_floor_1, build_kit_bpy  # noqa: E402
from hq_kit_room import (  # noqa: E402
    build_kit_meshy,
    build_room_meeting_kit,
    build_verdict_stage,
)
from hq_lighting import build_cameras, build_lighting  # noqa: E402
from import_character import build_characters  # noqa: E402


def parse_args(argv):
    """Parse tokens after Blender's `--` separator."""
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    args = {
        "save": None,
        "check": False,
        "with_kit": False,
        "with_character": False,
        "with_verdict_stage": False,
        "kit_source": "bpy",
        "inject_bad_col": False,
        "inject_missing_nav": False,
    }
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--save":
            i += 1
            args["save"] = argv[i]
        elif token == "--check":
            args["check"] = True
        elif token == "--with-kit":
            args["with_kit"] = True
        elif token == "--with-character":
            args["with_character"] = True
        elif token == "--with-verdict-stage":
            args["with_verdict_stage"] = True
        elif token == "--kit-source":
            i += 1
            if argv[i] not in ("bpy", "meshy", "meshy2"):
                raise SystemExit(f"invalid --kit-source {argv[i]}")
            args["kit_source"] = argv[i]
        elif token == "--inject-bad-col":
            args["inject_bad_col"] = True
        elif token == "--inject-missing-nav":
            args["inject_missing_nav"] = True
        else:
            raise SystemExit(f"unknown arg {token}")
        i += 1
    return args


def _configure_scene(scene):
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    apply_view_settings(scene)
    if bpy.app.background:
        bpy.context.preferences.filepaths.save_version = 0


def _inject_bad_col():
    """Test hook: renderable COL_* so check_col_hide_render must fail."""
    coll = get_collection("FLOOR_1")
    make_box(
        "COL_injected_bad", (1.0, 1.0, 1.0), (0.0, 0.0, 0.0), None, coll
    )  # hide_render left False on purpose


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv)
    reset_startup_scene()
    clear_project_collections()
    _configure_scene(bpy.context.scene)
    build_exterior()
    build_massing()
    build_kit_bpy()
    build_floor_1()
    build_lighting("day")
    build_cameras()
    if args["kit_source"] == "meshy2":
        from hq_kit2 import apply_kit_v2, build_kit_meshy_v2

        build_kit_meshy_v2()
        apply_kit_v2()
    if args["with_kit"]:
        build_kit_meshy()
        build_room_meeting_kit()
    if args["with_character"]:
        build_characters()
        if args["kit_source"] == "meshy2":
            from hq_kit2 import snap_character_to_tiles

            snap_character_to_tiles()
    if args["with_verdict_stage"]:
        if not (args["with_kit"] and args["with_character"]):
            raise SystemExit(
                "--with-verdict-stage requires --with-kit --with-character"
            )
        build_verdict_stage()
    if args["inject_bad_col"]:
        _inject_bad_col()
    if args["inject_missing_nav"]:
        os.environ["HQ_INJECT_MISSING_NAV"] = "1"
    if args["check"]:
        run_self_checks()
    if args["save"]:
        set_default_viewport_shading()
        bpy.ops.wm.save_as_mainfile(filepath=str(args["save"]))


if __name__ == "__main__":
    main()
