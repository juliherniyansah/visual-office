"""Meshy kit normalization + the kit-vs-bpy meeting room test (todo 12).

``build_kit_meshy`` normalizes the 4 raw Meshy GLBs into KIT_MESHY and
writes renders/kit_metrics.json. ``build_room_meeting_kit`` copies the
meeting room context at offset (+30, 0, 0) into FLOOR_1_KIT_TEST, using
Meshy pieces ONLY for solid walls, the door and the floor. Both run only
under build_hq --with-kit (never auto-detected). Importable, no side
effects.

``build_verdict_stage`` (todo 17) builds the VERDICT_STAGE comparison set:
Meshy-look plate (tiles + Meshy wall/door) left, bpy-look plate right, a
static copy of the character between them, all south of the building for
CAM_verdict. Runs only under build_hq --with-verdict-stage.
"""

import json
import os
from math import radians

import bpy
from mathutils import Vector

from hq_lib import (
    FLOOR_HEIGHT,
    FOOTPRINT_X,
    FOOTPRINT_Y,
    RAW_MESHY_DIR,
    RENDER_DIR,
    SELF_CHECKS,
    SLAB_THICKNESS,
    WALL_THICKNESS,
    get_collection,
    hex_to_rgba,
    link_duplicate,
    make_box,
    make_empty,
    palette_material,
    register_check,
)
from hq_furniture import (
    make_chair,
    make_desk,
    make_meeting_table,
    make_monitor,
    make_whiteboard,
)
from hq_lighting import AREA_ENERGY, AREA_HEX
from normalize_kit import normalize_kit_piece

KIT_OFFSET_X = 30.0
ROOM_CENTER = (11.0 + KIT_OFFSET_X, 11.0)
TILE_TOP_Z = 0.005
TILE_Z = -0.095  # 0.1 m tile, base-centre origin -> top at +0.005
DIMS_TOLERANCE = 0.01
DOOR_Y = 9.0

# piece -> (target size, pre_rotate_x_deg). The raw Meshy floor tile imports
# as an UPRIGHT slab (thin axis Y); +90 deg about X lays it flat first.
# Floor texture: the refined bake is a see-through black/white lattice, not
# terrazzo (evidence 30-thumb-KIT_floor_1m.png) — judged in the r1 render;
# if confirmed bad, set FLOOR_FORCE_FALLBACK = True (honest palette floor,
# reported as fallback in metrics + QA).
PIECES = {
    "wall_1m": ((1.0, WALL_THICKNESS, FLOOR_HEIGHT), 0.0),
    "wall_door": ((1.0, WALL_THICKNESS, FLOOR_HEIGHT), 0.0),
    "floor_1m": ((1.0, 1.0, 0.1), 90.0),
    "pillar": ((0.3, 0.3, FLOOR_HEIGHT), 0.0),
}
FLOOR_FORCE_FALLBACK = False


def _fallback_from_bpy(piece):
    """Missing GLB: share the bpy kit source mesh under the meshy name."""
    src = bpy.data.objects[f"KIT_{piece}"]
    coll = get_collection("KIT_MESHY")
    coll.hide_render = True
    obj = link_duplicate(src, f"KIT_meshy_{piece}", (0.0, 0.0, 0.0), 0.0,
                         coll)
    return obj


def build_kit_meshy():
    """Normalize RAW_MESHY_DIR/kit/KIT_<piece>.glb into KIT_MESHY."""
    metrics = {}
    for piece, (size, pre_rot) in PIECES.items():
        glb = RAW_MESHY_DIR / "kit" / f"KIT_{piece}.glb"
        entry = {
            "bpy_name": f"KIT_{piece}",
            "meshy_name": f"KIT_meshy_{piece}",
            "target_size": list(size),
        }
        if not glb.is_file():
            obj = _fallback_from_bpy(piece)
            obj.data.calc_loop_triangles()
            entry.update(
                missing="MISSING", tris=len(obj.data.loop_triangles),
                tris_raw=0, fallback=True, smooth=False, nonuniform=False,
                texture_size=[0, 0],
            )
        else:
            force = FLOOR_FORCE_FALLBACK and piece == "floor_1m"
            obj, info = normalize_kit_piece(
                str(glb), f"KIT_meshy_{piece}", size,
                pre_rotate_x_deg=pre_rot,
                force_fallback=force, fallback_key="floor",
                nonuniform_tolerance=DIMS_TOLERANCE / 2.0,
            )
            entry.update(info)
            if info["fallback"] and info["tris"] > 1500:
                entry["QUALITY_FAIL"] = True
        obj.hide_render = True
        metrics[piece] = entry
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    with open(RENDER_DIR / "kit_metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2)
    print("KIT_METRICS", json.dumps(metrics))
    return metrics


# --- Kit test room -----------------------------------------------------------
def _place_meshy(piece, name, location, rotation_z, coll):
    src = bpy.data.objects[f"KIT_meshy_{piece}"]
    return link_duplicate(src, name, location, rotation_z, coll)


def _place_glass(name, location, rotation_z, coll, half=False):
    obj = link_duplicate(
        bpy.data.objects["KIT_wall_glass_1m"], name, location, rotation_z,
        coll,
    )
    if half:
        obj.scale = (0.5, 1.0, 1.0)
    return obj


def _build_slabs(coll):
    """Ground-level + ceiling slab so lighting/occlusion match the bpy room
    (its floor is slab_floor_1 top z 0; its ceiling slab_floor_2 underside
    z 3.0)."""
    cx = 10.0 + KIT_OFFSET_X
    make_box(
        "slab_kit_floor", (FOOTPRINT_X, FOOTPRINT_Y, SLAB_THICKNESS),
        (cx, 7.0, -SLAB_THICKNESS), palette_material("floor"), coll,
    )
    ceiling_coll = get_collection("KIT_TEST_CEILING", parent=coll)
    make_box(
        "slab_kit_ceiling", (FOOTPRINT_X, FOOTPRINT_Y, SLAB_THICKNESS),
        (cx, 7.0, FLOOR_HEIGHT - SLAB_THICKNESS),
        palette_material("floor"), ceiling_coll,
    )


def _build_walls(coll):
    """North perimeter run x 38-44 (solid = Meshy, glass = bpy) + meeting
    glass walls + Meshy door at (38, 9) — mirrors hq_floor1 exactly."""
    rot90 = radians(90)
    y_north = FOOTPRINT_Y - WALL_THICKNESS / 2.0
    for i in range(8, 14):
        cx = i + 0.5 + KIT_OFFSET_X
        name = f"wall_kit_n_{i + 1}"
        if i % 2 == 1:
            _place_glass(name, (cx, y_north, 0.0), 0.0, coll)
        else:
            _place_meshy("wall_1m", name, (cx, y_north, 0.0), 0.0, coll)
    x_west = 8.0 + KIT_OFFSET_X
    for i in range(6):
        cy = 8.5 + i
        if abs(cy - DOOR_Y) <= 0.5:
            continue
        _place_glass(
            f"wall_kit_x8_{i + 1}", (x_west, cy, 0.0), rot90, coll
        )
    for j, cy in enumerate((DOOR_Y - 0.75, DOOR_Y + 0.75), start=1):
        _place_glass(
            f"wall_kit_x8_fill_{j}", (x_west, cy, 0.0), rot90, coll,
            half=True,
        )
    _place_meshy(
        "wall_door", "door_kit_meeting", (x_west, DOOR_Y, 0.0), rot90, coll
    )
    for i in range(6):
        _place_glass(
            f"wall_kit_y8_{i + 1}",
            (8.5 + i + KIT_OFFSET_X, 8.0, 0.0), 0.0, coll,
        )


def _build_floor_tiles(coll):
    for i in range(6):
        for j in range(6):
            tile = _place_meshy(
                "floor_1m", f"tile_kit_{i * 6 + j + 1}",
                (38.5 + i, 8.5 + j, TILE_Z), 0.0, coll,
            )
            if i == 0 and j == 0 and os.environ.get("HQ_INJECT_BAD_KIT_TILE"):
                tile.location.z += 0.05


def _build_furniture(coll):
    cx, cy = ROOM_CENTER
    make_meeting_table("table_meeting_kit", (cx, cy, 0.0), 0.0, coll)
    for i in range(3):
        make_chair(
            f"chair_meeting_kit_{i + 1}", (cx - 1.0 + i, cy - 1.0, 0.0),
            0.0, coll,
        )
        make_chair(
            f"chair_meeting_kit_{i + 4}", (cx - 1.0 + i, cy + 1.0, 0.0),
            radians(180), coll,
        )
    make_whiteboard(
        "whiteboard_meeting_kit", (cx, 13.9, 0.0), 0.0, coll, width=3.0
    )
    make_empty("TASK_board_kit", (cx, 13.9, 1.5), collection=coll)


def _build_light(coll):
    """Kit twin of LIGHT_area_meeting. Lives in FLOOR_1_KIT_TEST (NOT the
    LIGHTING collection) so render_hq's build_lighting rebuild cannot wipe
    it. Day energy; this room is only rendered in day phase."""
    data = bpy.data.lights.new("LIGHT_area_meeting_kit", "AREA")
    data.shape = "SQUARE"
    data.size = 4.0
    data.energy = AREA_ENERGY["day"]
    data.color = hex_to_rgba(AREA_HEX)[:3]
    obj = bpy.data.objects.new("LIGHT_area_meeting_kit", data)
    obj.location = (ROOM_CENTER[0], ROOM_CENTER[1], 2.9)
    coll.objects.link(obj)


def _collider(name, size, location, coll, rotation_z=0.0):
    obj = make_box(name, size, location, None, coll, rotation_z)
    obj.hide_render = True
    obj.display_type = "WIRE"
    return obj


def _build_markers(coll):
    cx, cy = ROOM_CENTER
    area = make_box(
        "ROOM_meeting_a_kit", (6.0, 6.0, 0.01), (cx, cy, 0.011),
        palette_material("floor"), coll,
    )
    # Area marker only: at z 0.011 it would cover the Meshy tiles in renders.
    area.hide_render = True
    _collider(
        "COL_wall_meeting_x8_kit", (0.05, 6.0, FLOOR_HEIGHT),
        (8.0 + KIT_OFFSET_X, cy, 0.0), coll,
    )
    _collider(
        "COL_wall_meeting_y8_kit", (6.0, 0.05, FLOOR_HEIGHT),
        (cx, 8.0, 0.0), coll,
    )
    _collider(
        "COL_table_meeting_kit", (2.4, 1.2, 0.75), (cx, cy, 0.0), coll
    )
    make_empty("NAV_wp_meeting_a_kit", (cx, cy, 0.0), collection=coll)


def build_room_meeting_kit():
    coll = get_collection("FLOOR_1_KIT_TEST")
    _build_slabs(coll)
    _build_walls(coll)
    _build_floor_tiles(coll)
    _build_furniture(coll)
    _build_light(coll)
    _build_markers(coll)
    if check_kit_room not in SELF_CHECKS:
        register_check(check_kit_room)


# --- Self-check ---------------------------------------------------------------
def _world_z_max(obj):
    return max((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)


def check_kit_room():
    from hq_lib import KIT_UNUSED_OK

    kit = bpy.data.collections.get("KIT_MESHY")
    assert kit is not None, "check_kit_room: missing KIT_MESHY"
    for piece, (size, _) in PIECES.items():
        obj = bpy.data.objects.get(f"KIT_meshy_{piece}")
        assert obj is not None, f"check_kit_room: missing KIT_meshy_{piece}"
        dims = obj.dimensions
        for axis in range(3):
            rel = abs(dims[axis] - size[axis]) / size[axis]
            assert rel <= DIMS_TOLERANCE, (
                f"check_kit_room: KIT_meshy_{piece} axis {axis} "
                f"{dims[axis]:.4f} vs {size[axis]} ({rel:.1%})"
            )
    under = [
        o.name for o in kit.objects
        if o.name not in KIT_UNUSED_OK and o.data.users < 2
    ]
    assert not under, f"check_kit_room: uninstanced kit pieces {under}"

    area = bpy.data.objects.get("ROOM_meeting_a_kit")
    assert area is not None, "check_kit_room: missing ROOM_meeting_a_kit"
    assert area.hide_render, "check_kit_room: ROOM_meeting_a_kit renderable"

    test_coll = bpy.data.collections.get("FLOOR_1_KIT_TEST")
    assert test_coll is not None, "check_kit_room: missing FLOOR_1_KIT_TEST"
    floor_data = bpy.data.objects["KIT_meshy_floor_1m"].data
    tiles = [
        o for o in test_coll.all_objects
        if o.type == "MESH" and o.data is floor_data
    ]
    assert len(tiles) == 36, f"check_kit_room: {len(tiles)} tiles != 36"
    for tile in tiles:
        z_max = _world_z_max(tile)
        assert abs(z_max - TILE_TOP_Z) <= 0.002, (
            f"check_kit_room: {tile.name} z-max {z_max:.4f} != {TILE_TOP_Z}"
        )

    ceiling_coll = bpy.data.collections.get("KIT_TEST_CEILING")
    assert ceiling_coll is not None, "check_kit_room: missing KIT_TEST_CEILING"
    assert "slab_kit_ceiling" in {o.name for o in ceiling_coll.objects}, (
        "check_kit_room: slab_kit_ceiling not in KIT_TEST_CEILING"
    )


# --- Verdict stage (todo 17) --------------------------------------------------
# Meshy-look plate x -6..0, bpy-look plate x 6..12, both y -30..-24; character
# between them at (3,-27); walls behind at y -24.1; CAM_verdict frames all.
STAGE_MESHY_X0 = -6.0
STAGE_BPY_CENTER = (9.0, -27.0)
STAGE_PLATE_Y0 = -30.0
STAGE_WALL_Y = -24.1
STAGE_CHAR_POS = (3.0, -27.0, 0.0)
STAGE_CHAR_HEIGHT_MIN = 1.65
STAGE_CHAR_HEIGHT_MAX = 1.75
STAGE_CHAR_FEET_TOL = 0.02
GROUND_VERDICT_TOP_Z = -0.01
STAGE_REQUIRED = (
    "slab_verdict_bpy", "CHAR_BASE_stage", "ground_verdict",
    "wall_verdict_meshy", "door_verdict_meshy",
    "wall_verdict_bpy", "door_verdict_bpy",
    "desk_verdict_meshy", "chair_verdict_meshy", "monitor_verdict_meshy",
    "desk_verdict_bpy", "chair_verdict_bpy", "monitor_verdict_bpy",
)


def _stage_char_world_z(obj):
    """(zmin, zmax) of the static stage mesh in world space (no modifiers)."""
    mw = obj.matrix_world
    zs = [(mw @ v.co).z for v in obj.data.vertices]
    return min(zs), max(zs)


def check_verdict_stage():
    coll = bpy.data.collections.get("VERDICT_STAGE")
    assert coll is not None, "check_verdict_stage: missing VERDICT_STAGE"
    names = {o.name for o in coll.all_objects}
    missing = sorted(set(STAGE_REQUIRED) - names)
    assert not missing, f"check_verdict_stage: missing {missing}"

    floor_data = bpy.data.objects["KIT_meshy_floor_1m"].data
    tiles = [
        o for o in coll.all_objects
        if o.type == "MESH" and o.data is floor_data
    ]
    assert len(tiles) == 36, (
        f"check_verdict_stage: {len(tiles)} verdict tiles != 36"
    )
    for tile in tiles:
        z_max = _world_z_max(tile)
        assert abs(z_max - TILE_TOP_Z) <= 0.002, (
            f"check_verdict_stage: {tile.name} z-max {z_max:.4f} "
            f"!= {TILE_TOP_Z}"
        )

    char = bpy.data.objects["CHAR_BASE_stage"]
    assert not char.modifiers, (
        "check_verdict_stage: CHAR_BASE_stage has modifiers (must be static)"
    )
    zmin, zmax = _stage_char_world_z(char)
    height = zmax - zmin
    assert STAGE_CHAR_HEIGHT_MIN <= height <= STAGE_CHAR_HEIGHT_MAX, (
        f"check_verdict_stage: character height {height:.3f} outside "
        f"{STAGE_CHAR_HEIGHT_MIN}-{STAGE_CHAR_HEIGHT_MAX}"
    )
    assert abs(zmin) <= STAGE_CHAR_FEET_TOL, (
        f"check_verdict_stage: character feet z {zmin:.4f} off the plate"
    )

    for obj in coll.all_objects:
        colls = {c.name for c in obj.users_collection}
        assert colls == {"VERDICT_STAGE"}, (
            f"check_verdict_stage: {obj.name} also in {colls}"
        )

    ground = bpy.data.objects["ground_verdict"]
    top = _world_z_max(ground)
    assert abs(top - GROUND_VERDICT_TOP_Z) <= 0.002, (
        f"check_verdict_stage: ground_verdict top {top:.4f} "
        f"!= {GROUND_VERDICT_TOP_Z}"
    )
    print(
        f"CHECK_VERDICT_STAGE height {height:.3f} zmin {zmin:.4f} "
        f"tiles {len(tiles)}"
    )


def _stage_character(coll):
    """Static copy of the EVALUATED character mesh at frame 1.

    The raw CHAR_BASE_mesh.data is skinned in rest pose (world height
    1.759 > 1.75 gate); the evaluated frame-1 idle pose is 1.70. World
    scale comes from the MESH object's matrix_world (armature parent
    scale ~0.0103 included), per the plan.
    """
    rigged = bpy.data.objects.get("CHAR_BASE_mesh")
    src = rigged if rigged is not None else bpy.data.objects["CHAR_BASE"]
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = src.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(
        eval_obj, preserve_all_data_layers=True, depsgraph=depsgraph
    )
    mesh.name = "CHAR_BASE_stage"
    obj = bpy.data.objects.new("CHAR_BASE_stage", mesh)
    obj.scale = src.matrix_world.to_scale()
    obj.location = STAGE_CHAR_POS  # faces -Y (camera): glTF forward
    coll.objects.link(obj)
    bpy.context.view_layer.update()
    zmin, _zmax = _stage_char_world_z(obj)
    obj.location.z -= zmin  # feet exactly on z 0
    bpy.context.view_layer.update()
    return obj


def _stage_plate_meshy(coll):
    """6x6 Meshy tiles (top +0.005) + Meshy wall/door + bpy desk set."""
    n = 0
    for i in range(6):
        for j in range(6):
            n += 1
            _place_meshy(
                "floor_1m", f"tile_verdict_{n}",
                (STAGE_MESHY_X0 + 0.5 + i, STAGE_PLATE_Y0 + 0.5 + j, TILE_Z),
                0.0, coll,
            )
    _place_meshy(
        "wall_1m", "wall_verdict_meshy",
        (-3.5, STAGE_WALL_Y, TILE_TOP_Z), 0.0, coll,
    )
    _place_meshy(
        "wall_door", "door_verdict_meshy",
        (-2.5, STAGE_WALL_Y, TILE_TOP_Z), 0.0, coll,
    )
    make_desk("desk_verdict_meshy", (-3.0, -27.0, TILE_TOP_Z), 0.0, coll)
    make_chair("chair_verdict_meshy", (-3.0, -27.9, TILE_TOP_Z), 0.0, coll)
    make_monitor(
        "monitor_verdict_meshy", (-3.0, -27.0, TILE_TOP_Z + 0.77), 0.0,
        coll, on_desk=True,
    )


def _stage_plate_bpy(coll):
    """6x6x0.1 flat slab (top z 0) + bpy wall/door + bpy desk set."""
    cx, cy = STAGE_BPY_CENTER
    make_box(
        "slab_verdict_bpy", (6.0, 6.0, 0.1), (cx, cy, -0.1),
        palette_material("floor"), coll,
    )
    link_duplicate(
        bpy.data.objects["KIT_wall_1m"], "wall_verdict_bpy",
        (8.5, STAGE_WALL_Y, 0.0), 0.0, coll,
    )
    link_duplicate(
        bpy.data.objects["KIT_wall_door"], "door_verdict_bpy",
        (9.5, STAGE_WALL_Y, 0.0), 0.0, coll,
    )
    make_desk("desk_verdict_bpy", (cx, cy, 0.0), 0.0, coll)
    make_chair("chair_verdict_bpy", (cx, cy - 0.9, 0.0), 0.0, coll)
    make_monitor(
        "monitor_verdict_bpy", (cx, cy, 0.77), 0.0, coll, on_desk=True
    )


def build_verdict_stage():
    """VERDICT_STAGE comparison set; needs KIT_MESHY + CHAR_BASE built."""
    coll = get_collection("VERDICT_STAGE")
    _stage_plate_meshy(coll)
    _stage_plate_bpy(coll)
    char = _stage_character(coll)
    make_box(
        "ground_verdict", (40.0, 28.0, 0.05), (3.0, -47.0, -0.06),
        palette_material("ground"), coll,
    )
    if os.environ.get("HQ_INJECT_BAD_STAGE"):
        char.location.z += 0.5  # negative hook: feet off the plate
    if check_verdict_stage not in SELF_CHECKS:
        register_check(check_verdict_stage)
