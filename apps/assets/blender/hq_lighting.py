"""Lighting (sun + area fills + world sky) and cameras for the RedHunter HQ.

Imports hq_lib only; no NAV lookups. ``build_lighting`` is re-runnable: it
rebuilds only the LIGHTING collection + world (and glass emission for night).
"""

from math import radians

import bpy

from hq_lib import (
    CAM_TARGETS,
    SELF_CHECKS,
    get_collection,
    hex_to_rgba,
    make_empty,
    register_check,
)

# Day sun: guide R3F intensity 1.4. Plan suggested 4.0 W/m2, but under the
# Standard view transform (no AgX rolloff) the near-white exterior walls
# clipped (mean_lum 0.944) — tuned to 1.5; global -1 EV (hq_lib.VIEW_EXPOSURE)
# then lands frames in the 0.45-0.75 target with shadows intact.
SUN_DAY = {"hex": "#FFFFFF", "energy": 1.5}
# Night sun 0.7 was spec'd against day 4.0; rescaled with the day tune and
# lowered empirically to 0.02 so night mean_lum lands < 0.15 — the spec'd
# sky ramp at strength 1.0 alone lifts the iso frame to ~0.145.
SUN_NIGHT = {"hex": "#5C6BC0", "energy": 0.02}
SKY_DAY = ("#E3F4FC", "#BFE3F7")  # (bottom, top)
SKY_NIGHT = ("#0D1B2A", "#1A237E")
AREA_HEX = "#FFF8F0"
AREA_ENERGY = {"day": 100.0, "night": 40.0}
WORLD_STRENGTH = {"day": 0.6, "night": 1.0}
# z 2.9: 10 cm below the Floor-2 slab underside at z 3.0, never flush.
AREA_LIGHTS = {
    "LIGHT_area_lobby": (4.0, 7.0, 2.9),
    "LIGHT_area_meeting": (11.0, 11.0, 2.9),
    "LIGHT_area_workstation": (14.0, 4.0, 2.9),
}
GLASS_EMISSION_HEX = "#FFF3C4"
CAMERA_CLIP_END = 200.0  # covers the 80 m ground from the iso position


def _clear_collection_objects(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        return
    for obj in list(coll.all_objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def _world_node(tree, node_type, create_id):
    """Get-or-create a world node by .type (never by name)."""
    node = next((n for n in tree.nodes if n.type == node_type), None)
    if node is None:
        node = tree.nodes.new(create_id)
    return node


def _build_world(phase):
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    tree.nodes.clear()
    tex_coord = _world_node(tree, "TEX_COORD", "ShaderNodeTexCoord")
    separate = _world_node(tree, "SEPARATE_XYZ", "ShaderNodeSeparateXYZ")
    ramp = _world_node(tree, "VALTORGB", "ShaderNodeValToRGB")
    background = _world_node(tree, "BACKGROUND", "ShaderNodeBackground")
    output = _world_node(tree, "OUTPUT_WORLD", "ShaderNodeOutputWorld")
    bottom_hex, top_hex = SKY_DAY if phase == "day" else SKY_NIGHT
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = hex_to_rgba(bottom_hex)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = hex_to_rgba(top_hex)
    background.inputs["Strength"].default_value = WORLD_STRENGTH[phase]
    tree.links.new(tex_coord.outputs["Generated"], separate.inputs["Vector"])
    tree.links.new(separate.outputs["Z"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], background.inputs["Color"])
    tree.links.new(background.outputs["Background"], output.inputs["Surface"])


def _set_glass_emission(phase):
    """Night windows glow; day resets emission. Guard if MAT_glass absent."""
    mat = bpy.data.materials.get("MAT_glass")
    if mat is None or not mat.use_nodes:
        return
    principled = next(
        (n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None
    )
    if principled is None:
        return
    principled.inputs["Emission Color"].default_value = hex_to_rgba(
        GLASS_EMISSION_HEX
    )
    principled.inputs["Emission Strength"].default_value = (
        2.0 if phase == "night" else 0.0
    )


def _configure_eevee(scene):
    eevee = scene.eevee
    if hasattr(eevee, "taa_render_samples"):
        eevee.taa_render_samples = 32
    if hasattr(eevee, "use_shadows"):
        eevee.use_shadows = True
    # use_gtao does not exist in Blender 5.0 EEVEE Next — intentionally skipped.


def build_lighting(phase="day"):
    """Rebuild the LIGHTING collection, world sky and glass emission."""
    assert phase in ("day", "night"), f"build_lighting: bad phase {phase}"
    _clear_collection_objects("LIGHTING")
    coll = get_collection("LIGHTING")

    sun_spec = SUN_DAY if phase == "day" else SUN_NIGHT
    sun_data = bpy.data.lights.new("SUN_main", "SUN")
    sun_data.color = hex_to_rgba(sun_spec["hex"])[:3]
    sun_data.energy = sun_spec["energy"]
    sun_data.angle = radians(2)
    if hasattr(sun_data, "use_shadow_jitter"):
        sun_data.use_shadow_jitter = True
    sun = bpy.data.objects.new("SUN_main", sun_data)
    sun.rotation_euler = (radians(50), 0.0, radians(35))
    coll.objects.link(sun)

    for name, location in AREA_LIGHTS.items():
        data = bpy.data.lights.new(name, "AREA")
        data.shape = "SQUARE"
        data.size = 4.0
        data.energy = AREA_ENERGY[phase]
        data.color = hex_to_rgba(AREA_HEX)[:3]
        obj = bpy.data.objects.new(name, data)
        obj.location = location  # default area orientation points -Z
        coll.objects.link(obj)

    _build_world(phase)
    _set_glass_emission(phase)
    _configure_eevee(bpy.context.scene)
    for block in list(bpy.data.lights):
        if block.users == 0:
            bpy.data.lights.remove(block)
    if check_lighting not in SELF_CHECKS:
        register_check(check_lighting)


def build_cameras():
    """Rebuild the CAMERAS collection from hq_lib.CAM_TARGETS."""
    _clear_collection_objects("CAMERAS")
    coll = get_collection("CAMERAS")
    for key, (location, target, projection, lens_or_scale) in (
        CAM_TARGETS.items()
    ):
        cam_data = bpy.data.cameras.new(f"CAM_{key}")
        if projection == "ORTHO":
            cam_data.type = "ORTHO"
            cam_data.ortho_scale = lens_or_scale
        else:
            cam_data.type = "PERSP"
            cam_data.lens = lens_or_scale
        cam_data.clip_end = CAMERA_CLIP_END
        cam = bpy.data.objects.new(f"CAM_{key}", cam_data)
        cam.location = location
        coll.objects.link(cam)
        tgt = make_empty(
            f"TGT_{key}", target, collection=coll, display="PLAIN_AXES"
        )
        constraint = cam.constraints.new("TRACK_TO")
        constraint.target = tgt
        constraint.track_axis = "TRACK_NEGATIVE_Z"
        constraint.up_axis = "UP_Y"
    bpy.context.scene.camera = bpy.data.objects["CAM_iso"]
    for block in list(bpy.data.cameras):
        if block.users == 0:
            bpy.data.cameras.remove(block)


def check_lighting():
    assert bpy.data.objects.get("SUN_main") is not None, (
        "check_lighting: missing SUN_main"
    )
    for name in AREA_LIGHTS:
        assert bpy.data.objects.get(name) is not None, (
            f"check_lighting: missing {name}"
        )
    for key in CAM_TARGETS:
        assert bpy.data.objects.get(f"CAM_{key}") is not None, (
            f"check_lighting: missing CAM_{key}"
        )
