"""Headless test for hq_furniture builders.

Run: blender -b --python-exit-code 1 -P apps/assets/blender/tests/test_furniture.py
Prints FURNITURE OK on success, raises AssertionError on failure.
Negative hook: HQ_TEST_BREAK_DESK=1 makes the desk 1.5 m tall -> must fail.
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hq_lib  # noqa: E402

hq_lib.reset_startup_scene()

import hq_furniture  # noqa: E402

GLOBAL_TRI_CAP = 400
Z_MIN_TOL = 0.005

# key -> (builder, kwargs, (height_min, height_max), tri_cap)
ITEMS = [
    ("desk", hq_furniture.make_desk, {}, (0.70, 0.78), 60),
    ("chair", hq_furniture.make_chair, {}, (0.85, 1.0), 120),
    ("monitor", hq_furniture.make_monitor, {}, (1.15, 1.4), 60),
    ("monitor_desk", hq_furniture.make_monitor, {"on_desk": True},
     (0.40, 0.46), 60),
    ("meeting_table", hq_furniture.make_meeting_table, {}, (0.70, 0.78), 80),
    ("whiteboard", hq_furniture.make_whiteboard, {"width": 3.0}, (2.0, 2.2),
     40),
    ("plant", hq_furniture.make_plant, {}, (0.8, 1.1), 120),
    ("sofa", hq_furniture.make_sofa, {}, (0.8, 0.9), 48),
    ("counter", hq_furniture.make_counter, {}, (1.1, 1.2), 24),
    ("coffee_table", hq_furniture.make_coffee_table, {}, (0.38, 0.44), 60),
]


def world_bbox(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mins = Vector((min(c[i] for c in corners) for i in range(3)))
    maxs = Vector((max(c[i] for c in corners) for i in range(3)))
    return mins, maxs


def main():
    coll = hq_lib.get_collection("FURNITURE_TEST")
    for index, (key, builder, kwargs, height_range, tri_cap) in enumerate(
        ITEMS
    ):
        before = len(coll.objects)
        obj = builder(
            f"{key}_1", (index * 5.0, 0.0, 0.0), 0.0, coll, **kwargs
        )
        after = len(coll.objects)
        assert after - before == 1, (
            f"{key}: expected exactly one new object, got {after - before}"
        )
        assert obj.name in coll.objects, f"{key}: object not in collection"

        mins, maxs = world_bbox(obj)
        z_min = mins.z - obj.location.z * 0  # world z-min (location.z == 0)
        assert abs(mins.z) <= Z_MIN_TOL, (
            f"{key}: bbox z-min {mins.z:.4f} not within +-{Z_MIN_TOL} of 0"
        )
        height = maxs.z
        lo, hi = height_range
        assert lo <= height <= hi, (
            f"{key}: height {height:.3f} outside [{lo}, {hi}]"
        )

        tris = hq_lib.count_tris([obj])
        assert tris <= GLOBAL_TRI_CAP, (
            f"{key}: {tris} tris > global cap {GLOBAL_TRI_CAP}"
        )
        assert tris <= tri_cap, f"{key}: {tris} tris > item cap {tri_cap}"

        dims = (maxs.x - mins.x, maxs.y - mins.y, maxs.z - mins.z)
        print(
            "OUT {:14s} dims {:.3f} x {:.3f} x {:.3f} m  tris {:3d} "
            "(cap {})".format(key, *dims, tris, tri_cap)
        )

    print("FURNITURE OK")


main()
