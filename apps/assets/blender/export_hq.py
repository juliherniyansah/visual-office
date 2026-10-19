"""Export the RedHunter HQ scene to 6 GLBs (shell + floors 1-4 + character).

Headless, idempotent, NEVER saves the .blend. Argparse pattern mirrors
build_hq.py:34-74.

Usage:
  PYTHONPATH=... blender -b apps/assets/blender/hq_v04.blend \
    --python-use-system-env --python-exit-code 1 \
    -P apps/assets/blender/export_hq.py -- --out apps/assets/models/export --check

Negative hook: --inject-missing-exclusions deliberately adds VERDICT_STAGE
objects to the shell selection so --check MUST fail (pattern --inject-bad-col).
"""

import json
import re
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# --- Selectors ---------------------------------------------------------------
# Facade allowlist mirrors hq_kit2.py:158-161 (REPLACED_NAME_RE) intent:
# perimeter walls (incl _N / _fill_N variants), windows (incl _glass panes),
# columns, and PERIMETER doors only (anchored — door_f1_meeting is interior).
FACADE_RES = (
    re.compile(r"^wall_f\d+_[nswe]"),
    re.compile(r"^window_f\d+_"),
    re.compile(r"^column_f\d+"),
    re.compile(r"^door_f\d+_[nswe]$"),
)
# Names that must NEVER enter the shell (review round-3).
SHELL_FORBIDDEN_RE = re.compile(r"meeting|stair|core|tile|TASK_|NAV_|COL_|ROOM_")

# Mandatory exclusion list (HANDOFF.md:115). These collections are never
# queried for selection; the --check pass also asserts none of their object
# names leak into any GLB.
EXCLUDED_COLLECTIONS = (
    "FLOOR_1_KIT_TEST",
    "KIT_TEST_CEILING",
    "VERDICT_STAGE",
    "KIT_BPY",
    "KIT_MESHY",
    "KIT_MESHY_V2",
    "CAMERAS",
    "LIGHTING",
    "glTF_not_exported",
)

SHELL_EXTRA = ("roof_top", "SIGN_redhunter")  # live in FLOOR_4, owned by shell
FLOOR_COUNT = 4
BBOX_TOL = 1e-4
FOOTPRINT = (20.0, 14.0)  # X x Y metres, Z-up asserted via slab thickness
FOOTPRINT_TOL = 0.2


def parse_args(argv):
    """Parse tokens after Blender's `--` separator."""
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    args = {"out": None, "check": False, "inject_missing_exclusions": False}
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--out":
            i += 1
            args["out"] = argv[i]
        elif token == "--check":
            args["check"] = True
        elif token == "--inject-missing-exclusions":
            args["inject_missing_exclusions"] = True
        else:
            raise SystemExit(f"unknown arg {token}")
        i += 1
    if not args["out"]:
        raise SystemExit("--out is required")
    return args


def is_facade(name):
    return any(rx.match(name) for rx in FACADE_RES)


def collection_objects(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        raise SystemExit(f"missing collection {name}")
    return list(coll.all_objects)


def build_selections(inject_missing_exclusions=False):
    """Return {output_name: [objects]}. Expected counts are DERIVED here from
    the live .blend — nothing is hardcoded."""
    selections = {}
    shell = list(collection_objects("EXTERIOR"))
    for n in range(1, FLOOR_COUNT + 1):
        floor_objs = collection_objects(f"FLOOR_{n}")
        facade = [o for o in floor_objs if is_facade(o.name)]
        shell.extend(facade)
        rest = [o for o in floor_objs if not is_facade(o.name)]
        if n == FLOOR_COUNT:
            # roof_top + SIGN_redhunter belong to the shell; excluding them
            # from floor_4 prevents duplication / z-fighting.
            rest = [o for o in rest if o.name not in SHELL_EXTRA]
        selections[f"floor_{n}"] = rest
    for name in SHELL_EXTRA:
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise SystemExit(f"missing shell object {name}")
        shell.append(obj)
    if inject_missing_exclusions:
        shell.extend(collection_objects("VERDICT_STAGE"))
        print(f"INJECT missing-exclusions: +{len(collection_objects('VERDICT_STAGE'))} VERDICT_STAGE objects into shell")
    selections["hq_shell"] = shell
    char = []
    for name in ("CHAR_BASE", "CHAR_BASE_mesh"):
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise SystemExit(f"missing character object {name}")
        char.append(obj)
    selections["char_base"] = char
    return selections


# --- Geometry guards ---------------------------------------------------------
def world_bbox(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return lo, hi


def snapshot_bboxes(objects):
    snap = {}
    for obj in objects:
        if obj.type == "MESH":
            snap[obj.name] = world_bbox(obj)
    return snap


def assert_bboxes_identical(before, after):
    bad = []
    for name, (lo0, hi0) in before.items():
        lo1, hi1 = after[name]
        if (lo0 - lo1).length > BBOX_TOL or (hi0 - hi1).length > BBOX_TOL:
            bad.append(name)
    if bad:
        raise SystemExit(f"bbox drift > {BBOX_TOL} on {len(bad)} meshes: {bad[:5]}")
    print(f"CHECK PASS bbox invariant {len(before)} meshes within {BBOX_TOL}")


def assert_footprint():
    """Pre-export, in Blender (Z-up): building slab spans X x Y ~= 20 x 14 m."""
    slab = bpy.data.objects.get("COL_slab_floor_1")
    if slab is None:
        raise SystemExit("missing COL_slab_floor_1 for footprint check")
    lo, hi = world_bbox(slab)
    dx, dy, dz = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
    ok = abs(dx - FOOTPRINT[0]) <= FOOTPRINT_TOL and abs(dy - FOOTPRINT[1]) <= FOOTPRINT_TOL and dz < 1.0
    if not ok:
        raise SystemExit(f"footprint mismatch: {dx:.3f} x {dy:.3f} x {dz:.3f} m")
    print(f"CHECK PASS footprint Z-up XxY = {dx:.2f} x {dy:.2f} m (dz {dz:.2f})")


def apply_transforms_single_user(objects):
    """Apply transforms ONLY on single-user mesh objects (obj.data.users == 1).
    Shared-mesh objects (link_duplicate, hq_lib.py:343) are skipped + logged;
    their scale/rotation stays on the glTF node."""
    apply, skipped = [], []
    for obj in objects:
        if obj.type != "MESH":
            continue
        if obj.data.users != 1 or obj.parent is not None:
            skipped.append(obj.name)
            continue
        apply.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in apply:
        obj.select_set(True)
    if apply:
        bpy.context.view_layer.objects.active = apply[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print(f"TRANSFORM_APPLY applied={len(apply)} skipped_shared={len(skipped)}")
    if skipped:
        print(f"TRANSFORM_APPLY skipped names sample: {sorted(skipped)[:8]}")


def prune_character_actions():
    """Delete every action except `idle`, then make it the active action."""
    for act in list(bpy.data.actions):
        if act.name != "idle":
            print(f"ACTION remove {act.name}")
            bpy.data.actions.remove(act)
    idle = bpy.data.actions.get("idle")
    if idle is None:
        raise SystemExit("missing action 'idle'")
    arm = bpy.data.objects["CHAR_BASE"]
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = idle
    if hasattr(ad, "action_slot") and idle.slots:
        ad.action_slot = idle.slots[0]
    print(f"ACTIONS remaining {[a.name for a in bpy.data.actions]}")


# --- Export ------------------------------------------------------------------
def ensure_view_layer(objects):
    scene_coll = bpy.context.scene.collection
    view_layer_names = {o.name for o in bpy.context.view_layer.objects}
    for obj in objects:
        if obj.name in view_layer_names:
            continue
        for coll in obj.users_collection:
            if coll.name not in {c.name for c in scene_coll.children}:
                scene_coll.children.link(coll)
        obj.hide_set(False)


def export_glb(path, objects, character=False):
    ensure_view_layer(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(
        filepath=str(path),
        use_selection=True,
        export_format="GLB",
        export_extras=True,
        export_yup=True,
    )
    if character:
        kwargs.update(
            export_animations=True,
            export_animation_mode="ACTIONS",
            export_skins=True,
        )
    else:
        kwargs.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kwargs)
    size = Path(path).stat().st_size
    print(f"EXPORTED {Path(path).name} objects={len(objects)} bytes={size}")


# --- GLB inspection (stdlib only) --------------------------------------------
def glb_json(path):
    with open(path, "rb") as fh:
        magic, _version, _length = struct.unpack("<III", fh.read(12))
        if magic != 0x46546C67:
            raise SystemExit(f"{path}: not a GLB")
        chunk_len, chunk_type = struct.unpack("<II", fh.read(8))
        if chunk_type != 0x4E4F534A:  # 'JSON'
            raise SystemExit(f"{path}: first chunk is not JSON")
        return json.loads(fh.read(chunk_len))


def record_mesh_sharing(name, objects, gltf):
    nodes = gltf.get("nodes", [])
    meshes = gltf.get("meshes", [])
    unique_datablocks = {o.data.name for o in objects if o.type == "MESH"}
    print(
        f"MESH_SHARING {name} nodes={len(nodes)} glb_meshes={len(meshes)} "
        f"blend_unique_mesh_datablocks={len(unique_datablocks)}"
    )


# --- Self-check --------------------------------------------------------------
def run_checks(selections, out_dir):
    failures = []

    def fail(msg):
        failures.append(msg)
        print(f"CHECK FAIL {msg}")

    excluded_names = set()
    for coll_name in EXCLUDED_COLLECTIONS:
        coll = bpy.data.collections.get(coll_name)
        if coll is not None:
            excluded_names.update(o.name for o in coll.all_objects)
    # CHAR_BASE_stage is an object inside VERDICT_STAGE; covered above.

    for name, expected_objs in selections.items():
        path = out_dir / f"{name}_src.glb"
        if not path.exists():
            fail(f"{name}: missing {path}")
            continue
        gltf = glb_json(path)
        node_names = [n.get("name", "") for n in gltf.get("nodes", [])]
        node_set = set(node_names)
        leaks = node_set & excluded_names
        if leaks:
            fail(f"{name}: excluded-collection objects leaked {sorted(leaks)[:5]}")

        if name == "char_base":
            anims = gltf.get("animations", [])
            if len(anims) != 1 or anims[0].get("name") != "idle":
                fail(f"char_base: animations={[(a.get('name')) for a in anims]} expected exactly ['idle']")
            else:
                print("CHECK PASS char_base exactly 1 animation 'idle'")
            missing = {"CHAR_BASE", "CHAR_BASE_mesh"} - node_set
            if missing:
                fail(f"char_base: missing nodes {sorted(missing)}")
            else:
                print("CHECK PASS char_base nodes CHAR_BASE + CHAR_BASE_mesh")
            continue

        expected_names = {o.name for o in expected_objs}
        if len(node_names) != len(expected_names) or node_set != expected_names:
            extra = sorted(node_set - expected_names)[:5]
            missing = sorted(expected_names - node_set)[:5]
            fail(
                f"{name}: GLB nodes {len(node_names)} vs expected {len(expected_names)} "
                f"extra={extra} missing={missing}"
            )
        else:
            print(f"CHECK PASS {name} node count {len(node_names)} == blend-derived expected")

        if name == "floor_1":
            required = {"NAV_spawn_lobby", "TASK_board", "ROOM_lobby"} | {
                f"TASK_desk_{i}" for i in range(1, 9)
            }
            missing = required - node_set
            if missing:
                fail(f"floor_1: missing required nodes {sorted(missing)}")
            else:
                print("CHECK PASS floor_1 NAV_spawn_lobby/TASK_board/TASK_desk_1..8/ROOM_lobby")
            if "door_f1_meeting" not in node_set:
                fail("floor_1: door_f1_meeting missing (interior door belongs to floor)")
            else:
                print("CHECK PASS floor_1 contains door_f1_meeting")

        if name == "hq_shell":
            if "roof_top" not in node_set:
                fail("hq_shell: roof_top missing")
            else:
                print("CHECK PASS hq_shell contains roof_top")
            forbidden = [n for n in node_names if SHELL_FORBIDDEN_RE.search(n)]
            if forbidden:
                fail(f"hq_shell: forbidden names present {sorted(forbidden)[:5]}")
            else:
                print("CHECK PASS hq_shell zero TASK_/NAV_/COL_/ROOM_/meeting/stair/core/tile")
            if "door_f1_meeting" in node_set:
                fail("hq_shell: door_f1_meeting leaked into shell")
            else:
                print("CHECK PASS hq_shell excludes door_f1_meeting")

    # Cross-file prefix aggregates (computed from blend, anchor NAV7/TASK9/ROOM3/COL23).
    for prefix in ("NAV_", "TASK_", "ROOM_", "COL_"):
        blend_total = sum(
            1 for _n, objs in selections.items() for o in objs if o.name.startswith(prefix)
        )
        glb_total = 0
        for name in selections:
            path = out_dir / f"{name}_src.glb"
            if path.exists():
                gltf = glb_json(path)
                glb_total += sum(
                    1 for n in gltf.get("nodes", []) if n.get("name", "").startswith(prefix)
                )
        if blend_total != glb_total:
            fail(f"prefix {prefix}: blend {blend_total} vs GLB {glb_total}")
        else:
            print(f"CHECK PASS prefix {prefix} total {blend_total}")

    if failures:
        raise SystemExit(f"SELF_CHECK FAILED: {len(failures)} failure(s)")
    print("EXPORT_SELF_CHECK OK all outputs")


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv)
    out_dir = Path(args["out"])
    out_dir.mkdir(parents=True, exist_ok=True)

    selections = build_selections(args["inject_missing_exclusions"])
    all_scoped = [o for objs in selections.values() for o in objs]
    print(f"SELECTIONS { {k: len(v) for k, v in selections.items()} }")

    assert_footprint()
    before = snapshot_bboxes(all_scoped)
    apply_transforms_single_user(
        [o for name, objs in selections.items() if name != "char_base" for o in objs]
    )
    prune_character_actions()
    after = snapshot_bboxes(all_scoped)
    assert_bboxes_identical(before, after)

    for name, objs in selections.items():
        export_glb(out_dir / f"{name}_src.glb", objs, character=(name == "char_base"))
        record_mesh_sharing(name, objs, glb_json(out_dir / f"{name}_src.glb"))

    if args["check"]:
        run_checks(selections, out_dir)
    print("EXPORT_DONE")


if __name__ == "__main__":
    main()
