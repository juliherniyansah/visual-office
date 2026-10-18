"""Procedural furniture builders for the RedHunter HQ (Blender 5.x, bmesh).

Each ``make_<item>(name, location, rotation_z, collection, **kw)`` builds all
parts into ONE mesh object with multiple material slots, flat shaded, origin
at base-centre. Importable with no side effects; imports ``hq_lib`` only.
"""

import os

import bmesh
import bpy

from hq_lib import PALETTE, get_material, palette_material

CYL_SEGMENTS = 8


# --- bmesh part helpers -------------------------------------------------------
def _assign_new_faces(bm, start, mat_index):
    bm.faces.ensure_lookup_table()
    for face in bm.faces[start:]:
        face.material_index = mat_index


def _add_box(bm, size, center_xy, z_base, mat_index):
    """Axis-aligned box; (center_xy) = centre, z from z_base upward."""
    start = len(bm.faces)
    ret = bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    cx, cy = center_xy
    for v in ret["verts"]:
        v.co.x = v.co.x * sx + cx
        v.co.y = v.co.y * sy + cy
        v.co.z = v.co.z * sz + sz / 2.0 + z_base
    _assign_new_faces(bm, start, mat_index)


def _add_cylinder(bm, radius, depth, center_xy, z_base, mat_index,
                  segments=CYL_SEGMENTS):
    start = len(bm.faces)
    ret = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments,
        radius1=radius, radius2=radius, depth=1.0,
    )
    cx, cy = center_xy
    for v in ret["verts"]:
        v.co.x += cx
        v.co.y += cy
        v.co.z = v.co.z * depth + depth / 2.0 + z_base
    _assign_new_faces(bm, start, mat_index)


def _add_icosphere(bm, radius, center, mat_index, subdivisions=1):
    start = len(bm.faces)
    ret = bmesh.ops.create_icosphere(
        bm, subdivisions=subdivisions, radius=radius
    )
    cx, cy, cz = center
    for v in ret["verts"]:
        v.co.x += cx
        v.co.y += cy
        v.co.z += cz
    _assign_new_faces(bm, start, mat_index)


def _finish(name, bm, location, rotation_z, collection, materials):
    """One mesh object, slots in ``materials`` order, flat shaded."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_flat()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if rotation_z:
        obj.rotation_euler = (0.0, 0.0, rotation_z)
    collection.objects.link(obj)
    return obj


# --- Builders -----------------------------------------------------------------
def make_desk(name, location, rotation_z, collection, **kw):
    """Top 1.6x0.8x0.04 desk_top at z 0.73; 4 wood legs. 60 tris."""
    leg_h = 0.73
    # Negative test hook: HQ_TEST_BREAK_DESK=1 -> 1.5 m tall desk.
    if os.environ.get("HQ_TEST_BREAK_DESK"):
        leg_h = 1.46
    bm = bmesh.new()
    _add_box(bm, (1.6, 0.8, 0.04), (0.0, 0.0), leg_h, 0)
    for dx in (-0.75, 0.75):
        for dy in (-0.35, 0.35):
            _add_box(bm, (0.05, 0.05, leg_h), (dx, dy), 0.0, 1)
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("desk_top"), palette_material("wood")])


def make_chair(name, location, rotation_z, collection, **kw):
    """Teal seat+back, dark column and round base. 80 tris."""
    bm = bmesh.new()
    _add_box(bm, (0.45, 0.45, 0.06), (0.0, 0.0), 0.45, 0)   # seat
    _add_box(bm, (0.45, 0.06, 0.45), (0.0, 0.21), 0.51, 0)  # back (rear -? +Y)
    _add_cylinder(bm, 0.25, 0.03, (0.0, 0.0), 0.0, 1)       # 5-ish spoke base
    _add_cylinder(bm, 0.03, 0.42, (0.0, 0.0), 0.03, 1)      # column
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("teal"), palette_material("dark")])


def make_monitor(name, location, rotation_z, collection, on_desk=False,
                 **kw):
    """Dark panel + stand/foot; emissive screen quad on the -Y face.

    on_desk=False: floor-standing, panel centred at z 1.0 (top 1.165).
    on_desk=True: origin on the desk surface — foot z 0..0.02, stand
    z 0.02..0.10, panel z 0.10..0.43, screen centred z 0.265.
    """
    if on_desk:
        stand_h, panel_base, screen_z = 0.08, 0.10, 0.265
    else:
        # Plan lists stand h 0.2 but the panel bottom is at 0.835; the
        # stand is extended so the geometry connects (issues.md).
        stand_h, panel_base, screen_z = 0.815, 0.835, 1.0
    bm = bmesh.new()
    _add_box(bm, (0.55, 0.03, 0.33), (0.0, 0.0), panel_base, 0)  # panel
    _add_box(bm, (0.2, 0.15, 0.02), (0.0, 0.0), 0.0, 0)          # foot
    _add_cylinder(bm, 0.02, stand_h, (0.0, 0.0), 0.02, 0)        # stand
    # Screen quad on the front (-Y) face of the panel.
    start = len(bm.faces)
    ret = bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in ret["verts"]:
        x, y, _ = v.co
        v.co.x = x * 0.5
        v.co.z = y * 0.28 + screen_z
        v.co.y = -0.016
    _assign_new_faces(bm, start, 1)
    screen = get_material(
        "MAT_screen_emit", PALETTE["screen"],
        emission_hex=PALETTE["screen"], emission_strength=0.3,
    )
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("dark"), screen])


def make_meeting_table(name, location, rotation_z, collection, **kw):
    """Top 2.4x1.2x0.04 at z 0.73 on two dark pedestals. 68 tris."""
    bm = bmesh.new()
    _add_box(bm, (2.4, 1.2, 0.04), (0.0, 0.0), 0.73, 0)
    for dx in (-0.7, 0.7):
        _add_cylinder(bm, 0.15, 0.73, (dx, 0.0), 0.0, 1)
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("desk_top"), palette_material("dark")])


def make_whiteboard(name, location, rotation_z, collection, width=3.0, **kw):
    """Freestanding board width x 0.05 x 1.2 (z 0.9-2.1) on 2 dark posts."""
    bm = bmesh.new()
    _add_box(bm, (width, 0.05, 1.2), (0.0, 0.0), 0.9, 0)
    for dx in (-(width / 2 - 0.05), width / 2 - 0.05):
        _add_box(bm, (0.06, 0.06, 2.15), (dx, 0.0), 0.0, 1)
    white = get_material("MAT_white", "#FFFFFF")
    return _finish(name, bm, location, rotation_z, collection,
                   [white, palette_material("dark")])


def make_plant(name, location, rotation_z, collection, **kw):
    """Wood pot (r0.2 h0.35) + leaf icosphere r0.35 at z 0.6. 108 tris."""
    bm = bmesh.new()
    _add_cylinder(bm, 0.2, 0.35, (0.0, 0.0), 0.0, 0)
    _add_icosphere(bm, 0.35, (0.0, 0.0, 0.6), 1)
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("wood"), palette_material("leaf")])


def make_sofa(name, location, rotation_z, collection, **kw):
    """Orange sofa, footprint 2.0 x 0.9 centred, back on -Y. 48 tris."""
    bm = bmesh.new()
    _add_box(bm, (1.6, 0.9, 0.45), (0.0, 0.0), 0.0, 0)        # seat
    _add_box(bm, (1.6, 0.2, 0.4), (0.0, -0.35), 0.45, 0)      # back (-Y rear)
    for dx in (-0.9, 0.9):
        _add_box(bm, (0.2, 0.9, 0.6), (dx, 0.0), 0.0, 0)      # arms
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("orange")])


def make_counter(name, location, rotation_z, collection, **kw):
    """Teal body 3x0.8x1.1 + desk_top slab 3.1x0.9x0.04. 24 tris."""
    bm = bmesh.new()
    _add_box(bm, (3.0, 0.8, 1.1), (0.0, 0.0), 0.0, 0)
    _add_box(bm, (3.1, 0.9, 0.04), (0.0, 0.0), 1.1, 1)
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("teal"), palette_material("desk_top")])


def make_coffee_table(name, location, rotation_z, collection, **kw):
    """Wood top 1x0.6x0.04 at z 0.38 + 4 legs (height 0.42). 60 tris."""
    leg_h = 0.38
    bm = bmesh.new()
    _add_box(bm, (1.0, 0.6, 0.04), (0.0, 0.0), leg_h, 0)
    for dx in (-0.45, 0.45):
        for dy in (-0.25, 0.25):
            _add_box(bm, (0.05, 0.05, leg_h), (dx, dy), 0.0, 0)
    return _finish(name, bm, location, rotation_z, collection,
                   [palette_material("wood")])
