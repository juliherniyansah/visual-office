"""Headless test: every palette material shows its colour in Solid viewport.

Run: blender -b --python-exit-code 1 -P apps/assets/blender/tests/test_viewport_colors.py
Prints VIEWPORT_COLORS OK on success, raises AssertionError on failure.
"""

import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hq_lib  # noqa: E402

TOLERANCE = 0.01
GLASS_ALPHA = 0.35


def assert_close(actual, expected, label):
    for channel in range(3):
        assert abs(actual[channel] - expected[channel]) <= TOLERANCE, (
            f"{label}: diffuse_color {tuple(actual)} != {tuple(expected)}"
        )


def main():
    hq_lib.reset_startup_scene()
    checked = []
    for key, hex_str in hq_lib.PALETTE.items():
        mat = hq_lib.palette_material(key)
        expected = hq_lib.hex_to_rgba(hex_str)
        assert_close(tuple(mat.diffuse_color)[:3], expected[:3], f"MAT_{key}")
        checked.append(key)

    glass = hq_lib.get_material(
        "MAT_test_glass", hq_lib.PALETTE["glass"], glass=True
    )
    assert_close(
        tuple(glass.diffuse_color)[:3],
        hq_lib.hex_to_rgba(hq_lib.PALETTE["glass"])[:3],
        "MAT_test_glass",
    )
    assert abs(glass.diffuse_color[3] - GLASS_ALPHA) <= TOLERANCE, (
        f"MAT_test_glass alpha {glass.diffuse_color[3]} != {GLASS_ALPHA}"
    )
    cached = hq_lib.palette_material("floor")
    assert cached is hq_lib.palette_material("floor"), "cache identity broken"
    print(f"VIEWPORT_COLORS checked {len(checked)} palette + glass")
    print("VIEWPORT_COLORS OK")


if __name__ == "__main__":
    main()
