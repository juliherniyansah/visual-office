"""Headless render + objective stats for the RedHunter HQ.

Usage:
  blender -b <blend> --python-exit-code 1 -P render_hq.py -- \
      --views iso,lobby --out apps/assets/blender/renders \
      [--phase day|night] [--res 1280x720] [--samples 32] [--tag rK] \
      [--hide COLL1,COLL2] [--no-gate]

Never saves the blend. Never imports build_hq.
"""

import array
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from hq_lib import REPO_ROOT, apply_view_settings  # noqa: E402
from hq_lighting import build_lighting  # noqa: E402

GATE_LUM_MIN = 0.15
GATE_LUM_MAX = 0.9
GATE_RED_MAX = 0.08
GATE_COLORS_MIN = 200
RED_TARGET = (0.898, 0.224, 0.208)  # #E53935 as display sRGB floats
RED_DELTA = 0.12
PIXEL_STRIDE = 16


def parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    args = {
        "views": [],
        "out": None,
        "phase": "day",
        "res": (1280, 720),
        "samples": 32,
        "tag": None,
        "hide": [],
        "no_gate": False,
    }
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--views":
            i += 1
            args["views"] = [v for v in argv[i].split(",") if v]
        elif token == "--out":
            i += 1
            args["out"] = argv[i]
        elif token == "--phase":
            i += 1
            if argv[i] not in ("day", "night"):
                print(f"invalid --phase {argv[i]}")
                sys.exit(2)
            args["phase"] = argv[i]
        elif token == "--res":
            i += 1
            w, _, h = argv[i].partition("x")
            args["res"] = (int(w), int(h))
        elif token == "--samples":
            i += 1
            args["samples"] = int(argv[i])
        elif token == "--tag":
            i += 1
            args["tag"] = argv[i]
        elif token == "--hide":
            i += 1
            args["hide"] = [c for c in argv[i].split(",") if c]
        elif token == "--no-gate":
            args["no_gate"] = True
        else:
            print(f"unknown arg {token}")
            sys.exit(2)
        i += 1
    if not args["views"] or args["out"] is None:
        print("usage: --views a,b --out <dir> required")
        sys.exit(2)
    return args


def compute_stats(path):
    """Load a rendered PNG and compute mean_lum / red_ratio / unique_colors.

    Copies the pixel buffer ONCE via foreach_get (per-element Image.pixels[i]
    copies the whole buffer each access), then strides every 16th pixel.
    Values are display sRGB floats 0-1 (byte PNG, not linearised).
    """
    img = bpy.data.images.load(path)
    try:
        w, h = img.size
        px = array.array("f", bytes(4 * w * h * 4))
        img.pixels.foreach_get(px)
        lum_sum = 0.0
        red_count = 0
        sampled = 0
        colors = set()
        rt_r, rt_g, rt_b = RED_TARGET
        for p in range(0, w * h, PIXEL_STRIDE):
            base = p * 4
            r = px[base]
            g = px[base + 1]
            b = px[base + 2]
            lum_sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
            if (abs(r - rt_r) < RED_DELTA and abs(g - rt_g) < RED_DELTA
                    and abs(b - rt_b) < RED_DELTA):
                red_count += 1
            colors.add((int(r * 255), int(g * 255), int(b * 255)))
            sampled += 1
        return {
            "mean_lum": lum_sum / sampled,
            "red_ratio": red_count / sampled,
            "unique_colors": len(colors),
        }
    finally:
        bpy.data.images.remove(img)


def configure_scene(scene, args):
    try:
        scene.render.engine = "BLENDER_EEVEE"
    except TypeError:
        pass
    apply_view_settings(scene)
    scene.render.resolution_x, scene.render.resolution_y = args["res"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = args["samples"]


def apply_hide(names):
    """hide_render for this run only — the blend is never saved."""
    for name in names:
        coll = bpy.data.collections.get(name)
        if coll is None:
            print(f"unknown collection {name}")
            sys.exit(2)
        coll.hide_render = True


def gates_pass(stats, phase, no_gate):
    if no_gate:
        return True
    ok = (
        GATE_LUM_MIN < stats["mean_lum"] < GATE_LUM_MAX
        and stats["red_ratio"] < GATE_RED_MAX
        and stats["unique_colors"] > GATE_COLORS_MIN
    )
    return ok


def main():
    args = parse_args(sys.argv)
    scene = bpy.context.scene
    out_dir = Path(args["out"])
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    blend_stem = Path(bpy.data.filepath).stem or "untitled"

    # Validate all views before any (slow) render.
    for view in args["views"]:
        if bpy.data.objects.get(f"CAM_{view}") is None:
            print(f"unknown view {view}")
            sys.exit(2)
    apply_hide(args["hide"])
    build_lighting(args["phase"])  # rebuilds LIGHTING + world for this phase
    configure_scene(scene, args)

    failed = False
    for view in args["views"]:
        scene.camera = bpy.data.objects[f"CAM_{view}"]
        parts = [blend_stem]
        if args["tag"]:
            parts.append(args["tag"])
        parts.append(view)
        if args["phase"] == "night":
            parts.append("night")
        path = str(out_dir / ("_".join(parts) + ".png"))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"RENDER OK {path}")
        stats = compute_stats(path)
        print(
            f"STATS {view} mean_lum={stats['mean_lum']:.3f} "
            f"red_ratio={stats['red_ratio']:.3f} "
            f"unique_colors={stats['unique_colors']}"
        )
        if not gates_pass(stats, args["phase"], args["no_gate"]):
            print(f"GATE FAIL {view}")
            failed = True
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
