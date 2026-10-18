"""Import the Meshy character (rigged + idle, or static fallback) as CHAR_BASE.

Rigged path: import char_base_rigged.glb (armature + skinned mesh), transfer
the idle action from char_idle.glb, decimate the mesh under 20k tris, place
the armature at CHARACTER_SPAWN. Never joins or applies transforms on the
skinned rig. Static path (RIG_UNAVAILABLE): single mesh from the raw GLB,
join/apply allowed. Both paths rewrite renders/character_mode.txt.

Headless CLI (scratch test):
  blender -b --python-exit-code 1 -P apps/assets/blender/import_character.py \
      -- [--static] [--save /tmp/char_test.blend]
"""

import os
import sys
from math import radians
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hq_lib import (  # noqa: E402
    CAM_TARGETS,
    CHARACTER_SPAWN,
    RAW_MESHY_DIR,
    RENDER_DIR,
    SELF_CHECKS,
    get_collection,
    register_check,
)
from normalize_kit import _ensure_numpy  # noqa: E402

RIGGED_GLB = RAW_MESHY_DIR / "char_base_rigged.glb"
IDLE_GLB = RAW_MESHY_DIR / "char_idle.glb"
RAW_GLB = RAW_MESHY_DIR / "char_base_raw.glb"
MODE_FILE = RENDER_DIR / "character_mode.txt"

TARGET_HEIGHT = 1.70
HEIGHT_MIN = 1.65
HEIGHT_MAX = 1.75
TRIS_CAP = 20000
TRIS_DECIMATE_TARGET = 19500
FEET_TOLERANCE = 0.02
LOCATION_TOLERANCE = 0.01
FACING_DOT_MIN = 0.5
MAX_RECASTS = 8
MAX_TEXTURE = 2048


# --- Shared helpers -----------------------------------------------------------
def _purge_orphans():
    """Remove 0-user leftovers from earlier runs / the anim import."""
    for block_list in (bpy.data.actions, bpy.data.armatures, bpy.data.meshes,
                       bpy.data.materials, bpy.data.images):
        for block in list(block_list):
            if block.users == 0 and not block.use_fake_user:
                block_list.remove(block)


def _import_gltf(path):
    """Import a GLB, return the list of new objects (set difference)."""
    if not Path(path).is_file():
        raise FileNotFoundError(f"GLB not found: {path}")
    _ensure_numpy()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def _evaluated_world_z(mesh_obj):
    """(zmin, zmax) of the evaluated mesh in world space."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = mesh_obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    mw = eval_obj.matrix_world
    zs = [(mw @ v.co).z for v in mesh.vertices]
    eval_obj.to_mesh_clear()
    return min(zs), max(zs)


def _count_tris(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def _link_only_to(obj, coll):
    for other in list(obj.users_collection):
        other.objects.unlink(obj)
    coll.objects.link(obj)


def _smooth(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=radians(30))


def _assert_texture_size(mesh_obj):
    for mat in mesh_obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                assert max(node.image.size) <= MAX_TEXTURE, (
                    f"character texture {tuple(node.image.size)} > "
                    f"{MAX_TEXTURE}"
                )


def _write_mode(mode):
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    MODE_FILE.write_text(mode + "\n")


# --- Rigged path --------------------------------------------------------------
def _split_import(new_objects, label):
    """(armature, skinned mesh, junk list) from one Meshy GLB import."""
    armatures = [o for o in new_objects if o.type == "ARMATURE"]
    assert len(armatures) == 1, f"{label}: {len(armatures)} armatures != 1"
    armature = armatures[0]
    skinned = [
        o for o in new_objects
        if o.type == "MESH" and o.parent is armature and o.vertex_groups
    ]
    assert skinned, f"{label}: no skinned mesh parented to armature"
    junk = [o for o in new_objects if o is not armature and o not in skinned]
    return armature, skinned, junk


def _remove_objects(objects):
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


def _join_meshes(meshes):
    if len(meshes) == 1:
        return meshes[0]
    for obj in meshes:
        assert obj.data.shape_keys is None, f"shape keys on {obj.name}"
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


def _transfer_idle_action(armature, anim_path):
    """Import the idle GLB, move its action onto `armature`, delete the rest."""
    new_objects = _import_gltf(anim_path)
    anim_armature = next(o for o in new_objects if o.type == "ARMATURE")
    anim_data = anim_armature.animation_data
    act = anim_data.action if anim_data else None
    if act is None and anim_data and anim_data.nla_tracks:
        strips = [s for t in anim_data.nla_tracks for s in t.strips]
        act = strips[0].action if strips else None
    assert act is not None, "idle GLB has no action"
    anim_bones = {b.name for b in anim_armature.data.bones}
    rig_bones = {b.name for b in armature.data.bones}
    assert anim_bones == rig_bones, (
        f"bone sets differ: only_anim={sorted(anim_bones - rig_bones)} "
        f"only_rig={sorted(rig_bones - anim_bones)}"
    )
    # Drop the rig GLB's own static clip before adopting the idle action.
    if armature.animation_data and armature.animation_data.action:
        armature.animation_data.action = None
    ad = armature.animation_data_create()
    ad.action = act
    # Blender 5 slotted actions: without a slot the action is held but the
    # armature does not move.
    if hasattr(ad, "action_slot") and act.slots:
        ad.action_slot = act.slots[0]
    act.name = "idle"
    act.use_fake_user = False
    _remove_objects(new_objects)
    _purge_orphans()
    return act


def _decimate_mesh(mesh_obj):
    """Collapse-decimate under the tris cap; decimate goes first in stack."""
    tris_before = _count_tris(mesh_obj.data)
    if tris_before <= TRIS_CAP:
        return tris_before, tris_before
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    mod = mesh_obj.modifiers.new("char_decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = TRIS_DECIMATE_TARGET / tris_before
    # The armature modifier must stay; apply decimate from slot 0 so Blender
    # never evaluates it on top of the armature deformation.
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return tris_before, _count_tris(mesh_obj.data)


def _zero_weight_verts(mesh_obj):
    return sum(1 for v in mesh_obj.data.vertices if not v.groups)


def _place_and_scale(armature, mesh_obj):
    """CHARACTER_SPAWN placement + uniform scale to TARGET_HEIGHT at frame 1."""
    location, rotation_z = CHARACTER_SPAWN
    armature.location = location
    armature.rotation_mode = "XYZ"
    armature.rotation_euler = (0.0, 0.0, rotation_z)
    bpy.context.scene.frame_set(1)
    zmin, zmax = _evaluated_world_z(mesh_obj)
    height = zmax - zmin
    scaled = False
    if not (HEIGHT_MIN <= height <= HEIGHT_MAX):
        factor = TARGET_HEIGHT / height
        armature.scale = tuple(s * factor for s in armature.scale)
        scaled = True
        zmin, zmax = _evaluated_world_z(mesh_obj)
        height = zmax - zmin
    if abs(zmin - location[2]) > FEET_TOLERANCE:
        armature.location.z += location[2] - zmin
        zmin, zmax = _evaluated_world_z(mesh_obj)
        height = zmax - zmin
    return height, zmin, scaled


def _import_rigged(rigged_path, anim_path):
    coll = get_collection("CHARACTERS")
    new_objects = _import_gltf(rigged_path)
    armature, skinned, junk = _split_import(new_objects, "rig")
    _remove_objects(junk)
    mesh_obj = _join_meshes(skinned)
    armature.name = "CHAR_BASE"
    armature.data.name = "CHAR_BASE"
    mesh_obj.name = "CHAR_BASE_mesh"
    mesh_obj.data.name = "CHAR_BASE_mesh"

    act = _transfer_idle_action(armature, anim_path)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = int(act.frame_range[1])

    tris_before, tris_after = _decimate_mesh(mesh_obj)
    _smooth(mesh_obj)
    _assert_texture_size(mesh_obj)
    height, feet_z, scaled = _place_and_scale(armature, mesh_obj)
    _link_only_to(armature, coll)
    _link_only_to(mesh_obj, coll)
    _write_mode("rigged")
    info = {
        "mode": "rigged",
        "tris_before": tris_before,
        "tris_after": tris_after,
        "zero_weight_verts": _zero_weight_verts(mesh_obj),
        "vertex_groups": len(mesh_obj.vertex_groups),
        "bones": len(armature.data.bones),
        "height": round(height, 4),
        "feet_z": round(feet_z, 4),
        "rescaled": scaled,
        "frame_end": bpy.context.scene.frame_end,
    }
    print("CHARACTER", info)
    return info


# --- Static fallback ----------------------------------------------------------
def _import_static(raw_path):
    coll = get_collection("CHARACTERS")
    new_objects = _import_gltf(raw_path)
    meshes = [o for o in new_objects if o.type == "MESH"]
    _remove_objects([o for o in new_objects if o.type != "MESH"])
    for obj in meshes:
        if obj.parent is not None:
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
    mesh_obj = _join_meshes(meshes)
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    mesh = mesh_obj.data
    zs = [v.co.z for v in mesh.vertices]
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    raw_height = max(zs) - min(zs)
    mesh.transform(Matrix.Scale(TARGET_HEIGHT / raw_height, 4))
    zs = [v.co.z for v in mesh.vertices]
    offset = Vector((
        (min(xs) + max(xs)) / 2.0 * TARGET_HEIGHT / raw_height,
        (min(ys) + max(ys)) / 2.0 * TARGET_HEIGHT / raw_height,
        min(zs),
    ))
    mesh.transform(Matrix.Translation(-offset))

    location, rotation_z = CHARACTER_SPAWN
    mesh_obj.location = location
    mesh_obj.rotation_euler = (0.0, 0.0, rotation_z)
    mesh_obj.name = "CHAR_BASE"
    mesh.name = "CHAR_BASE"
    tris_before = _count_tris(mesh)
    if tris_before > TRIS_CAP:
        mod = mesh_obj.modifiers.new("char_decimate", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = TRIS_DECIMATE_TARGET / tris_before
        bpy.ops.object.modifier_apply(modifier=mod.name)
    _smooth(mesh_obj)
    _assert_texture_size(mesh_obj)
    _link_only_to(mesh_obj, coll)
    _write_mode("static")
    info = {
        "mode": "static",
        "tris_before": tris_before,
        "tris_after": _count_tris(mesh),
        "height": round(TARGET_HEIGHT, 4),
    }
    print("CHARACTER", info)
    return info


# --- Entry points -------------------------------------------------------------
def import_character(rigged_path=None, anim_path=None, static_path=None):
    """Import the character. static_path set => static fallback mode."""
    _purge_orphans()
    if static_path is not None:
        return _import_static(static_path)
    return _import_rigged(rigged_path or RIGGED_GLB, anim_path or IDLE_GLB)


def build_characters():
    """build_hq --with-character entry: rigged if files exist, else static."""
    if RIGGED_GLB.is_file() and IDLE_GLB.is_file():
        info = import_character(RIGGED_GLB, IDLE_GLB)
    else:
        info = import_character(static_path=RAW_GLB)
    if os.environ.get("HQ_INJECT_BAD_CHAR_HEIGHT"):
        bad = bpy.data.objects["CHAR_BASE"]
        bad.scale = tuple(s * 1.5 for s in bad.scale)
    if check_character not in SELF_CHECKS:
        register_check(check_character)
    return info

# --- Self-check -----------------------------------------------------------------
def _first_non_col_hit(scene, depsgraph, origin, target):
    """ray_cast skipping COL_* hits; returns final hit object name or None."""
    direction = (target - origin).normalized()
    start = origin
    for _ in range(MAX_RECASTS):
        hit, loc, _normal, _idx, obj, _mw = scene.ray_cast(
            depsgraph, start, direction
        )
        if not hit:
            return None
        if obj.name.startswith("COL_"):
            start = loc + direction * 0.01
            continue
        return obj.name
    return None


def check_character():
    import bpy_extras.object_utils

    mode_ok = MODE_FILE.is_file()
    assert mode_ok, f"check_character: missing {MODE_FILE}"
    mode = MODE_FILE.read_text().strip()
    assert mode in ("rigged", "static"), (
        f"check_character: bad character_mode {mode!r}"
    )
    char = bpy.data.objects.get("CHAR_BASE")
    assert char is not None, "check_character: missing CHAR_BASE"

    coll = bpy.data.collections.get("CHARACTERS")
    assert coll is not None, "check_character: missing CHARACTERS"
    types = sorted(o.type for o in coll.all_objects)
    if mode == "rigged":
        assert types == ["ARMATURE", "MESH"], (
            f"check_character: CHARACTERS contents {types}"
        )
        mesh_obj = bpy.data.objects.get("CHAR_BASE_mesh")
        assert mesh_obj is not None, "check_character: missing CHAR_BASE_mesh"
        assert char.type == "ARMATURE", "check_character: CHAR_BASE not rig"
    else:
        assert types == ["MESH"], f"check_character: CHARACTERS {types}"
        mesh_obj = char
        assert char.type == "MESH", "check_character: CHAR_BASE not mesh"

    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    scene = bpy.context.scene

    location, _rot = CHARACTER_SPAWN
    spawn = Vector(location)
    for axis in range(3):
        assert abs(char.location[axis] - location[axis]) <= (
            LOCATION_TOLERANCE if axis < 2 else 0.1
        ), (
            f"check_character: location axis {axis} "
            f"{char.location[axis]:.4f} vs {location[axis]}"
        )

    scene.frame_set(1)
    zmin, zmax = _evaluated_world_z(mesh_obj)
    height = zmax - zmin
    assert HEIGHT_MIN <= height <= HEIGHT_MAX, (
        f"check_character: height {height:.3f} outside "
        f"{HEIGHT_MIN}-{HEIGHT_MAX}"
    )
    assert abs(zmin) <= FEET_TOLERANCE, (
        f"check_character: feet z {zmin:.4f} not on floor"
    )
    tris = _count_tris(mesh_obj.data)
    assert tris <= TRIS_CAP, f"check_character: {tris} tris > {TRIS_CAP}"

    cam = bpy.data.objects["CAM_lobby"]
    fwd = (char.matrix_world.to_3x3() @ Vector((0.0, -1.0, 0.0)))
    fwd = Vector((fwd.x, fwd.y, 0.0)).normalized()
    to_cam = cam.location - char.location
    to_cam = Vector((to_cam.x, to_cam.y, 0.0)).normalized()
    dot = fwd.dot(to_cam)
    assert dot > FACING_DOT_MIN, (
        f"check_character: facing dot {dot:.3f} <= {FACING_DOT_MIN}"
    )
    print(f"CHECK_CHARACTER facing_dot {dot:.3f} height {height:.3f} "
          f"tris {tris} feet_z {zmin:.4f}")

    if mode == "rigged":
        assert char.animation_data and char.animation_data.action, (
            "check_character: no action on CHAR_BASE"
        )
        assert char.animation_data.action.name == "idle", (
            f"check_character: action {char.animation_data.action.name}"
        )
        hips = next(
            (b for b in char.pose.bones if b.name.lower() in
             ("hips", "hip", "pelvis", "root")),
            None,
        )
        assert hips is not None, "check_character: no hips bone"
        scene.frame_set(1)
        bpy.context.view_layer.update()
        m1 = hips.matrix.copy()
        scene.frame_set(max(2, scene.frame_end // 2))
        bpy.context.view_layer.update()
        m2 = hips.matrix.copy()
        scene.frame_set(1)
        moved = any(
            abs(m1[i][j] - m2[i][j]) > 1e-5
            for i in range(4) for j in range(4)
        )
        assert moved, "check_character: hips static between frames"

    expected = {"CHAR_BASE", "CHAR_BASE_mesh"}
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for z_probe in (0.9, 1.5):
        hit_name = _first_non_col_hit(
            scene, depsgraph, cam.location, spawn + Vector((0, 0, z_probe))
        )
        assert hit_name in expected, (
            f"check_character: ray z={z_probe} hit {hit_name!r}"
        )

    ndc = bpy_extras.object_utils.world_to_camera_view(scene, cam, spawn)
    assert ndc.y > 0.02, f"check_character: feet out of frame y={ndc.y:.3f}"


# --- CLI ------------------------------------------------------------------------
def main(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    static = "--static" in argv
    save = None
    if "--save" in argv:
        save = argv[argv.index("--save") + 1]
    bpy.ops.wm.read_homefile(use_empty=True)
    if static:
        import_character(static_path=RAW_GLB)
    else:
        import_character()
    if save:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=save)


if __name__ == "__main__":
    main(sys.argv)
