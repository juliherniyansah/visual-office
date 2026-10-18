"""Interior tour renders of the final HQ scene (read-only, never saves).

Usage (one blender call per batch of views):
  blender -b apps/assets/blender/hq_v04.blend --python-exit-code 1 \
      -P apps/assets/blender/tour_render.py -- --views 01,02,03|all \
      [--out apps/assets/blender/renders/tour] [--res 1280x720] \
      [--samples 16] [--preview]

Tour cameras are added and collections hidden in memory only; the blend is
never saved. Day lighting, view settings, STATS and gates are reused from
hq_lighting / render_hq so frames match renders/hq_v04_kit2_*.png.
--preview renders a 640x360 Workbench framing check (no STATS gate).
Not part of build_hq.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from hq_lib import REPO_ROOT, VIEW_EXPOSURE  # noqa: E402
from hq_lighting import build_lighting  # noqa: E402
from render_hq import (  # noqa: E402
    GATE_LUM_MAX,
    GATE_LUM_MIN,
    compute_stats,
    configure_scene,
    gates_pass,
)

DEFAULT_OUT = "apps/assets/blender/renders/tour"
EVIDENCE_DIR = REPO_ROOT / ".omo/evidence/mvp-2-blender-lab"
SCENE_MAP_LOG = EVIDENCE_DIR / "80-scene-map.txt"
RENDER_LOG = EVIDENCE_DIR / "80-render-log.txt"
# 16 TAA samples (render_hq default 32) halves frame time for the tour.
TOUR_SAMPLES = 16
PREVIEW_RES = (640, 360)
CLIP_START = 0.05
CLIP_END = 200.0
MIN_CENTER_CLEAR = 1.0  # first renderable hit toward target must be farther
MIN_SIDE_CLEAR = 0.15  # nearest surface along +-X/Y/Z (inside-mesh guard)
NUDGE_STEP = 0.5
NUDGE_BACK_TRIES = 6
EXPOSURE_STEP = 0.5
MAX_RETRIES = 2
MAX_RAY_HOPS = 64

TEST_STAGES = ("FLOOR_1_KIT_TEST", "VERDICT_STAGE")
UPPER_FLOORS = ("FLOOR_2", "FLOOR_3", "FLOOR_4")
# id -> (name, camera location, look-at target, lens mm, hidden collections)
# Floor 1 eye height 1.6 (tile top z 0.005); floor n eye = (n-1)*3.2 + 1.6.
VIEWS = {
    "01": ("entrance", (4.0, 0.7, 1.6), (6.3, 6.5, 1.1), 24, ()),
    "02": ("lobby_sofa", (4.2, 8.8, 1.6), (5.6, 2.6, 0.6), 24, ()),
    "03": ("workstation_row", (19.3, 4.0, 1.6), (9.0, 4.3, 0.9), 28, ()),
    "04": ("workstation_wide", (19.3, 0.7, 1.7), (11.0, 5.5, 0.8), 24, ()),
    "05": ("meeting_room", (13.5, 8.5, 1.6), (10.6, 12.6, 0.9), 24, ()),
    # No kitchen/third room exists: the only other ROOM_* is the kit-test
    # meeting twin at +30 m x (FLOOR_1_KIT_TEST, outside the building).
    "06": ("kit_test_room", (43.5, 8.5, 1.6), (40.6, 12.6, 0.9), 24, ()),
    # No real corridor: the open strip x14-16 / y8-14 between the meeting
    # glass and the stair run is the circulation zone.
    "07": ("corridor_stairs", (14.6, 4.4, 1.75), (17.4, 11.6, 1.0), 24, ()),
    "08": ("floor1_cutaway_top", (24.0, -7.0, 18.0), (10.0, 7.2, 0.0), 24,
           UPPER_FLOORS + TEST_STAGES),
    "09": ("floor2", (1.2, 1.2, 4.8), (14.0, 9.5, 4.0), 24, ()),
    # Looks SE over the stair void (floors 2-4 have the hole but no stairs).
    "10": ("floor4_top", (13.0, 12.8, 11.2), (19.0, 6.0, 10.2), 24, ()),
    # VERDICT_STAGE sits south of the road exactly where a street-level
    # camera must stand (its test door would fill the frame).
    "11": ("exterior_front", (10.0, -27.0, 1.7), (10.0, 0.0, 6.2), 35,
           ("VERDICT_STAGE",)),
}
AXES = [Vector(a) for a in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0),
                            (0, 0, 1), (0, 0, -1))]


def log(line, *paths):
    print(line)
    for path in paths:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")


def fmt(vec):
    return "(" + ",".join(f"{c:.2f}" for c in vec) + ")"


def parse_args(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    args = {"views": [], "out": DEFAULT_OUT, "res": (1280, 720),
            "samples": TOUR_SAMPLES, "preview": False}
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--preview":
            args["preview"] = True
        elif token in ("--views", "--out", "--res", "--samples") and (
                i + 1 < len(argv)):
            i += 1
            value = argv[i]
            if token == "--views":
                args["views"] = (list(VIEWS) if value == "all"
                                 else [v for v in value.split(",") if v])
            elif token == "--out":
                args["out"] = value
            elif token == "--res":
                width, _, height = value.partition("x")
                args["res"] = (int(width), int(height))
            else:
                args["samples"] = int(value)
        else:
            print(f"unknown arg {token}")
            sys.exit(2)
        i += 1
    unknown = [v for v in args["views"] if v not in VIEWS]
    if not args["views"] or unknown:
        print(f"usage: --views {','.join(VIEWS)}|all (unknown {unknown})")
        sys.exit(2)
    return args


def hidden_collections():
    hidden = set()
    for coll in bpy.data.collections:
        if coll.hide_render:
            hidden.add(coll.name)
            hidden.update(c.name for c in coll.children_recursive)
    return hidden


def is_renderable(obj, hidden):
    if obj.hide_render:
        return False
    return not any(c.name in hidden for c in obj.users_collection)


def first_hit(scene, depsgraph, origin, direction, hidden):
    """Distance + name of the first RENDERABLE surface (skips COL_* etc.)."""
    start = Vector(origin)
    travelled = 0.0
    for _ in range(MAX_RAY_HOPS):
        hit, loc, _normal, _index, obj, _matrix = scene.ray_cast(
            depsgraph, start, direction, distance=CLIP_END)
        if not hit:
            return None, None
        travelled += (loc - start).length
        obj = getattr(obj, "original", obj)
        if is_renderable(obj, hidden):
            return travelled, obj.name
        start = loc + direction * 0.001
        travelled += 0.001
    return None, "too-many-hops"


def validate_camera(scene, view_id, loc, target, hidden):
    """Nudge back (then sideways) until the look ray is clear > 1 m."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    loc, target = Vector(loc), Vector(target)
    back = loc - target
    back.z = 0.0
    back.normalize()
    side = Vector((-back.y, back.x, 0.0))
    candidates = [loc + back * NUDGE_STEP * k
                  for k in range(NUDGE_BACK_TRIES + 1)]
    candidates += [loc + side * NUDGE_STEP * s for s in (1, -1, 2, -2)]
    for n, cand in enumerate(candidates):
        direction = (target - cand).normalized()
        dist, name = first_hit(scene, depsgraph, cand, direction, hidden)
        clear = min(first_hit(scene, depsgraph, cand, a, hidden)[0] or 1e9
                    for a in AXES)
        ok = (dist is None or dist > MIN_CENTER_CLEAR) and (
            clear > MIN_SIDE_CLEAR)
        dist_txt = "none" if dist is None else f"{dist:.2f}"
        log(f"CAMCHECK {view_id} try{n} loc={fmt(cand)} "
            f"target={fmt(target)} first_hit={name}@{dist_txt} "
            f"min_axis_clear={clear:.2f} {'OK' if ok else 'BLOCKED'}",
            SCENE_MAP_LOG)
        if ok:
            return cand
    log(f"CAMCHECK {view_id} NO CLEAR POSITION; original kept", SCENE_MAP_LOG)
    return loc


def make_camera(view_id, loc, target, lens):
    data = bpy.data.cameras.new(f"CAM_tour_{view_id}")
    data.type = "PERSP"
    data.lens = lens
    data.clip_start = CLIP_START
    data.clip_end = CLIP_END
    cam = bpy.data.objects.new(f"CAM_tour_{view_id}", data)
    cam.location = loc
    look = Vector(target) - Vector(loc)
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    return cam


def next_exposure(stats, exposure):
    """Exposure step toward the lum gate; None when exposure cannot fix it."""
    if stats["mean_lum"] >= GATE_LUM_MAX:
        return exposure - EXPOSURE_STEP
    if stats["mean_lum"] <= GATE_LUM_MIN:
        return exposure + EXPOSURE_STEP
    return None


def render_view(scene, view_id, args, out_dir):
    name, loc, target, lens, hide = VIEWS[view_id]
    stem = f"tour_{view_id}_{name}"
    previous = {c: bpy.data.collections[c].hide_render for c in hide}
    for coll_name in hide:
        bpy.data.collections[coll_name].hide_render = True
    try:
        loc = validate_camera(scene, view_id, loc, target,
                              hidden_collections())
        scene.camera = make_camera(view_id, loc, target, lens)
        path = str(out_dir / f"{stem}.png")
        scene.render.filepath = path
        exposure = VIEW_EXPOSURE
        for attempt in range(MAX_RETRIES + 1):
            scene.view_settings.exposure = exposure
            started = time.time()
            bpy.ops.render.render(write_still=True)
            seconds = time.time() - started
            if args["preview"]:
                log(f"PREVIEW {stem} {seconds:.0f}s hidden={list(hide)}")
                return True
            stats = compute_stats(path)
            ok = gates_pass(stats, "day", False)
            log(f"STATS {stem} mean_lum={stats['mean_lum']:.3f} "
                f"red_ratio={stats['red_ratio']:.3f} "
                f"unique_colors={stats['unique_colors']} "
                f"exposure={exposure:+.1f} attempt={attempt} "
                f"seconds={seconds:.0f} hidden={list(hide)} "
                f"{'GATE OK' if ok else 'GATE FAIL'}", RENDER_LOG)
            if ok:
                return True
            exposure = next_exposure(stats, exposure)
            if exposure is None:
                log(f"RETUNE {stem} not exposure-fixable", RENDER_LOG)
                return False
            log(f"RETUNE {stem} exposure -> {exposure:+.1f}", RENDER_LOG)
        return False
    finally:
        for coll_name, value in previous.items():
            bpy.data.collections[coll_name].hide_render = value
        scene.view_settings.exposure = VIEW_EXPOSURE


def configure_preview(scene):
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError as err:
        print(f"workbench unavailable: {err}")
        sys.exit(2)
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "TEXTURE"
    scene.render.resolution_x, scene.render.resolution_y = PREVIEW_RES


def main():
    args = parse_args(sys.argv)
    scene = bpy.context.scene
    out_dir = Path(args["out"])
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    build_lighting("day")  # clears + rebuilds LIGHTING: never duplicates
    lights = sorted(o.name for o in bpy.data.objects if o.type == "LIGHT")
    configure_scene(scene, {"res": args["res"], "samples": args["samples"]})
    if args["preview"]:
        configure_preview(scene)
    logs = (SCENE_MAP_LOG,) if args["preview"] else (SCENE_MAP_LOG, RENDER_LOG)
    log(f"RUN views={args['views']} preview={args['preview']} "
        f"res={scene.render.resolution_x}x{scene.render.resolution_y} "
        f"samples={scene.eevee.taa_render_samples} "
        f"engine={scene.render.engine} lights={lights}", *logs)
    started = time.time()
    failed = [v for v in args["views"]
              if not render_view(scene, v, args, out_dir)]
    log(f"RUN DONE {time.time() - started:.0f}s failed={failed}", *logs)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
