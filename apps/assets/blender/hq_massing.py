"""4-floor building shell + exterior for the RedHunter HQ.

Floor 1 gets only its slab here; interior detail lands in hq_floor1 (todo 4).
"""

import bmesh
import bpy

from hq_lib import (
    BUILDING_CENTER,
    FLOOR_COUNT,
    FLOOR_HEIGHT,
    FOOTPRINT_X,
    FOOTPRINT_Y,
    SELF_CHECKS,
    SLAB_THICKNESS,
    TREE_POSITIONS,
    WALL_THICKNESS,
    get_collection,
    make_box,
    palette_material,
    register_check,
)

CENTER_X, CENTER_Y = BUILDING_CENTER
WINDOW_HEIGHT = 1.2
WINDOW_WIDTH = 1.4
WINDOW_THICKNESS = 0.02
WINDOW_SILL = 1.0
WINDOW_PROUD = 0.085  # outward of the wall centreline
COLUMN_SIZE = 0.3
STAIR_VOID_X = (16.0, 19.0)
STAIR_VOID_Y = (9.0, 13.0)


def _floor_z(n):
    return (n - 1) * FLOOR_HEIGHT


def _make_slab_boxes(n, material, collection):
    """Slab with TOP flush at the floor level; floors 2-4 leave a stair void."""
    top = _floor_z(n)
    z = top - SLAB_THICKNESS
    if n == 1:
        make_box(
            f"slab_floor_{n}", (FOOTPRINT_X, FOOTPRINT_Y, SLAB_THICKNESS),
            (CENTER_X, CENTER_Y, z), material, collection,
        )
        return
    vx0, vx1 = STAIR_VOID_X
    vy0, vy1 = STAIR_VOID_Y
    pieces = {
        "w": ((vx0, FOOTPRINT_Y), (vx0 / 2.0, CENTER_Y)),
        "e": ((FOOTPRINT_X - vx1, FOOTPRINT_Y),
              ((vx1 + FOOTPRINT_X) / 2.0, CENTER_Y)),
        "s": ((vx1 - vx0, vy0), ((vx0 + vx1) / 2.0, vy0 / 2.0)),
        "n": ((vx1 - vx0, FOOTPRINT_Y - vy1),
              ((vx0 + vx1) / 2.0, (vy1 + FOOTPRINT_Y) / 2.0)),
    }
    for side, ((sx, sy), (cx, cy)) in pieces.items():
        make_box(
            f"slab_floor_{n}_{side}", (sx, sy, SLAB_THICKNESS),
            (cx, cy, z), material, collection,
        )


def _make_walls(n, material, collection):
    z = _floor_z(n)
    half_t = WALL_THICKNESS / 2.0
    inner_len = FOOTPRINT_Y - 2 * WALL_THICKNESS
    walls = {
        "s": ((FOOTPRINT_X, WALL_THICKNESS), (CENTER_X, half_t)),
        "n": ((FOOTPRINT_X, WALL_THICKNESS),
              (CENTER_X, FOOTPRINT_Y - half_t)),
        "w": ((WALL_THICKNESS, inner_len), (half_t, CENTER_Y)),
        "e": ((WALL_THICKNESS, inner_len),
              (FOOTPRINT_X - half_t, CENTER_Y)),
    }
    for side, ((sx, sy), (cx, cy)) in walls.items():
        make_box(
            f"wall_f{n}_{side}", (sx, sy, FLOOR_HEIGHT),
            (cx, cy, z), material, collection,
        )


def _make_windows(n, material, collection):
    z = _floor_z(n) + WINDOW_SILL
    half_t = WALL_THICKNESS / 2.0
    proud_s = half_t - WINDOW_PROUD
    proud_n = FOOTPRINT_Y - half_t + WINDOW_PROUD
    proud_w = half_t - WINDOW_PROUD
    proud_e = FOOTPRINT_X - half_t + WINDOW_PROUD
    index = 0
    for x in range(1, int(FOOTPRINT_X), 2):
        for cy in (proud_s, proud_n):
            index += 1
            make_box(
                f"window_f{n}_{index}",
                (WINDOW_WIDTH, WINDOW_THICKNESS, WINDOW_HEIGHT),
                (float(x), cy, z), material, collection,
            )
    for y in range(1, int(FOOTPRINT_Y), 2):
        for cx in (proud_w, proud_e):
            index += 1
            make_box(
                f"window_f{n}_{index}",
                (WINDOW_THICKNESS, WINDOW_WIDTH, WINDOW_HEIGHT),
                (cx, float(y), z), material, collection,
            )


def _make_columns(n, material, collection):
    z = _floor_z(n)
    index = 0
    for x in (4.0, 8.0, 12.0, 16.0):
        for y in (4.0, 8.0, 12.0):
            index += 1
            make_box(
                f"column_f{n}_{index}",
                (COLUMN_SIZE, COLUMN_SIZE, FLOOR_HEIGHT),
                (x, y, z), material, collection,
            )


def build_massing():
    slab_mat = palette_material("floor")
    wall_mat = palette_material("exterior")
    glass_mat = palette_material("glass", glass=True)
    red_mat = palette_material("red")
    for n in range(1, FLOOR_COUNT + 1):
        coll = get_collection(f"FLOOR_{n}")
        _make_slab_boxes(n, slab_mat, coll)
        if n >= 2:
            _make_walls(n, wall_mat, coll)
            _make_windows(n, glass_mat, coll)
            _make_columns(n, wall_mat, coll)
        collider = make_box(
            f"COL_slab_floor_{n}",
            (FOOTPRINT_X, FOOTPRINT_Y, SLAB_THICKNESS),
            (CENTER_X, CENTER_Y, _floor_z(n) - SLAB_THICKNESS),
            None, coll,
        )
        collider.hide_render = True
        collider.display_type = "WIRE"
    roof_coll = bpy.data.collections["FLOOR_4"]
    make_box(
        "roof_top", (FOOTPRINT_X, FOOTPRINT_Y, SLAB_THICKNESS),
        (CENTER_X, CENTER_Y, FLOOR_COUNT * FLOOR_HEIGHT - SLAB_THICKNESS),
        wall_mat, roof_coll,
    )
    # Front facade sign, centred at (10, -0.1, 3*3.2 + 2.0).
    make_box(
        "SIGN_redhunter", (4.0, 0.2, 0.8),
        (10.0, -0.1, 3 * FLOOR_HEIGHT + 2.0 - 0.4), red_mat, roof_coll,
    )
    if check_massing not in SELF_CHECKS:
        register_check(check_massing)


def _make_tree(name, x, y, style, trunk_mat, crown_mat, collection):
    """One mesh per tree: trunk + crown, two material slots."""
    bm = bmesh.new()
    ret = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=8,
        radius1=0.15, radius2=0.15, depth=1.0,
    )
    for v in ret["verts"]:
        v.co.z += 0.5  # trunk spans z 0..1
    # bmesh.ops does NOT append faces in creation order — snapshot instead.
    trunk_faces = set(bm.faces)
    if style == "round":
        ret = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.2)
        for v in ret["verts"]:
            v.co.z += 1.8
    else:
        ret = bmesh.ops.create_cone(
            bm, cap_ends=True, segments=8,
            radius1=1.2, radius2=0.0, depth=2.5,
        )
        for v in ret["verts"]:
            v.co.z += 2.25  # cone base at z 1.0
    for face in bm.faces:
        if face not in trunk_faces:
            face.material_index = 1
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_flat()
    mesh.materials.append(trunk_mat)
    mesh.materials.append(crown_mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x, y, 0.0)
    collection.objects.link(obj)
    return obj


def build_exterior():
    coll = get_collection("EXTERIOR")
    ground_mat = palette_material("ground")
    road_mat = palette_material("road")
    sidewalk_mat = palette_material("sidewalk")
    # Ground top at z=-0.01 so slabs/plates at z>=0 never z-fight.
    make_box(
        "ground_main", (80.0, 80.0, 0.05),
        (CENTER_X, CENTER_Y, -0.06), ground_mat, coll,
    )
    make_box(
        "road_main", (80.0, 6.0, 0.05),
        (CENTER_X, -12.0, -0.04), road_mat, coll,
    )
    make_box(
        "sidewalk_n", (80.0, 2.0, 0.05),
        (CENTER_X, -8.0, -0.03), sidewalk_mat, coll,
    )
    make_box(
        "sidewalk_s", (80.0, 2.0, 0.05),
        (CENTER_X, -16.0, -0.03), sidewalk_mat, coll,
    )
    trunk_mat = palette_material("wood")
    crown_mat = palette_material("leaf")
    for i, (x, y) in enumerate(TREE_POSITIONS, start=1):
        style = "round" if i <= 5 else "cone"
        _make_tree(f"tree_{i}", x, y, style, trunk_mat, crown_mat, coll)
    make_box(
        "car_1", (4.0, 1.8, 1.2), (-8.0, -12.0, 0.01),
        palette_material("teal"), coll,
    )
    make_box(
        "car_2", (4.0, 1.8, 1.2), (28.0, -12.0, 0.01),
        palette_material("orange"), coll,
    )


def check_massing():
    for n in range(1, FLOOR_COUNT + 1):
        assert f"FLOOR_{n}" in bpy.data.collections, (
            f"check_massing: missing collection FLOOR_{n}"
        )
        slab_name = "slab_floor_1" if n == 1 else f"slab_floor_{n}_w"
        slab = bpy.data.objects.get(slab_name)
        assert slab is not None, f"check_massing: missing {slab_name}"
        top = slab.location.z + SLAB_THICKNESS
        expected = _floor_z(n)
        assert abs(top - expected) <= 0.01, (
            f"check_massing: {slab_name} top {top} != {expected}"
        )
    assert bpy.data.objects.get("roof_top") is not None, (
        "check_massing: missing roof_top"
    )
    assert bpy.data.objects.get("SIGN_redhunter") is not None, (
        "check_massing: missing SIGN_redhunter"
    )
    check_tree_materials()


def check_tree_materials():
    trees = [o for o in bpy.data.objects if o.name.startswith("tree_")]
    assert len(trees) == len(TREE_POSITIONS), (
        f"check_tree_materials: {len(trees)} trees"
    )
    for obj in trees:
        index = int(obj.name.split("_")[1])
        crown_min_z = 0.6 if index <= 5 else 1.0
        trunk_faces = 0
        for poly in obj.data.polygons:
            z = poly.center.z
            if poly.material_index == 0:
                trunk_faces += 1
                assert z <= 1.0 + 1e-4, (
                    f"check_tree_materials: {obj.name} trunk face at z={z}"
                )
            else:
                assert z >= crown_min_z, (
                    f"check_tree_materials: {obj.name} crown face at z={z}"
                )
        assert trunk_faces == 10, (
            f"check_tree_materials: {obj.name} trunk_faces={trunk_faces}"
        )
