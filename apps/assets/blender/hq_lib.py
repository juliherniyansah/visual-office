"""Shared helpers, constants and self-check registry for the RedHunter HQ build.

Importable with no side effects. All geometry is built via bmesh (never
``bpy.ops.mesh.primitive_*``) so it works in any context/selection state.
"""

import re
from math import radians
from pathlib import Path

import bmesh
import bpy

# --- Paths -----------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[3]
BLENDER_DIR = REPO_ROOT / "apps/assets/blender"
RAW_MESHY_DIR = REPO_ROOT / "apps/assets/raw/meshy"
RENDER_DIR = BLENDER_DIR / "renders"

# --- Building constants ----------------------------------------------------
FOOTPRINT_X = 20.0
FOOTPRINT_Y = 14.0
FLOOR_HEIGHT = 3.2
FLOOR_COUNT = 4
COLUMN_GRID = 4.0
WALL_THICKNESS = 0.15
SLAB_THICKNESS = 0.2
BUILDING_CENTER = (10.0, 7.0)
TRIS_BUDGET_BUILDING = 150000
# Kit v2 builds raise the budget via this override (hq_kit2 sets it); the
# plain bpy build leaves it None so check_building_tris behaviour is frozen.
TRIS_BUDGET_OVERRIDE = None

PALETTE = {
    "exterior": "#F4EFE6",
    "interior": "#FFF8F0",
    "floor": "#D9D4CB",
    "orange": "#FFB74D",
    "teal": "#4DB6AC",
    "red": "#E53935",
    "ground": "#A5D6A7",
    "road": "#9E9E9E",
    "sidewalk": "#CFCFCF",
    "glass": "#BFE3F7",
    "wood": "#8D6E63",
    "leaf": "#66BB6A",
    "desk_top": "#EFE6DA",
    "dark": "#263238",
    "screen": "#BFE3F7",
}

# view -> (camera_location, target_location, projection, lens_mm)
CAM_TARGETS = {
    "iso": ((34, -22, 26), (10, 7, 5.5), "ORTHO", 50),
    # Lobby cam in the SW corner: the old (4,2) sat 2.6 m from sofa_1 and the
    # sofa filled the frame. From (1.5,1.5) the sightline to CHARACTER_SPAWN
    # (7,6) clears sofa_1 (x5.6 at y4.85 > ymax 2.05) and the counter (y5.6 at
    # x6.51 > xmax 3.5) — keep both true if either moves.
    "lobby": ((1.5, 1.5, 1.6), (7, 6, 1.2), "PERSP", 35),
    # Workstation cam sits in the aisle between desk rows (y=2 and y=6,
    # chairs 1.1/6.9): old (8.5,0.8) was 1.5 m from desk_1 so one monitor
    # blocked the frame. (8.4,4.0) keeps >1 m clear of all furniture.
    "workstation": ((8.4, 4.0, 1.6), (16, 4.6, 1.0), "PERSP", 28),
    # Inside the room's SW corner: the old (7,7) outside position shot
    # through the glass corner and the closed door leaf filled a third of
    # the frame with haze. Keep meeting_kit = meeting_bpy + (30,0,0).
    "meeting_bpy": ((8.8, 8.7, 1.6), (12, 12, 0.6), "PERSP", 28),
    "meeting_kit": ((38.8, 8.7, 1.6), (42, 12, 0.6), "PERSP", 28),
    "kit_compare": ((26, -22, 14), (26, 11, 1), "PERSP", 24),
    "character_closeup": ((5.7, 4.25, 1.5), (7, 6, 1.4), "PERSP", 50),
    "verdict": ((3, -46, 4.0), (3, -27, 1.0), "PERSP", 28),
}

# (location, rotation_z) — glTF importer maps forward to local -Y; -37deg
# turns the character toward the lobby camera.
CHARACTER_SPAWN = ((7.0, 6.0, 0.0), radians(-37))

KIT_UNUSED_OK = {"KIT_floor_1m", "KIT_pillar", "KIT_meshy_pillar"}

# Shared by build_hq and render_hq so saved blend and render output agree.
# 'Khronos PBR Neutral' compresses highlights while preserving hue — pastel
# palette keeps its colour where 'Standard' clipped walls to white and the
# earlier -1 EV fix muddied everything. Exposure 0 with this transform.
VIEW_TRANSFORM = "Khronos PBR Neutral"
VIEW_TRANSFORM_FALLBACKS = ("AgX", "Standard")
VIEW_EXPOSURE = 0.0


def apply_view_settings(scene):
    vs = scene.view_settings
    for name in (VIEW_TRANSFORM, *VIEW_TRANSFORM_FALLBACKS):
        try:
            vs.view_transform = name
            break
        except (TypeError, ValueError):
            continue
    if hasattr(vs, "exposure"):
        vs.exposure = VIEW_EXPOSURE
    print(f"VIEW_TRANSFORM {vs.view_transform}")
    print(f"VIEW_EXPOSURE {vs.exposure}")

def set_default_viewport_shading(shading_type="MATERIAL"):
    """Best effort: saved file opens in Material Preview with material colours."""
    count = 0
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            for space in area.spaces:
                if space.type != "VIEW_3D":
                    continue
                try:
                    space.shading.type = shading_type
                    space.shading.color_type = "MATERIAL"
                except (AttributeError, RuntimeError, TypeError):
                    continue
                count += 1
    print(f"VIEWPORT_SHADING {count} spaces set")
    return count

NAME_PREFIX_RE = (
    r"^(FLOOR|ROOM|COL|NAV|TASK|KIT|CHAR|SIGN|EXT|CAM|SUN|LIGHT|STAIR|TGT)_"
)
NAME_PART_RE = (
    r"^(wall|slab|column|window|roof|tree|car|ground|road|sidewalk|desk|chair"
    r"|monitor|table|sofa|stair|door|plant|whiteboard|counter|coffee_table"
    r"|tile)_"
)
EXEMPT_COLLECTIONS = {
    "KIT_MESHY",
    "KIT_MESHY_V2",
    "CHARACTERS",
    "VERDICT_STAGE",
    "FLOOR_1_KIT_TEST",
    "KIT_TEST_CEILING",
}

PROJECT_COLLECTIONS = [
    "EXTERIOR",
    "FLOOR_1",
    "FLOOR_2",
    "FLOOR_3",
    "FLOOR_4",
    "KIT_BPY",
    "KIT_MESHY",
    "KIT_MESHY_V2",
    "CHARACTERS",
    "FLOOR_1_KIT_TEST",
    "KIT_TEST_CEILING",
    "VERDICT_STAGE",
    "LIGHTING",
    "CAMERAS",
]

# Trees: inside ground_main, clear of building, road band, kit room, verdict
# stage; >= 1.5 m clearance for r1.2 crowns.
TREE_POSITIONS = [
    (-6, 4),
    (-6, 12),
    (-4, 22),
    (4, 24),
    (14, 24),
    (24, 22),
    (26, 6),
    (-14, -4),
    (30, -4),
    (-20, 14),
]


# --- Color helpers ----------------------------------------------------------
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_rgba(hex_str):
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


# --- Materials --------------------------------------------------------------
GLASS_ALPHA = 0.35

def get_material(name, hex_str, *, emission_hex=None, emission_strength=0.0,
                 glass=False):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    principled = next(
        n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"
    )
    base_rgba = hex_to_rgba(hex_str)
    principled.inputs["Base Color"].default_value = base_rgba
    # Solid viewport 'Material' colour mode reads diffuse_color; without this
    # every bpy material shows default grey 0.8 in Solid shading.
    mat.diffuse_color = (base_rgba[0], base_rgba[1], base_rgba[2],
                         GLASS_ALPHA if glass else 1.0)
    principled.inputs["Roughness"].default_value = 0.8
    if emission_hex is not None:
        principled.inputs["Emission Color"].default_value = hex_to_rgba(
            emission_hex
        )
        principled.inputs["Emission Strength"].default_value = (
            emission_strength
        )
    if glass:
        principled.inputs["Alpha"].default_value = 0.35
        if hasattr(mat, "surface_render_method"):
            try:
                mat.surface_render_method = "BLENDED"
            except TypeError:
                pass
        elif hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "use_transparent_shadow"):
            mat.use_transparent_shadow = True
    return mat


def palette_material(key, **kwargs):
    return get_material(f"MAT_{key}", PALETTE[key], **kwargs)


# --- Collections ------------------------------------------------------------
def get_collection(name, parent=None):
    """Get-or-create. NEVER clears (builders accumulate into it)."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    parent_coll = parent or bpy.context.scene.collection
    if coll.name not in {c.name for c in parent_coll.children}:
        try:
            parent_coll.children.link(coll)
        except RuntimeError:
            pass  # already linked elsewhere in the tree
    return coll


def clear_project_collections():
    """The ONLY clearing path: wipe project collections + orphan data."""
    for name in PROJECT_COLLECTIONS:
        coll = bpy.data.collections.get(name)
        if coll is None:
            continue
        for obj in list(coll.all_objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(coll)
    for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                       bpy.data.cameras):
        for block in list(block_list):
            if block.users == 0:
                block_list.remove(block)


def reset_startup_scene():
    """Drop the default startup Cube/Camera/Light before building."""
    if bpy.app.background and not bpy.data.filepath:
        bpy.ops.wm.read_homefile(use_empty=True)
        return
    for name in ("Cube", "Camera", "Light"):
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)
    coll = bpy.data.collections.get("Collection")
    if coll is not None and not coll.objects and not coll.children:
        bpy.data.collections.remove(coll)


# --- Mesh builders (bmesh only) ---------------------------------------------
def _finish_mesh(name, bm, location, material, collection, rotation_z=0.0):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_flat()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if rotation_z:
        obj.rotation_euler = (0.0, 0.0, rotation_z)
    if material is not None:
        mesh.materials.append(material)
    collection.objects.link(obj)
    return obj


def make_box(name, size, location, material, collection, rotation_z=0.0):
    """Box with origin at base-centre (location = centre of bottom face)."""
    sx, sy, sz = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z = v.co.z * sz + sz / 2.0
    return _finish_mesh(name, bm, location, material, collection, rotation_z)


def make_cylinder(name, radius, depth, location, material, collection,
                  segments=12):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments,
        radius1=radius, radius2=radius, depth=1.0,
    )
    for v in bm.verts:
        v.co.z = v.co.z * depth + depth / 2.0
    return _finish_mesh(name, bm, location, material, collection)


def make_cone(name, radius, depth, location, material, collection,
              segments=12):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments,
        radius1=radius, radius2=0.0, depth=1.0,
    )
    for v in bm.verts:
        v.co.z = v.co.z * depth + depth / 2.0
    return _finish_mesh(name, bm, location, material, collection)


def make_icosphere(name, radius, location, material, collection,
                   subdivisions=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(
        bm, subdivisions=subdivisions, radius=radius
    )
    return _finish_mesh(name, bm, location, material, collection)


def make_empty(name, location, rotation=(0.0, 0.0, 0.0), collection=None,
               display="ARROWS"):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.location = location
    obj.rotation_euler = rotation
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def link_duplicate(src, name, location, rotation_z, collection):
    obj = bpy.data.objects.new(name, src.data)
    obj.location = location
    obj.rotation_euler = (0.0, 0.0, rotation_z)
    collection.objects.link(obj)
    return obj


# --- Tri counting -----------------------------------------------------------
def count_tris(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        eval_obj = obj.evaluated_get(depsgraph)
        mesh = eval_obj.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        eval_obj.to_mesh_clear()
    return total


def count_tris_by_collection():
    return {
        name: count_tris(bpy.data.collections[name].all_objects)
        for name in PROJECT_COLLECTIONS
        if name in bpy.data.collections
    }


# --- Self-check registry ----------------------------------------------------
SELF_CHECKS = []


def register_check(fn):
    SELF_CHECKS.append(fn)
    return fn


def check_guide_doc():
    doc = REPO_ROOT / "docs/redhunter-hq-brainstorming-guided.md"
    assert doc.exists(), f"check_guide_doc: missing {doc}"


def check_col_hide_render():
    bad = [
        o.name for o in bpy.data.objects
        if o.name.startswith("COL_") and not o.hide_render
    ]
    assert not bad, f"check_col_hide_render: renderable COL_* {bad}"


def check_naming():
    prefix = re.compile(NAME_PREFIX_RE)
    part = re.compile(NAME_PART_RE)
    exempt_objects = set()
    for coll_name in EXEMPT_COLLECTIONS:
        coll = bpy.data.collections.get(coll_name)
        if coll is not None:
            exempt_objects.update(o.name for o in coll.all_objects)
    bad = [
        o.name for o in bpy.data.objects
        if o.name not in exempt_objects
        and not prefix.match(o.name)
        and not part.match(o.name)
    ]
    assert not bad, f"check_naming: unnamed-convention objects {bad}"


def check_building_tris():
    names = ["FLOOR_1", "FLOOR_2", "FLOOR_3", "FLOOR_4", "EXTERIOR"]
    objects = []
    for name in names:
        coll = bpy.data.collections.get(name)
        if coll is not None:
            objects.extend(coll.all_objects)
    tris = count_tris(objects)
    budget = TRIS_BUDGET_OVERRIDE or TRIS_BUDGET_BUILDING
    assert tris <= budget, f"check_building_tris: {tris} > {budget}"


BASE_CHECKS = [
    check_guide_doc,
    check_col_hide_render,
    check_naming,
    check_building_tris,
]


def run_self_checks():
    """Run base + registered checks; print SELF_CHECK OK line or raise."""
    for check in BASE_CHECKS + SELF_CHECKS:
        try:
            check()
        except AssertionError:
            print(f"SELF_CHECK FAIL {check.__name__}")
            raise
    objects = len(bpy.data.objects)
    tris = count_tris(bpy.data.objects)
    print(f"SELF_CHECK OK {objects} objects {tris} tris")
