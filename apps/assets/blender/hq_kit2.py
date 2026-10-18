"""Kit v2 (Meshy realistic-4K panels) normalization + all-floor assembly.

Todo 17b: normalize the 5 KIT2_*.glb pieces from apps/assets/raw/meshy/kit_v2
into collection KIT_MESHY_V2 (PBR maps kept up to 4096, per-piece decimate
targets), then assemble them on ALL four floors under build_hq
``--kit-source meshy2``:

- Floor 1 perimeter: solid cells -> KIT2 wall panel, glass cells -> KIT2
  window panel + a bpy glass pane (MAT_glass), doors -> KIT2 door wall.
- Floors 2-4: same 1 m perimeter rhythm (wall/window alternating), columns ->
  KIT2 pillar, no doors.
- Floor tiles (KIT2 floor, top +0.005 above slab top) over the Floor-1 room
  areas and the full upper-floor slabs minus the stair void.

The plain ``--kit-source bpy`` build never imports this module. Importable
with no side effects.
"""

import re
from math import radians

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import hq_lib
from hq_lib import (
    FLOOR_HEIGHT,
    RAW_MESHY_DIR,
    SELF_CHECKS,
    WALL_THICKNESS,
    count_tris,
    get_collection,
    link_duplicate,
    make_box,
    make_empty,
    palette_material,
    register_check,
)
from normalize_kit import normalize_kit_piece

KIT2_DIR = RAW_MESHY_DIR / "kit_v2"
KIT2_COLLECTION = "KIT_MESHY_V2"
KIT2_TEXTURE_CAP = 4096

# piece -> (target size, tris cap). All 5 raw GLBs import with the right
# orientation (floor already lies flat, walls upright) so no pre-rotation.
PIECES_V2 = {
    "wall_1m": ((1.0, WALL_THICKNESS, FLOOR_HEIGHT), 1200),
    "window_1m": ((1.0, WALL_THICKNESS, FLOOR_HEIGHT), 2500),
    "wall_door": ((1.0, WALL_THICKNESS, FLOOR_HEIGHT), 2500),
    "floor_1m": ((1.0, 1.0, 0.1), 400),
    "pillar": ((0.3, 0.3, FLOOR_HEIGHT), 1500),
}

TILE_Z_OFFSET = -0.095  # 0.1 m tile, base-centre origin -> top +0.005
TILE_TOP_ABOVE_SLAB = 0.005
TILE_TOP_TOL = 0.003
GLASS_PANE_SIZE = (0.96, 0.02, 3.1)
GLASS_PANE_Z = 0.05
STAIR_VOID_X = (16.0, 19.0)
STAIR_VOID_Y = (9.0, 13.0)
FLOOR1_TILE_RECTS = (  # (x0, x1, y0, y1) == the three ROOM_* areas
    (0.0, 8.0, 0.0, 14.0),
    (8.0, 14.0, 8.0, 14.0),
    (8.0, 20.0, 0.0, 8.0),
)
ROOM_AREAS_HIDDEN = ("ROOM_lobby", "ROOM_meeting_a", "ROOM_workstation_a")
TRIS_BUDGET_BUILDING_MESHY2 = 1_400_000
TRIS_BUDGET_SCENE_MESHY2 = 1_500_000
MIN_SHARED_USERS = 10
COLUMN_XS = (4.0, 8.0, 12.0, 16.0)
COLUMN_YS = (4.0, 8.0, 12.0)

# Opening probe grid (piece-local coords, panel spans x +-0.5, z 0..3.2).
PROBE_XS = [x / 100.0 for x in range(-40, 41, 5)]
PROBE_ZS = [z / 10.0 for z in range(4, 31, 2)]

# Filled by build_kit_meshy_v2: piece-local (x, z) centre of the window
# opening, used by check_kit_v2's glass ray probe.
_window_open_point = None
KIT2_METRICS = {}


def _missing_glbs():
    return [
        str(KIT2_DIR / f"KIT2_{piece}.glb")
        for piece in PIECES_V2
        if not (KIT2_DIR / f"KIT2_{piece}.glb").is_file()
    ]


def _probe_window_opening(obj):
    """Scan the normalized window panel with +Y rays; return the centre of
    the open cells (piece-local x, z) or None when no opening survives."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(obj, depsgraph)
    direction = Vector((0.0, 1.0, 0.0))
    open_cells = []
    for x in PROBE_XS:
        for z in PROBE_ZS:
            hit = tree.ray_cast(Vector((x, -1.0, z)), direction, 2.0)
            if hit[0] is None:
                open_cells.append((x, z))
    if not open_cells:
        return None
    cx = sum(c[0] for c in open_cells) / len(open_cells)
    cz = sum(c[1] for c in open_cells) / len(open_cells)
    # Snap to the nearest actually-open probe cell (centroid of an L-shaped
    # opening can land on a mullion).
    best = min(open_cells, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cz) ** 2)
    return best


def build_kit_meshy_v2():
    """Normalize the 5 kit v2 GLBs into KIT_MESHY_V2 + a bpy glass pane."""
    global _window_open_point
    missing = _missing_glbs()
    if missing:
        print(f"--kit-source meshy2 needs the kit v2 GLBs; missing: "
              f"{missing}")
        raise SystemExit(2)
    hq_lib.TRIS_BUDGET_OVERRIDE = TRIS_BUDGET_BUILDING_MESHY2
    # The v2 perimeter displaces every KIT_wall_1m / KIT_wall_door instance;
    # exempt them from the bpy-kit under-instancing check (shared set object
    # with hq_floor1's import).
    hq_lib.KIT_UNUSED_OK.update({"KIT_wall_1m", "KIT_wall_door"})
    for piece, (size, tris_cap) in PIECES_V2.items():
        obj, info = normalize_kit_piece(
            str(KIT2_DIR / f"KIT2_{piece}.glb"), f"KIT2_meshy_{piece}", size,
            collection_name=KIT2_COLLECTION,
            max_texture_size=KIT2_TEXTURE_CAP, tris_cap=tris_cap,
        )
        obj.hide_render = True
        if piece == "window_1m":
            _window_open_point = _probe_window_opening(obj)
            info["open_point"] = (
                list(_window_open_point) if _window_open_point else None
            )
            assert _window_open_point is not None, (
                "KIT2 window opening sealed by normalize/decimate"
            )
        KIT2_METRICS[piece] = info
        print(f"KIT2_NORMALIZE {piece} {info}")
    coll = get_collection(KIT2_COLLECTION)
    coll.hide_render = True
    make_box(
        "KIT2_glass_pane", GLASS_PANE_SIZE, (0.0, 0.0, 0.0),
        palette_material("glass", glass=True), coll,
    )
    if check_kit_v2 not in SELF_CHECKS:
        register_check(check_kit_v2)


# Plain-build objects displaced by the v2 kit. Floor 1 keeps its interior
# glass partitions (wall_f1_meeting_*) and wall_stair_core; only the
# perimeter runs + doors match these patterns.
REPLACED_NAME_RE = re.compile(
    r"^(wall_f1_[snwe]_|door_f1_|wall_f[234]_[snwe]$"
    r"|window_f[234]_\d+$|column_f[234]_\d+$)"
)


def remove_replaced_bpy_objects():
    removed = 0
    for obj in list(bpy.data.objects):
        if REPLACED_NAME_RE.match(obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)
            removed += 1
    print(f"KIT2_REMOVED {removed} bpy objects")
    return removed


def apply_kit_v2():
    """Replace the bpy walls/windows/columns/doors on all 4 floors and lay
    kit v2 floor tiles. Runs AFTER build_massing + build_floor_1."""
    remove_replaced_bpy_objects()
    floor1 = get_collection("FLOOR_1")
    build_floor1_perimeter_v2(floor1)
    place_kit2(
        "wall_door", "door_f1_meeting", (8.0, 9.0, 0.0), radians(90), floor1
    )
    build_floor1_tiles_v2(floor1)
    for n in range(2, 5):
        build_shell_v2(n, get_collection(f"FLOOR_{n}"))
    build_closeup_camera()


# --- Placement helpers --------------------------------------------------------
def place_kit2(piece, name, location, rotation_z, coll):
    src = bpy.data.objects[f"KIT2_meshy_{piece}"]
    return link_duplicate(src, name, location, rotation_z, coll)


def _place_window(name, location, rotation_z, coll):
    place_kit2("window_1m", name, location, rotation_z, coll)
    pane_loc = (location[0], location[1], location[2] + GLASS_PANE_Z)
    link_duplicate(
        bpy.data.objects["KIT2_glass_pane"], f"{name}_glass", pane_loc,
        rotation_z, coll,
    )


def _in_stair_void(x, y):
    return (STAIR_VOID_X[0] < x < STAIR_VOID_X[1]
            and STAIR_VOID_Y[0] < y < STAIR_VOID_Y[1])


def _build_tiles_rect(coll, floor_n, rect, skip_void, start_index):
    x0, x1, y0, y1 = rect
    z = (floor_n - 1) * FLOOR_HEIGHT + TILE_Z_OFFSET
    index = start_index
    for i in range(int(round(x1 - x0))):
        for j in range(int(round(y1 - y0))):
            cx = x0 + 0.5 + i
            cy = y0 + 0.5 + j
            if skip_void and _in_stair_void(cx, cy):
                continue
            index += 1
            place_kit2(
                "floor_1m", f"tile_f{floor_n}_{index}", (cx, cy, z), 0.0,
                coll,
            )
    return index


# --- Floor 1 ------------------------------------------------------------------
def build_floor1_perimeter_v2(coll):
    """KIT2 mirror of hq_floor1._build_perimeter: same cells, same names for
    doors/fillers; glass cells become window panels + panes."""
    from hq_floor1 import PERIMETER_SIDES

    for side, horizontal, fixed, count, door in PERIMETER_SIDES:
        rot = 0.0 if horizontal else radians(90)

        def pos(c):
            return (c, fixed, 0.0) if horizontal else (fixed, c, 0.0)

        for i in range(count):
            center = i + 0.5
            if door is not None and abs(center - door) <= 0.5:
                continue  # replaced by the door piece + fillers
            if i % 2 == 1:
                _place_window(
                    f"window_f1_{side}_{i + 1}", pos(center), rot, coll
                )
            else:
                place_kit2(
                    "wall_1m", f"wall_f1_{side}_{i + 1}", pos(center), rot,
                    coll,
                )
        if door is None:
            continue
        place_kit2("wall_door", f"door_f1_{side}", pos(door), rot, coll)
        for j, c in enumerate((door - 0.75, door + 0.75), start=1):
            filler = place_kit2(
                "wall_1m", f"wall_f1_{side}_fill_{j}", pos(c), rot, coll
            )
            filler.scale = (0.5, 1.0, 1.0)  # stretch only along local X


def build_floor1_tiles_v2(coll):
    """Tile the three ROOM_* areas; hide the flat area markers in renders."""
    index = 0
    for rect in FLOOR1_TILE_RECTS:
        index = _build_tiles_rect(coll, 1, rect, False, index)
    for name in ROOM_AREAS_HIDDEN:
        area = bpy.data.objects.get(name)
        if area is not None:
            area.hide_render = True


# --- Floors 2-4 ---------------------------------------------------------------
def build_shell_v2(n, coll):
    """Perimeter panels + pillars + tiles for one upper floor."""
    from hq_floor1 import PERIMETER_SIDES

    z = (n - 1) * FLOOR_HEIGHT
    for side, horizontal, fixed, count, _door in PERIMETER_SIDES:
        rot = 0.0 if horizontal else radians(90)
        for i in range(count):
            center = i + 0.5
            loc = (center, fixed, z) if horizontal else (fixed, center, z)
            if i % 2 == 1:
                _place_window(f"window_f{n}_{side}_{i + 1}", loc, rot, coll)
            else:
                place_kit2(
                    "wall_1m", f"wall_f{n}_{side}_{i + 1}", loc, rot, coll
                )
    index = 0
    for x in COLUMN_XS:
        for y in COLUMN_YS:
            index += 1
            place_kit2("pillar", f"column_f{n}_{index}", (x, y, z), 0.0, coll)
    _build_tiles_rect(coll, n, (0.0, 20.0, 0.0, 14.0), True, 0)


def snap_character_to_tiles():
    """Snap CHAR_BASE feet exactly onto the v2 tile top plane (+0.005):
    import_character leaves feet within +-0.02 of z 0, which can sit visibly
    under the tiles."""
    char = bpy.data.objects.get("CHAR_BASE")
    mesh_obj = bpy.data.objects.get("CHAR_BASE_mesh") or char
    if char is None or mesh_obj is None or mesh_obj.type != "MESH":
        return
    from import_character import _evaluated_world_z

    bpy.context.scene.frame_set(1)
    zmin, _zmax = _evaluated_world_z(mesh_obj)
    char.location.z += TILE_TOP_ABOVE_SLAB - zmin


# --- Close-up camera ----------------------------------------------------------
def build_closeup_camera():
    """CAM_kit2_closeup: eye-level Floor-1 view of window wall + door + tiles.

    Added only in meshy2 builds so the plain build's object set is unchanged.
    """
    coll = get_collection("CAMERAS")
    if bpy.data.objects.get("CAM_kit2_closeup") is not None:
        return
    cam_data = bpy.data.cameras.new("CAM_kit2_closeup")
    cam_data.type = "PERSP"
    cam_data.lens = 28
    cam_data.clip_end = 200.0
    cam = bpy.data.objects.new("CAM_kit2_closeup", cam_data)
    cam.location = (5.5, 5.0, 1.6)  # lobby, looking SW at the s-wall door
    coll.objects.link(cam)
    tgt = make_empty(
        "TGT_kit2_closeup", (3.8, 0.2, 1.3), collection=coll,
        display="PLAIN_AXES",
    )
    constraint = cam.constraints.new("TRACK_TO")
    constraint.target = tgt
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"


# --- Self-check ---------------------------------------------------------------
def _world_z_max(obj):
    return max((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)


def _glass_ray_hits_pane(window_obj):
    """Cast through the window opening along the panel normal; the first
    non-collider hit must be a glass pane."""
    if _window_open_point is None:
        return False, "no open point recorded"
    ox, oz = _window_open_point
    mw = window_obj.matrix_world
    origin = mw @ Vector((ox, -2.0, oz))
    through = mw @ Vector((ox, 2.0, oz))
    direction = (through - origin).normalized()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    scene = bpy.context.scene
    start = origin
    for _ in range(8):
        hit, loc, _n, _i, obj, _m = scene.ray_cast(depsgraph, start,
                                                   direction)
        if not hit:
            return False, "ray hit nothing"
        if obj.name.startswith("COL_") or obj.hide_render:
            start = loc + direction * 0.01
            continue
        return obj.name.endswith("_glass"), obj.name
    return False, "too many collider hits"


def check_kit_v2():
    coll = bpy.data.collections.get(KIT2_COLLECTION)
    assert coll is not None, "check_kit_v2: missing KIT_MESHY_V2"
    assert coll.hide_render, "check_kit_v2: KIT_MESHY_V2 renderable"

    counts = {}
    for piece in PIECES_V2:
        src = bpy.data.objects.get(f"KIT2_meshy_{piece}")
        assert src is not None, f"check_kit_v2: missing KIT2_meshy_{piece}"
        counts[piece] = src.data.users - 1  # minus the source itself
        assert counts[piece] > 0, f"check_kit_v2: no instances of {piece}"
    for piece in ("wall_1m", "floor_1m"):
        users = bpy.data.objects[f"KIT2_meshy_{piece}"].data.users
        assert users >= MIN_SHARED_USERS, (
            f"check_kit_v2: {piece} data.users {users} < {MIN_SHARED_USERS}"
        )

    floor_data = bpy.data.objects["KIT2_meshy_floor_1m"].data
    tiles = [
        o for o in bpy.data.objects
        if o.type == "MESH" and o.data is floor_data
        and o.name.startswith("tile_f")
    ]
    assert tiles, "check_kit_v2: no kit v2 floor tiles"
    for tile in tiles:
        floor_n = int(tile.name.split("_")[1][1:])
        expected = (floor_n - 1) * FLOOR_HEIGHT + TILE_TOP_ABOVE_SLAB
        z_max = _world_z_max(tile)
        assert abs(z_max - expected) <= TILE_TOP_TOL, (
            f"check_kit_v2: {tile.name} z-top {z_max:.4f} != {expected}"
        )
        if floor_n >= 2:
            assert not _in_stair_void(tile.location.x, tile.location.y), (
                f"check_kit_v2: {tile.name} inside stair void"
            )

    for obj in bpy.data.objects:
        if obj.name.startswith(("wall_f", "window_f", "door_f")):
            floor_n_token = obj.name.split("_")[1]
            if not floor_n_token.startswith("f"):
                continue
            assert not _in_stair_void(obj.location.x, obj.location.y), (
                f"check_kit_v2: {obj.name} inside stair void"
            )

    window_data = bpy.data.objects["KIT2_meshy_window_1m"].data
    windows = [
        o for o in bpy.data.objects
        if o.type == "MESH" and o.data is window_data
        and o.name.startswith("window_f")
    ]
    assert windows, "check_kit_v2: no window instances"
    panes = [o for o in bpy.data.objects if o.name.endswith("_glass")]
    pane_names = {o.name for o in panes}
    for win in windows:
        assert f"{win.name}_glass" in pane_names, (
            f"check_kit_v2: {win.name} has no glass pane"
        )
    sample = next(w for w in windows if w.name.startswith("window_f1_s"))
    ok, hit_name = _glass_ray_hits_pane(sample)
    assert ok, (
        f"check_kit_v2: opening ray through {sample.name} hit {hit_name!r}"
    )

    scene_tris = count_tris(bpy.data.objects)
    assert scene_tris <= TRIS_BUDGET_SCENE_MESHY2, (
        f"check_kit_v2: scene {scene_tris} tris > {TRIS_BUDGET_SCENE_MESHY2}"
    )
    print(
        f"CHECK_KIT_V2 counts {counts} tiles {len(tiles)} "
        f"windows {len(windows)} scene_tris {scene_tris}"
    )
