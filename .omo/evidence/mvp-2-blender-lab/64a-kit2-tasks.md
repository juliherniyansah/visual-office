# Todo 17b — Kit v2 Meshy generation (2026-10-18)

Scope: generation + download + QA only (no Blender assembly, no .blend edits).
Pipeline: nano-banana-2 design image (1:1) → meshy_image_to_3d meshy-7.1, should_texture, texture_resolution 4k, enable_pbr, glb, should_remesh false → meshy_remesh quad/8000 when tris > 8000 (original kept as `<piece>_hi.glb`).
Tri count / dims / texture sizes: Blender 5.0.1 headless (`blender -b --factory-startup --python-exit-code 1`), glTF import, tris = Σ(len(poly)-2); dims are the raw import bbox (Z-up, before normalize). Map sizes read from the GLB's embedded images per material slot.

## Per piece

| piece | design image task | image_to_3d task | remesh task | credits | tris raw → final | maps in final GLB | dims raw XYZ (m) | QA |
|---|---|---|---|---|---|---|---|---|
| KIT2_wall_1m | 01a14d9c-23ac-7720-80bd-beafef64a7a9 | 01a14d9c-b957-7676-baac-fe0080abea72 | 01a14d9e-25e9-7271-ba0b-9ef5013a6b33 | 6+30+5 = 41 | 66,624 → 16,338 | baseColor 4096, metalRough 4096, normal 4096 | 0.709 × 0.111 × 1.903 | FLAG |
| KIT2_window_1m | 01a14da1-71d6-7607-abec-2cda9cca756b (try 1 used; try 2 01a14da2-5802-7250-87a1-5be8d9f276f9 rejected) | 01a14da3-6ba2-7389-883c-2e2acab25e97 | 01a14da4-edcb-7607-b6a6-7a894fc1a33b; retexture 01a14dbb-54de-77ae-bcac-5bd8d4872048 | 6+6+30+5+10 = 57 | 92,326 → 15,364 | baseColor 4096, metalRough 2048, normal 4096 (after retexture) | 0.862 × 0.144 × 1.903 | PASS (r2, minor flag) |
| KIT2_floor_1m | 01a14da8-29e7-708e-a544-d34a4401b726 | 01a14da9-2068-7504-b473-5ba336a21b04 | 01a14daa-c14c-713b-9984-353324b69db5 | 6+30+5 = 41 | 22,148 → 15,778 | baseColor 4096, metalRough 4096, normal 4096 | 1.903 × 1.903 × 0.203 | PASS |
| KIT2_wall_door | 01a14dad-471b-72b9-9e51-e90079dedfe8 | 01a14dae-5213-724a-8595-611488a352cf | 01a14daf-aa36-73d9-b168-da9cff3a89da; retexture 01a14db9-af72-71f3-98f5-770946d2d3d2 | 6+30+5+10 = 51 | 50,060 → 15,992 | baseColor 4096, metalRough 2048, normal 4096 (after retexture) | 1.169 × 0.176 × 1.903 | PASS (r2, minor flag) |
| KIT2_pillar | 01a14db3-692c-76c9-9909-1e8c0841ab9f (try 2 used; try 1 01a14db2-14f7-7592-8447-e6d215fc2bec rejected) | 01a14db4-2341-71a5-8428-d00fc00ba5ad | — (skipped, see note) | 6+6+30 = 42 | 9,856 → 9,856 | baseColor 4096, metalRough 2048, normal 4096 | 0.273 × 0.273 × 1.903 | PASS |

Raw (`_hi.glb`) of every remeshed piece: baseColor 4096, metalRough 2048, normal 4096. Remesh re-bakes metalRough to 4096.
All GLBs: magic `glTF`, 1 mesh object, 1 material. Every piece normalized by Meshy to longest side 1.903 m → normalize_kit.py must rescale to real size (wall/window/door/pillar height 3.2 m, floor 1.0 m).

## QA readings (design image / Meshy thumbnail `64-thumb-<piece>.png` / own Workbench render `64-render-<piece>.png`)

- **KIT2_wall_1m — FLAG.** Design: tall off-white portrait slab, bevelled face, teal skirting, nothing else (PASS). 3D: Meshy added an inset panel with vertical flutes, so it reads a little like a door leaf. Teal skirting is there, silhouette is a clean slab, depth 0.111/0.709 ≈ 15.6 cm at 1 m width (good). Usable as a wall. The flutes are a style deviation, not a structural break, so no retry.
- **KIT2_window_1m — FLAG.** Design try 1: the empty opening, dark frame and single horizontal mullion are correct. Unrequested extras: orange pyramid corner ornaments, chamfered opening corners, and a terrazzo plus glossy patch block layout. Try 2 (stricter prompt) REJECTED: remove_background deleted the whole off-white wall face (alpha 0), leaving a side post, a floating frame and the skirting. The image cap was then reached, so try 1 was used. 3D: the opening is see-through (no pane, good for bpy glass), frame and mullion are present, and the ornaments, terrazzo patches and one near-black lower-left block carried over. Structurally usable; style is busier than the other pieces.
- **KIT2_floor_1m — PASS.** Design: flat square terrazzo slab with teal and orange chips and a bevelled top edge. 3D: flat slab, thickness/side 0.203/1.903 = 10.7 % (target 10 %), chips on the top and sides, faceted bevel. Lies flat (Z thin) on import.
- **KIT2_wall_door — FLAG.** Design: teal door at the bottom, orange frame, steel bar handle, wall continues above the door (correct). Door is off-centre to the right, and the wall is two-tone (grey band on top, speckled plaster below). 3D geometry is correct (door inset, frame, handle), but the albedo has a dark baked shadow gradient on the upper band and a near-black left strip (lighting baked into base color). Needs de-light, a retexture, or a material override at normalize. Width 1.169 vs 0.9 m door ratio = wider than a 1 m module; normalize must scale XY to 1.0 m.
- **KIT2_pillar — PASS.** Design try 1 REJECTED: remove_background left a semi-transparent column face (alpha 50-200) and a grey ground-shadow plane that would have become a floor plate. Try 2 used no remove_background and a flat grey studio background; it gave a clean, opaque, slender bevelled column with a teal plinth. 3D: plain square column 0.273 × 1.903, aspect 7:1 (target 10.7:1; normalize can scale Z), teal plinth, no ornaments.

## Retexture round (orchestrator decision 2026-10-18)

Decision: tris accepted as remeshed (Decimate to ≤ 8k later in Blender normalize, no more remesh credits); wall_door + window_1m retextured once each. Settings: `meshy_retexture` ai_model `latest`, texture_resolution `4k`, enable_pbr, enable_original_uv, target_formats `["glb"]`, input_task_id = remesh task, `text_style_prompt` only. Previous files kept as `<piece>_tex1.glb`. Geometry unchanged (tris + dims identical to tex1). Render: same Workbench STUDIO + texture + cavity setup → `64-render-<piece>-r2.png`. Pixel samples are sRGB values from the renders.

- **KIT2_wall_door r2 — PASS (minor flag).** Retexture 01a14db9-af72-71f3-98f5-770946d2d3d2, 10 cr, 39 s. The baked dark band and the near-black left strip are gone. Wall samples are top (146,139,125), left (147,140,125) and right (147,141,126), uniform warm off-white; before they were 65 / 4 / 134 grey. The orange frame (153,62,0) and the steel bar handle are clean. Minor: the door leaf is a desaturated grey-teal (99,124,123), not #2E8C8C, and the panel's outer side edges came out orange-brown. Fine at room scale; tint the leaf at normalize if needed.
- **KIT2_window_1m r2 — PASS (minor flag).** Retexture 01a14dbb-54de-77ae-bcac-5bd8d4872048, 10 cr, 30 s. The orange ornaments, the black lower-left patch and the terrazzo speckle are gone. All wall areas are uniform at (145-158, 143-157, 140-154). The charcoal frame (10,11,12) and mullion (27,33,39) are clean, and the opening is still open. Minor: the wall is a cool neutral grey, slightly less warm than its siblings (wall_1m 142,138,131; pillar 150,144,134). The old ornament bumps and chamfered opening corners stay as geometry, now wall-coloured, so they read as subtle facets.

## Remesh note (decided: accept ~16k tris, Blender Decimate later)

`meshy_remesh` with topology quad and target_polycount 8000 returned 15,364–16,338 triangles for all four remeshed pieces. Meshy counts quads, and each quad becomes 2 triangles, so ≈ 2× tris. The ≤ 8,000-tri plan target is NOT met. Pillar remesh was skipped because a quad/8000 remesh would raise it from 9,856 to about 16k tris. Options for the next step, which needs no new credits: (a) accept ~16k tris per piece because they are instanced and each GLB is one mesh; (b) Blender Decimate to ≤ 8k at normalize (UVs kept); (c) a paid re-remesh with triangle topology and target 8000 (+5 cr per piece). Not done here, it needs a decision.

## Credits

| piece | images | 3D | remesh | retexture | total |
|---|---|---|---|---|---|
| KIT2_wall_1m | 6 | 30 | 5 | 0 | 41 |
| KIT2_window_1m | 12 | 30 | 5 | 10 | 57 |
| KIT2_floor_1m | 6 | 30 | 5 | 0 | 41 |
| KIT2_wall_door | 6 | 30 | 5 | 10 | 51 |
| KIT2_pillar | 12 | 30 | 0 | 0 | 42 |
| **total** | 42 | 150 | 20 | 20 | **232** |

Balance 3980 → 3768 after generation (Δ 212, ledger rows 19-34) → 3748 after retexture (Δ 20, rows 36-37). Every paid call was checked before and after, and each delta equals its charge. Kit v2 spend 232 ≤ 330. MVP total 120 + 232 = 352 ≤ 450 (USER_APPROVED_CAP_450). No 8k, no other ai_model, no create-call errors.

## Files

- `apps/assets/raw/meshy/kit_v2/KIT2_{wall_1m,window_1m,floor_1m,wall_door,pillar}.glb` (final), `KIT2_{wall_1m,window_1m,floor_1m,wall_door}_hi.glb` (pre-remesh), `KIT2_<piece>_design.png` ×5.
- `KIT2_{wall_door,window_1m}_tex1.glb` = pre-retexture remesh output (dark-band / ornament textures).
- `.omo/evidence/mvp-2-blender-lab/64-thumb-<piece>.png` (Meshy preview) ×5, `64-render-<piece>.png` (Workbench textured render of the first-pass GLB) ×5, `64-render-KIT2_{wall_door,window_1m}-r2.png` (after retexture).
- GLB sizes are 10.7–35 MB (retextured: 10.69 / 10.88 MB), all above the 10 MB git threshold in `apps/assets/raw/meshy/README.md` (not for git as-is).
