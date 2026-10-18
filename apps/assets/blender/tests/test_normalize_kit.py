"""Headless extra tests for normalize_kit.py.

Run: blender -b --python-exit-code 1 -P apps/assets/blender/tests/test_normalize_kit.py
Proves: 2048^2 texture downscales to 1024^2 packed; >1500-tri mesh decimates
to <= 1500 tris with palette fallback. Scratch GLBs live under /tmp only.
Prints NORMALIZE_EXTRA OK on success.
"""

import sys
from math import radians
from pathlib import Path

import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import hq_lib  # noqa: E402
import normalize_kit  # noqa: E402

TEX_GLB = "/tmp/nk_test_textured.glb"
DENSE_GLB = "/tmp/nk_test_dense.glb"
UPRIGHT_GLB = "/tmp/nk_test_upright.glb"
TEX_PNG = "/tmp/nk_test_tex.png"


def _clean_scene():
    bpy.ops.wm.read_homefile(use_empty=True)


def _export_selected(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB",
                              use_selection=True)


def build_textured_cube_glb():
    """Cube with a 2048^2 base-colour image texture -> GLB."""
    _clean_scene()
    img = bpy.data.images.new("NKTex", 2048, 2048)
    img.filepath_raw = TEX_PNG
    img.file_format = "PNG"
    img.save()

    mat = bpy.data.materials.new("NKTexMat")
    mat.use_nodes = True
    principled = next(
        n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"
    )
    tex_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex_node.image = img
    mat.node_tree.links.new(tex_node.outputs["Color"],
                            principled.inputs["Base Color"])

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    mesh = bpy.data.meshes.new("NKCube")
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    # UVs so the exporter keeps the texture binding.
    mesh.uv_layers.new(name="UVMap")
    obj = bpy.data.objects.new("NKCube", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    _export_selected(TEX_GLB)


def build_dense_glb():
    """Icosphere subdiv 4 (5120 tris), no texture -> GLB."""
    _clean_scene()
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=0.5)
    mesh = bpy.data.meshes.new("NKDense")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("NKDense", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    _export_selected(DENSE_GLB)


def test_texture_downscale():
    _clean_scene()
    obj, info = normalize_kit.normalize_kit_piece(
        TEX_GLB, "KIT_meshy_tex_test", (1.0, 1.0, 1.0))
    assert info["fallback"] is False, f"expected texture kept: {info}"
    assert tuple(info["texture_size"]) == (1024, 1024), info["texture_size"]
    img = next(
        n.image for m in obj.data.materials if m and m.use_nodes
        for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image
    )
    assert tuple(img.size) == (1024, 1024), tuple(img.size)
    assert img.packed_file is not None, "image not packed"
    assert abs(info["z_min"]) < 0.005, info["z_min"]
    print("OUT texture_downscale", info)


def build_upright_slab_glb():
    """Upright slab: thin axis Y, like the Meshy floor tile -> GLB."""
    _clean_scene()
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= 0.95
        v.co.y *= 0.02  # thin axis = Y (upright)
        v.co.z *= 0.95
    mesh = bpy.data.meshes.new("NKUpright")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("NKUpright", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    _export_selected(UPRIGHT_GLB)


def test_pre_rotate_floor():
    """pre_rotate_x_deg=90 lays the upright slab flat BEFORE scaling: a
    1x1x0.1 floor target must come out flat (z thin), not a 1 m wall."""
    _clean_scene()
    obj, info = normalize_kit.normalize_kit_piece(
        UPRIGHT_GLB, "KIT_meshy_floor_test", (1.0, 1.0, 0.1),
        pre_rotate_x_deg=90.0)
    dims = info["dims"]
    assert abs(dims[0] - 1.0) < 0.02, f"x {dims}"
    assert abs(dims[1] - 1.0) < 0.02, f"y {dims}"
    assert abs(dims[2] - 0.1) < 0.02, f"z (thin) {dims}"
    assert abs(info["z_min"]) < 0.005, info["z_min"]
    print("OUT pre_rotate_floor", info)


def test_force_fallback():
    """force_fallback=True replaces a GOOD texture with a palette material
    (no voxel remesh — geometry already clean)."""
    _clean_scene()
    obj, info = normalize_kit.normalize_kit_piece(
        TEX_GLB, "KIT_meshy_ff_test", (1.0, 1.0, 1.0),
        force_fallback=True, fallback_key="floor")
    assert info["fallback"] is True, info
    assert obj.data.materials[0].name == "MAT_floor", (
        obj.data.materials[0].name
    )
    assert info["tris"] <= 1500, info["tris"]
    print("OUT force_fallback", info)


def test_decimate_dense():
    _clean_scene()
    obj, info = normalize_kit.normalize_kit_piece(
        DENSE_GLB, "KIT_meshy_dense_test", (1.0, 1.0, 1.0))
    assert info["fallback"] is True, f"expected palette fallback: {info}"
    assert info["tris"] <= 1500, info["tris"]
    assert obj.data.materials and obj.data.materials[0] is not None
    assert abs(info["z_min"]) < 0.005, info["z_min"]
    print("OUT decimate_dense", info)


def test_v2_keep_4k_texture():
    """Kit v2: max_texture_size=4096 keeps a 2048^2 texture untouched and
    links into the KIT_MESHY_V2 collection."""
    _clean_scene()
    obj, info = normalize_kit.normalize_kit_piece(
        TEX_GLB, "KIT2_meshy_tex_test", (1.0, 0.15, 3.2),
        collection_name="KIT_MESHY_V2", max_texture_size=4096)
    assert info["fallback"] is False, f"expected texture kept: {info}"
    assert tuple(info["texture_size"]) == (2048, 2048), info["texture_size"]
    assert "KIT_MESHY_V2" in {c.name for c in obj.users_collection}, (
        [c.name for c in obj.users_collection]
    )
    print("OUT v2_keep_4k_texture", info)


def test_v2_tris_cap():
    """Kit v2: per-piece tris_cap decimates below the default 1500 cap."""
    _clean_scene()
    _obj, info = normalize_kit.normalize_kit_piece(
        DENSE_GLB, "KIT2_meshy_dense_test", (1.0, 1.0, 1.0), tris_cap=400)
    assert info["tris"] <= 400, info["tris"]
    print("OUT v2_tris_cap", info)


def test_v1_defaults_unchanged():
    """Existing v1 call signature keeps downscale-to-1024 behaviour."""
    _clean_scene()
    _obj, info = normalize_kit.normalize_kit_piece(
        TEX_GLB, "KIT_meshy_tex_default", (1.0, 1.0, 1.0))
    assert tuple(info["texture_size"]) == (1024, 1024), info["texture_size"]
    print("OUT v1_defaults_unchanged", info)


def main():
    normalize_kit._ensure_numpy()
    build_textured_cube_glb()
    build_dense_glb()
    build_upright_slab_glb()
    test_texture_downscale()
    test_decimate_dense()
    test_pre_rotate_floor()
    test_force_fallback()
    test_v2_keep_4k_texture()
    test_v2_tris_cap()
    test_v1_defaults_unchanged()
    print("NORMALIZE_EXTRA OK")


if __name__ == "__main__":
    main()
