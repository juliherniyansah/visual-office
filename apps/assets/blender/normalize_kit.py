"""Normalize a Meshy kit GLB into a KIT_MESHY-ready piece.

Pipeline: import GLB -> join meshes -> texture keep/downscale or palette
fallback (voxel remesh only on fallback) -> scale to target bbox -> pivot to
bbox bottom-centre at origin -> edge clean-up (remove_doubles + snap verts to
bbox planes) -> Decimate if > 1500 tris -> smooth 30 deg -> rename -> link to
collection KIT_MESHY.

Headless CLI:
  blender -b --python-exit-code 1 -P apps/assets/blender/normalize_kit.py -- \
    --glb <path> --name KIT_meshy_wall_1m --size 1,0.15,3.2 \
    [--save /tmp/kit_test.blend]
Prints: NORMALIZE OK <json>
"""

import json
import sys
from math import radians
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hq_lib import (  # noqa: E402
    REPO_ROOT,
    get_collection,
    palette_material,
)

TRIS_CAP = 1500
MIN_TEXTURE_SIZE = 512
MAX_TEXTURE_SIZE = 1024
SNAP_DISTANCE = 0.002
MERGE_DISTANCE = 0.001
NONUNIFORM_TOLERANCE = 0.05
SMOOTH_ANGLE_DEG = 30.0
FALLBACK_PALETTE_KEY = "exterior"
VOXEL_DIVISIONS = 24  # fallback remesh: voxel size = max dim / this


# --- Import ------------------------------------------------------------------
def _ensure_numpy():
    """Blender headless skips user site-packages; the glTF importer needs
    numpy. Append the user site dir lazily so the documented CLI (no
    --python-use-system-env) still works."""
    try:
        import numpy  # noqa: F401
        return
    except ModuleNotFoundError:
        import site

        user_site = site.getusersitepackages()
        if user_site not in sys.path:
            sys.path.append(user_site)
        import numpy  # noqa: F401


def _import_glb(glb_path):
    """Import a GLB and return the single joined mesh object."""
    path = Path(glb_path)
    if not path.is_file():
        raise FileNotFoundError(f"GLB not found: {path}")
    _ensure_numpy()

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    if not meshes:
        raise ValueError(f"no mesh objects in {path}")

    # Detach from any imported armature/empty, keeping world transforms.
    for obj in meshes:
        if obj.parent is not None:
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world

    # Drop non-mesh leftovers (armatures, empties, lights, cameras).
    for obj in imported:
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


# --- Texture ------------------------------------------------------------------
def _base_color_image(material):
    """Image feeding Principled Base Color, else any image node's image."""
    if not material or not material.use_nodes:
        return None
    principled = next(
        (n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
        None,
    )
    if principled is not None and principled.inputs["Base Color"].links:
        node = principled.inputs["Base Color"].links[0].from_node
        if node.type == "TEX_IMAGE" and node.image is not None:
            return node.image
    return next(
        (n.image for n in material.node_tree.nodes
         if n.type == "TEX_IMAGE" and n.image is not None),
        None,
    )


def _handle_texture(obj, force_fallback=False, fallback_key=None,
                    max_texture_size=None):
    """Keep/downscale base-colour texture or install palette fallback.

    Returns (fallback, texture_size). force_fallback drops a good texture
    on purpose (e.g. a baked lattice the user rejected) — honest fallback.
    max_texture_size (default MAX_TEXTURE_SIZE) caps the base colour only;
    other PBR maps (normal, metallic/roughness) are never touched.
    """
    cap = max_texture_size or MAX_TEXTURE_SIZE
    key = fallback_key or FALLBACK_PALETTE_KEY
    if force_fallback:
        obj.data.materials.clear()
        obj.data.materials.append(palette_material(key))
        return True, [0, 0]
    image = next(
        (img for mat in obj.data.materials
         if (img := _base_color_image(mat)) is not None),
        None,
    )
    if image is not None and min(image.size) >= MIN_TEXTURE_SIZE:
        if max(image.size) > cap:
            image.scale(cap, cap)
            image.pack()
            if tuple(image.size) != (cap, cap):
                raise RuntimeError(
                    f"texture downscale failed: {tuple(image.size)}"
                )
            if image.packed_file is None:
                raise RuntimeError("texture pack failed")
        return False, list(image.size)

    obj.data.materials.clear()
    obj.data.materials.append(palette_material(key))
    return True, [0, 0]


def _voxel_remesh(obj, dims):
    """Voxel remesh — allowed ONLY on palette-fallback pieces."""
    obj.data.remesh_voxel_size = max(max(dims), 1e-3) / VOXEL_DIVISIONS
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.voxel_remesh()
    # Remesh wipes material slots on some paths; reassert fallback material.
    if not obj.data.materials:
        obj.data.materials.append(palette_material(FALLBACK_PALETTE_KEY))


# --- Geometry -----------------------------------------------------------------
def _mesh_bounds(mesh):
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    lo = Vector((min(xs), min(ys), min(zs)))
    hi = Vector((max(xs), max(ys), max(zs)))
    return lo, hi


def _dims(mesh):
    lo, hi = _mesh_bounds(mesh)
    return hi - lo


def _scale_to_target(mesh, target, piece_name, tolerance=None):
    """Uniform scale (z-driven, x for floors) + per-axis snap if off > tol."""
    if tolerance is None:
        tolerance = NONUNIFORM_TOLERANCE
    dims = _dims(mesh)
    axis = 0 if "floor" in piece_name.lower() else 2
    if dims[axis] < 1e-6:
        raise ValueError(f"degenerate source dim on axis {axis}: {dims}")
    uniform = target[axis] / dims[axis]
    factors = [uniform, uniform, uniform]
    nonuniform = False
    for i in range(3):
        scaled = dims[i] * uniform
        if scaled > 1e-9 and abs(scaled - target[i]) / target[i] > tolerance:
            factors[i] = target[i] / dims[i]
            nonuniform = True
    mesh.transform(Matrix.Diagonal((*factors, 1.0)))
    return nonuniform


def _pivot_bottom_center(obj):
    """Mesh bbox bottom-centre moves to local (0,0,0); object to origin."""
    lo, hi = _mesh_bounds(obj.data)
    offset = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    obj.data.transform(Matrix.Translation(-offset))
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)


def _edge_cleanup(mesh, target):
    """remove_doubles then snap verts within 2 mm of bbox planes onto them."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=MERGE_DISTANCE)
    planes = (
        (0, -target[0] / 2), (0, target[0] / 2),
        (1, -target[1] / 2), (1, target[1] / 2),
        (2, 0.0), (2, target[2]),
    )
    snapped = 0
    for vert in bm.verts:
        hit = False
        for axis, value in planes:
            if abs(vert.co[axis] - value) <= SNAP_DISTANCE:
                vert.co[axis] = value
                hit = True
        snapped += int(hit)
    bm.to_mesh(mesh)
    bm.free()
    return snapped


def _count_tris(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def _decimate_if_needed(obj, tris_cap=None):
    cap = tris_cap or TRIS_CAP
    tris = _count_tris(obj.data)
    if tris <= cap:
        return tris
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("nk_decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = cap / tris
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return _count_tris(obj.data)


def _smooth(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=radians(SMOOTH_ANGLE_DEG))
        return True
    except (RuntimeError, TypeError, AttributeError):
        obj.data.shade_flat()
        return False


# --- Main entry ---------------------------------------------------------------
def normalize_kit_piece(glb_path, piece_name, target_size,
                        collection_name="KIT_MESHY", pre_rotate_x_deg=0.0,
                        force_fallback=False, fallback_key=None,
                        nonuniform_tolerance=None, max_texture_size=None,
                        tris_cap=None):
    """Import + normalize one kit GLB. Returns (object, info dict).

    pre_rotate_x_deg: mesh-level rotation about X applied BEFORE scaling —
    lays an upright Meshy slab flat (e.g. floor tile imported thin-axis Y).
    force_fallback: drop the texture for a palette material (no remesh).
    max_texture_size: base-colour cap (default 1024; kit v2 passes 4096 to
    keep Meshy's 4K bake; normal/metal-rough maps are never resized).
    tris_cap: per-piece decimate target (default 1500).
    """
    target = tuple(float(v) for v in target_size)
    if len(target) != 3 or any(v <= 0 for v in target):
        raise ValueError(f"target_size must be 3 positive floats: {target}")

    obj = _import_glb(glb_path)
    tris_raw = _count_tris(obj.data)
    if pre_rotate_x_deg:
        obj.data.transform(
            Matrix.Rotation(radians(pre_rotate_x_deg), 4, "X")
        )
    fallback, texture_size = _handle_texture(
        obj, force_fallback=force_fallback, fallback_key=fallback_key,
        max_texture_size=max_texture_size,
    )
    if fallback and not force_fallback:
        _voxel_remesh(obj, _dims(obj.data))

    nonuniform = _scale_to_target(
        obj.data, target, piece_name, tolerance=nonuniform_tolerance
    )
    _pivot_bottom_center(obj)
    snapped_verts = _edge_cleanup(obj.data, target)
    tris = _decimate_if_needed(obj, tris_cap=tris_cap)
    _pivot_bottom_center(obj)  # cleanup/decimate can shift bounds slightly
    smooth = _smooth(obj)

    obj.name = piece_name
    obj.data.name = piece_name
    coll = get_collection(collection_name)
    coll.hide_render = True
    for other in obj.users_collection:
        other.objects.unlink(obj)
    coll.objects.link(obj)

    lo, hi = _mesh_bounds(obj.data)
    dims = hi - lo
    info = {
        "tris_raw": tris_raw,
        "tris": tris,
        "dims": [round(d, 4) for d in dims],
        "z_min": round(lo.z, 5),
        "nonuniform": nonuniform,
        "fallback": fallback,
        "smooth": smooth,
        "texture_size": texture_size,
        "snapped_verts": snapped_verts,
    }
    return obj, info


# --- CLI ----------------------------------------------------------------------
def _parse_args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    args = {"glb": None, "name": None, "size": None, "save": None}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key not in args or i + 1 >= len(argv):
            raise ValueError(f"bad CLI token: {argv[i]}")
        args[key] = argv[i + 1]
        i += 2
    if not (args["glb"] and args["name"] and args["size"]):
        raise ValueError("required: --glb <path> --name <name> --size x,y,z")
    args["size"] = tuple(float(v) for v in args["size"].split(","))
    return args


def main(argv):
    args = _parse_args(argv)
    bpy.ops.wm.read_homefile(use_empty=True)
    _, info = normalize_kit_piece(args["glb"], args["name"], args["size"])
    if args["save"]:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=args["save"])
    print("NORMALIZE OK", json.dumps(info))


if __name__ == "__main__":
    main(sys.argv)
