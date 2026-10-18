"""Floor 1 interior for the RedHunter HQ: bpy kit, rooms, stairs, colliders.

Importable with no side effects. Perimeter and partition walls are linked
duplicates of KIT_BPY sources (shared mesh data, never unique meshes).
Furniture builders come from hq_furniture (todo 5); until it lands a stub
fallback builds plain boxes with the same footprints (todo 8 removes it).
"""

import os
from math import atan2, hypot, radians

import bmesh
import bpy

from hq_lib import (
    CAM_TARGETS,
    CHARACTER_SPAWN,
    FLOOR_HEIGHT,
    FOOTPRINT_X,
    FOOTPRINT_Y,
    KIT_UNUSED_OK,
    SELF_CHECKS,
    WALL_THICKNESS,
    get_collection,
    link_duplicate,
    make_box,
    make_empty,
    palette_material,
    register_check,
)

HALF_WALL = WALL_THICKNESS / 2.0
# Side walls sit 2 mm inside the facade plane so their faces never share a
# plane with the front/back wall end faces (z-fighting at the corners).
SIDE_INSET = 0.002
KIT_SOURCE_POS = (0.0, -5.0, 0.0)
GLASS_THICKNESS = 0.05
DOOR_CLEAR_HEIGHT = 2.1

# Furniture footprints (x, y, z); colliders are exactly these boxes.
DESK_SIZE = (1.6, 0.8, 0.77)
CHAIR_SIZE = (0.5, 0.5, 0.85)
SOFA_SIZE = (2.0, 0.9, 0.85)
COUNTER_SIZE = (3.0, 0.8, 1.1)
MEETING_TABLE_SIZE = (2.4, 1.2, 0.75)
COFFEE_TABLE_SIZE = (1.0, 0.6, 0.45)
MONITOR_SIZE = (0.5, 0.05, 0.35)
PLANT_SIZE = (0.3, 0.3, 0.9)

STEP_SIZE = (3.0, 0.25, 0.2)
STEP_COUNT = 16
STAIR_X = 17.5
STAIR_RUN_Y0 = 9.0
STAIR_RUN_LENGTH = 4.0

# (side, horizontal?, fixed coordinate, segment count, door centre or None)
PERIMETER_SIDES = (
    ("s", True, HALF_WALL, 20, 4.0),
    ("n", True, FOOTPRINT_Y - HALF_WALL, 20, None),
    ("w", False, HALF_WALL + SIDE_INSET, 14, 7.0),
    ("e", False, FOOTPRINT_X - HALF_WALL - SIDE_INSET, 14, None),
)

from hq_furniture import (
    make_chair,
    make_coffee_table,
    make_counter,
    make_desk,
    make_meeting_table,
    make_monitor,
    make_plant,
    make_sofa,
    make_whiteboard,
)


# --- Kit sources --------------------------------------------------------------
def _add_part(bm, size, offset):
    """Add one scaled cube centred at offset into an open bmesh."""
    ret = bmesh.ops.create_cube(bm, size=1.0)
    for v in ret["verts"]:
        v.co.x = v.co.x * size[0] + offset[0]
        v.co.y = v.co.y * size[1] + offset[1]
        v.co.z = v.co.z * size[2] + offset[2]


def _make_door_kit(collection):
    """Door piece: 2 posts + lintel (frame) and orange leaf — no booleans."""
    lintel_height = FLOOR_HEIGHT - DOOR_CLEAR_HEIGHT
    bm = bmesh.new()
    _add_part(bm, (0.05, WALL_THICKNESS, DOOR_CLEAR_HEIGHT), (-0.475, 0, 1.05))
    _add_part(bm, (0.05, WALL_THICKNESS, DOOR_CLEAR_HEIGHT), (0.475, 0, 1.05))
    _add_part(
        bm, (1.0, WALL_THICKNESS, lintel_height),
        (0.0, 0.0, DOOR_CLEAR_HEIGHT + lintel_height / 2.0),
    )
    frame_face_count = len(bm.faces)
    _add_part(bm, (0.9, 0.04, DOOR_CLEAR_HEIGHT), (0.0, 0.0, 1.05))
    bm.faces.ensure_lookup_table()
    for face in bm.faces[frame_face_count:]:
        face.material_index = 1
    mesh = bpy.data.meshes.new("KIT_wall_door")
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_flat()
    mesh.materials.append(palette_material("interior"))
    mesh.materials.append(palette_material("orange"))
    obj = bpy.data.objects.new("KIT_wall_door", mesh)
    obj.location = KIT_SOURCE_POS
    collection.objects.link(obj)
    return obj


def build_kit_bpy():
    """Create KIT_BPY source pieces in a render-hidden collection."""
    coll = get_collection("KIT_BPY")
    coll.hide_render = True
    make_box(
        "KIT_wall_1m", (1.0, WALL_THICKNESS, FLOOR_HEIGHT), KIT_SOURCE_POS,
        palette_material("interior"), coll,
    )
    make_box(
        "KIT_wall_glass_1m", (1.0, GLASS_THICKNESS, FLOOR_HEIGHT),
        KIT_SOURCE_POS, palette_material("glass", glass=True), coll,
    )
    _make_door_kit(coll)
    make_box(
        "KIT_floor_1m", (1.0, 1.0, 0.1), KIT_SOURCE_POS,
        palette_material("floor"), coll,
    )
    make_box(
        "KIT_pillar", (0.3, 0.3, FLOOR_HEIGHT), KIT_SOURCE_POS,
        palette_material("exterior"), coll,
    )
    return coll


def place_kit(kit_name, position, rotation_z, collection, name):
    """Linked-duplicate one KIT_BPY source (shared mesh data)."""
    return link_duplicate(
        bpy.data.objects[kit_name], name, position, rotation_z, collection
    )


# --- Floor 1 builders ---------------------------------------------------------
def _build_perimeter(coll):
    for side, horizontal, fixed, count, door in PERIMETER_SIDES:
        rot = 0.0 if horizontal else radians(90)

        def pos(c):
            return (c, fixed, 0.0) if horizontal else (fixed, c, 0.0)

        for i in range(count):
            center = i + 0.5
            if door is not None and abs(center - door) <= 0.5:
                continue  # replaced by the door piece + fillers
            kit = "KIT_wall_glass_1m" if i % 2 == 1 else "KIT_wall_1m"
            place_kit(kit, pos(center), rot, coll, f"wall_f1_{side}_{i + 1}")
        if door is None:
            continue
        place_kit("KIT_wall_door", pos(door), rot, coll, f"door_f1_{side}")
        for j, c in enumerate((door - 0.75, door + 0.75), start=1):
            filler = place_kit(
                "KIT_wall_1m", pos(c), rot, coll, f"wall_f1_{side}_fill_{j}"
            )
            filler.scale = (0.5, 1.0, 1.0)


def _build_lobby(coll):
    make_box(
        "ROOM_lobby", (8.0, 14.0, 0.01), (4.0, 7.0, 0.011),
        palette_material("floor"), coll,
    )
    make_counter("counter_lobby", (2.0, 6.0, 0.0), 0.0, coll)
    # Sofa group east of the CAM_lobby (4,2) -> CHARACTER_SPAWN (7,6)
    # sightline so sofa backs never hide the character's legs.
    make_sofa("sofa_1", (6.6, 1.6, 0.0), 0.0, coll)
    make_sofa("sofa_2", (6.6, 3.6, 0.0), radians(180), coll)
    make_coffee_table("coffee_table_lobby", (6.6, 2.6, 0.0), 0.0, coll)
    make_plant("plant_1", (0.6, 0.6, 0.0), 0.0, coll)
    make_plant("plant_2", (7.4, 13.4, 0.0), 0.0, coll)


def _build_meeting(coll):
    make_box(
        "ROOM_meeting_a", (6.0, 6.0, 0.01), (11.0, 11.0, 0.011),
        palette_material("floor"), coll,
    )
    rot90 = radians(90)
    door_y = 9.0
    for i in range(6):
        cy = 8.5 + i
        if abs(cy - door_y) <= 0.5:
            continue
        place_kit(
            "KIT_wall_glass_1m", (8.0, cy, 0.0), rot90, coll,
            f"wall_f1_meeting_x8_{i + 1}",
        )
    for j, cy in enumerate((door_y - 0.75, door_y + 0.75), start=1):
        filler = place_kit(
            "KIT_wall_glass_1m", (8.0, cy, 0.0), rot90, coll,
            f"wall_f1_meeting_x8_fill_{j}",
        )
        filler.scale = (0.5, 1.0, 1.0)
    place_kit(
        "KIT_wall_door", (8.0, door_y, 0.0), rot90, coll, "door_f1_meeting"
    )
    for i in range(6):
        place_kit(
            "KIT_wall_glass_1m", (8.5 + i, 8.0, 0.0), 0.0, coll,
            f"wall_f1_meeting_y8_{i + 1}",
        )
    make_meeting_table("table_meeting_a", (11.0, 11.0, 0.0), 0.0, coll)
    for i in range(3):
        make_chair(f"chair_meeting_{i + 1}", (10.0 + i, 10.0, 0.0), 0.0, coll)
        make_chair(
            f"chair_meeting_{i + 4}", (10.0 + i, 12.0, 0.0), radians(180),
            coll,
        )
    make_whiteboard(
        "whiteboard_meeting_a", (11.0, 13.9, 0.0), 0.0, coll, width=3.0
    )
    make_empty("TASK_board", (11.0, 13.9, 1.5), collection=coll)


def _build_workstation(coll):
    make_box(
        "ROOM_workstation_a", (12.0, 8.0, 0.01), (14.0, 4.0, 0.011),
        palette_material("floor"), coll,
    )
    for n in range(1, 9):
        i = (n - 1) % 4
        back_row = n > 4
        x = 9.5 + 2.5 * i
        y = 6.0 if back_row else 2.0
        rot = radians(180) if back_row else 0.0
        make_desk(f"desk_{n}", (x, y, 0.0), rot, coll)
        make_chair(
            f"chair_desk_{n}", (x, 6.9 if back_row else 1.1, 0.0), rot, coll
        )
        make_monitor(
            f"monitor_{n}", (x, y, DESK_SIZE[2]), rot, coll, on_desk=True
        )
        make_empty(f"TASK_desk_{n}", (x, y, 0.75), collection=coll)


def _build_stairs(coll):
    step_mat = palette_material("floor")
    make_empty("STAIR_core", (STAIR_X, STAIR_RUN_Y0, 0.0), collection=coll)
    for i in range(1, STEP_COUNT + 1):
        make_box(
            f"stair_step_{i}", STEP_SIZE,
            (STAIR_X, STAIR_RUN_Y0 + 0.125 + 0.25 * (i - 1), 0.2 * (i - 1)),
            step_mat, coll,
        )
    make_box(
        "wall_stair_core", (3.0, WALL_THICKNESS, FLOOR_HEIGHT),
        (STAIR_X, 13.075, 0.0), palette_material("red"), coll,
    )


def _collider(name, size, location, coll, rotation_z=0.0):
    obj = make_box(name, size, location, None, coll, rotation_z)
    obj.hide_render = True
    obj.display_type = "WIRE"
    return obj


def _build_colliders(coll):
    wall_h = (FOOTPRINT_X, WALL_THICKNESS, FLOOR_HEIGHT)
    wall_v = (WALL_THICKNESS, FOOTPRINT_Y, FLOOR_HEIGHT)
    _collider("COL_wall_s", wall_h, (10.0, HALF_WALL, 0.0), coll)
    _collider("COL_wall_n", wall_h, (10.0, FOOTPRINT_Y - HALF_WALL, 0.0), coll)
    _collider("COL_wall_w", wall_v, (HALF_WALL, 7.0, 0.0), coll)
    _collider("COL_wall_e", wall_v, (FOOTPRINT_X - HALF_WALL, 7.0, 0.0), coll)
    _collider(
        "COL_wall_meeting_x8", (GLASS_THICKNESS, 6.0, FLOOR_HEIGHT),
        (8.0, 11.0, 0.0), coll,
    )
    _collider(
        "COL_wall_meeting_y8", (6.0, GLASS_THICKNESS, FLOOR_HEIGHT),
        (11.0, 8.0, 0.0), coll,
    )
    _collider("COL_counter", COUNTER_SIZE, (2.0, 6.0, 0.0), coll)
    _collider("COL_sofa_1", SOFA_SIZE, (6.6, 1.6, 0.0), coll)
    _collider("COL_sofa_2", SOFA_SIZE, (6.6, 3.6, 0.0), coll, radians(180))
    _collider(
        "COL_table_meeting", MEETING_TABLE_SIZE, (11.0, 11.0, 0.0), coll
    )
    for n in range(1, 9):
        i = (n - 1) % 4
        back_row = n > 4
        _collider(
            f"COL_desk_{n}", DESK_SIZE,
            (9.5 + 2.5 * i, 6.0 if back_row else 2.0, 0.0), coll,
            radians(180) if back_row else 0.0,
        )
    # Tight ramp: bottom plane runs (y=9, z=0) -> (y=13, z=3.2).
    ramp_len = hypot(STAIR_RUN_LENGTH, FLOOR_HEIGHT)
    ramp = _collider(
        "COL_stair", (3.0, ramp_len, 0.2),
        (STAIR_X, STAIR_RUN_Y0 + STAIR_RUN_LENGTH / 2.0, FLOOR_HEIGHT / 2.0),
        coll,
    )
    ramp.rotation_euler = (atan2(FLOOR_HEIGHT, STAIR_RUN_LENGTH), 0.0, 0.0)


def _build_empties(coll):
    spawn_location, spawn_rot_z = CHARACTER_SPAWN
    make_empty(
        "NAV_spawn_lobby", spawn_location, (0.0, 0.0, spawn_rot_z), coll
    )
    make_empty("NAV_cam_floor1", CAM_TARGETS["lobby"][0], collection=coll)
    make_empty("NAV_cam_iso", CAM_TARGETS["iso"][0], collection=coll)
    make_empty(
        "NAV_cam_workstation", CAM_TARGETS["workstation"][0], collection=coll
    )
    make_empty("NAV_wp_lobby", (7.0, 6.0, 0.0), collection=coll)
    make_empty("NAV_wp_meeting_a", (11.0, 11.0, 0.0), collection=coll)
    make_empty("NAV_wp_workstation_a", (14.0, 4.0, 0.0), collection=coll)


def build_floor_1():
    """Detail Floor 1 into FLOOR_1 (never clears — slab must survive)."""
    coll = get_collection("FLOOR_1")
    _build_perimeter(coll)
    _build_lobby(coll)
    _build_meeting(coll)
    _build_workstation(coll)
    _build_stairs(coll)
    _build_colliders(coll)
    _build_empties(coll)
    if check_floor1 not in SELF_CHECKS:
        register_check(check_floor1)


# --- Self-check ---------------------------------------------------------------
REQUIRED_OBJECTS = (
    "ROOM_lobby", "ROOM_meeting_a", "ROOM_workstation_a",
    "NAV_spawn_lobby", "NAV_cam_floor1", "NAV_cam_iso", "NAV_cam_workstation",
    "NAV_wp_lobby", "NAV_wp_meeting_a", "NAV_wp_workstation_a",
    "TASK_board", "STAIR_core", "wall_stair_core",
    "door_f1_s", "door_f1_w", "door_f1_meeting",
    "KIT_wall_1m", "KIT_wall_glass_1m", "KIT_wall_door", "KIT_floor_1m",
    "KIT_pillar",
    "COL_wall_s", "COL_wall_n", "COL_wall_w", "COL_wall_e",
    "COL_wall_meeting_x8", "COL_wall_meeting_y8", "COL_counter",
    "COL_sofa_1", "COL_sofa_2", "COL_table_meeting", "COL_stair",
)


def check_floor1():
    if os.environ.get("HQ_INJECT_MISSING_NAV") == "1":
        injected = bpy.data.objects.get("NAV_wp_lobby")
        if injected is not None:
            bpy.data.objects.remove(injected, do_unlink=True)
    missing = [n for n in REQUIRED_OBJECTS if n not in bpy.data.objects]
    assert not missing, f"check_floor1: missing objects {missing}"
    task_desks = [
        o for o in bpy.data.objects if o.name.startswith("TASK_desk_")
    ]
    assert len(task_desks) == 8, (
        f"check_floor1: TASK_desk_* count {len(task_desks)} != 8"
    )
    desk_cols = [
        o for o in bpy.data.objects if o.name.startswith("COL_desk_")
    ]
    assert len(desk_cols) == 8, (
        f"check_floor1: COL_desk_* count {len(desk_cols)} != 8"
    )
    floor1 = bpy.data.collections["FLOOR_1"]
    waypoints = [
        o for o in floor1.all_objects if o.name.startswith("NAV_wp_")
    ]
    assert len(waypoints) == 3, (
        f"check_floor1: NAV_wp_* count {len(waypoints)} != 3"
    )
    kit = bpy.data.collections.get("KIT_BPY")
    assert kit is not None, "check_floor1: missing collection KIT_BPY"
    assert kit.hide_render, "check_floor1: KIT_BPY must be hide_render"
    under_instanced = [
        o.name for o in kit.objects
        if o.name not in KIT_UNUSED_OK and o.data.users < 2
    ]
    assert not under_instanced, (
        f"check_floor1: kit sources without instances {under_instanced}"
    )
