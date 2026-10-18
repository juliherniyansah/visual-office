# Verdict analysis — todo 17 (hq_v04_verdict.png)

Render: `apps/assets/blender/renders/hq_v04_verdict.png` (1280x720, EEVEE 32
samples, day). STATS verdict `mean_lum=0.701 red_ratio=0.000
unique_colors=2751` — all gates pass (0.15<lum<0.9, red<0.08, colors>200).
Stage numbers (from `60-build-v04.txt` self-check): `CHECK_VERDICT_STAGE
height 1.700 zmin 0.0000 tiles 36`; tile tops at +0.005±0.002;
`ground_verdict` top z −0.01. Frame content verified by reading the PNG:
left plate = Meshy look (36 terrazzo-shard tiles, cream Meshy wall panel,
teal 4-panel Meshy door with pale-orange frame), right plate = bpy look
(flat grey slab, flat white wall, orange bpy door leaf), identical bpy
desk+chair+monitor on each, static character copy standing centred between
the plates, building + trees + road behind, both plates fully framed with
margins on all sides.

## (a) Texture language match: kit ↔ character

MATCH. Both the kit pieces and the character were refined with meshy-t2.5
against the same style-reference family (REF_KIT / REF_CHAR derived from
REF_KIT via image-to-image). In the frame the character's hand-painted baked
texture (teal vest, white shirt, grey trousers, brown shoes, soft shading
baked into albedo) reads as the same visual family as the Meshy door
(teal leaf, chrome lever, baked panel shading) and the tile bake. Same
palette, same "painted/baked lighting" language, 1024–2048 base-colour maps.

## (b) bpy flat colour vs Meshy textured: clash level

MILD. In one frame the difference is clearly visible — the Meshy plate has
per-pixel variation (tile shards, wall mottling, door panels) while the bpy
plate is perfectly flat palette colour — but the shared pastel palette
(PALETTE hexes were the prompt basis for the refs) keeps them in one family.
The character standing against flat green ground and next to the flat bpy
desk does not look pasted-in; it looks like a detailed hero asset in a
stylised flat world. Evidence: unique_colors 2751 in this frame vs ~3278 for
a pure-bpy interior view (41-qa-v02.md) — the colour variety the Meshy
pieces add is real but not dominant. Not "none": side by side at equal
distance the material mismatch is noticeable. Not "strong": no palette
clash, no realism-vs-toon break.

## (c) Seams / gaps / scale (from 42-kit-metrics.md + 41-qa-v02.md)

- Door: raw 0.554×0.952 non-uniformly stretched to 1×3.2 m — a 3.2 m door
  leaf with no transom; panels elongate but read plausibly (41-qa-v02).
  Visible again here: the Meshy door is a very tall slender leaf.
- Floor tile: baked texture is angular cross-hatch shard remnants of groove
  relief, not true terrazzo speckle; low contrast; 1 m grid seams visible
  but read as intentional tiling.
- Wall: cream + teal strip panels tile cleanly; bolt heads repeat per metre;
  subtle mottling vs flat bpy white.
- Non-uniform stretch on EVERY piece (nonuniform=true ×4): Meshy t2.5
  ignores metric sizes (longest axis normalised ~0.95), wall thickness
  stretched ×6.5. Normalisation hides this at room scale but the door
  proportions show it.
- No z-fighting, no gaps in this frame: tile tops +0.005 over slab/ground,
  ground_verdict abuts ground_main at y −33 with no overlap.

## (d) Credits & wall-clock vs bpy cost 0

From meshy-ledger.md:
- Style refs (todo 7): 12 cr (2 × nano-banana-2).
- Kit (todo 10): 80 cr = 6 previews ×5 + 5 refines ×10, for 4 usable pieces
  (2 previews rejected, 1 refine texture rejected). ~20 cr per shipped piece
  incl. waste.
- Character: 28 cr = 2 previews ×5 + refine 10 + rig 5 + idle 3.
- Total MVP-2: 120/300 credits.
- Wall-clock per Meshy piece: preview 23–40 s + refine 16–36 s + QA/normalize
  minutes — but rejection loops (door texture, floor tray, wall plaque,
  shrug pose) dominate real time. bpy pieces: 0 credits, deterministic,
  instant rebuild, fully parametric.

## (e) Polycount delta

- bpy meeting room: 824 tris / 14 datablocks. Kit meeting room: 45,695 tris
  / 18 datablocks (36 tiles ×1,082 = 38,952 of it). ~55× tri cost per
  visual upgrade (42-kit-metrics.md).
- Kit pieces: 1,082–1,500 tris each vs 12 for a bpy box.
- Character: 19,499 tris (cap 20k), 24 bones.
- hq_v03 total: 77,103 tris. hq_v04 (verdict stage added): 138,933 tris —
  the stage alone adds ~61,830 (36 more tile instances + wall/door instances
  + a full static character copy).

## (f) MVP-3 export implications

- Exclude from web export: VERDICT_STAGE, FLOOR_1_KIT_TEST, KIT_BPY,
  KIT_MESHY, CAMERAS, LIGHTING (orchestrator note after todo 15). The
  shipped scene is then hq_v03-equivalent content.
- Level 2 (kit walls/floor in FLOOR_1) would put ~40–50k extra tris and 3–4
  1024² textures into the web bundle; textures need KTX2 compression
  (already downscaled 2048→1024 and packed). Level 1 ships palette-only
  materials: no textures at all, minimal draw calls.
- Instancing works (datablocks 14 vs 18) so draw calls stay comparable; the
  cost is vertex/tri throughput and texture memory.
- Character is a skinned mesh (armature scale 0.01, 24 bones, idle action)
  — needs skinned-mesh export path regardless of the walls/floor decision.

## (g) Caveat: no Meshy furniture generated in MVP-2

No desk/chair/monitor was ever generated with Meshy (kit cap was spent on
wall/door/floor/pillar). The complex-furniture recommendation below rests
ONLY on the texture quality shown by the character and kit pieces, not on
an actual Meshy furniture sample. Both plates use the SAME bpy furniture by
design, so the frame compares environments, not furniture.

## Recommendation (user decides)

Walls/floor — evidence for Level 1 (bpy): 55× lower tri cost, zero credits,
zero textures to ship, deterministic rebuilds, no non-uniform stretch
artifacts (3.2 m door leaf), guide §4 says bpy geometry = flat palette by
design. Evidence for Level 2 (Kit Meshy): real material richness (terrazzo
tiles, panelled walls) visible in renders, consistent style family with the
character, instancing keeps datablocks in check. On balance: recommend
**Level 1 (bpy)** for walls/floor because the texture payoff is modest (low
contrast tile bake, mottled walls) against a ~55× tri cost and KTX2 texture
pipeline burden in MVP-3 — but Level 2 is viable if material richness is a
priority; user decides.

Complex furniture — evidence for Meshy: the character proves meshy-t2.5 +
style-ref refine produces assets that sit well in this world (1.70 m,
19.5k tris, texture language matches); complex organic shapes (plants,
ergonomic chairs) are where bpy boxes read cheapest. Evidence for bpy: all
furniture in every approved render so far IS bpy and reads fine at
eye-level; Meshy ignores metric sizes (every piece needed non-uniform
rescale) and rejection loops cost credits/time; furniture multiplies
instance tri cost. On balance: recommend **Meshy for a few hero/complex
pieces only** (e.g. plants, sofa) and bpy for the rest — with the explicit
(g) caveat that no Meshy furniture sample exists yet; user decides.
