# Todo 10 — Meshy kit pieces (meshy-t2.5 smart-topology preview + refine)

Dims measured from GLB accessor min/max (glTF Y-up: x=width, y=height, z=depth), tris from index counts.

| piece | preview id | refine id | reported polycount (tris) | file size (bytes) | kit gens so far | notes |
|---|---|---|---|---|---|---|
| KIT_wall_1m | 01a14b15-503a-7535-b76b-f22be14269f0 (preview #2; #1 01a14b13-46a7-77dd-8739-a4ade87022e9 rejected) | 01a14b1a-ca92-7566-b912-87c0741306be (refine #2; #1 01a14b16-7c78-73a5-ba6b-3f2b7924c740 texture-rejected) | 1542 | 1895156 | 2 | dims raw 0.515x0.948x0.023 (Y-up, w x h x d); MVP spend so far 42 |
| KIT_wall_door | 01a14b1b-fa4c-703f-a5d1-f3478b8c3250 | 01a14b1f-b981-707b-87aa-0cb83c73814c | 1414 | 1904232 | 3 | dims raw 0.554x0.952x0.046 (Y-up); door only, no wall margin around frame; MVP spend so far 57 |
| KIT_floor_1m | 01a14b22-e9a1-77c2-8779-79e5d2a57a76 (preview #2; #1 01a14b20-f8a3-7008-bf6a-af71b1b2bf5a rejected) | 01a14b25-68b2-7687-ba89-b212daa1fa75 | 1108 | 2072620 | 5 | dims raw 0.958x0.953x0.021 (Y-up => tile stands vertical in XY, Z=thickness); FLAG texture; MVP spend so far 77 |
| KIT_pillar | 01a14b26-cc8e-7246-ac1d-28e8199ae0d6 | 01a14b28-e348-74a3-bf24-d403ef3bbc05 | 1540 | 1792076 | 6 | dims raw 0.233x0.951x0.233 (Y-up); FLAG aspect + mouldings; MVP spend so far 92 |

Totals: kit generations 6/6 (2 rejected previews), refines 5 (1 texture-rejected, kept out of kit/), 1 refine call rejected at validation (no task, 0 cr). Todo-10 spend 80 cr; MVP ledger total 92 (≤300). Balance 4088 → 4008.

## Piece QA (honest, from thumbnails + GLB accessor bounds)

All GLBs are glTF Y-up; raw extents ~0.95 on longest axis (Meshy normalises to ~1 unit). Every piece is far from its target metric size, so todo-12 normalize_kit.py must scale (z-driven after Y-up→Z-up import) AND will hit the >5% per-axis non-uniform snap on most axes.

| piece | preview thumb | refined thumb | flags for todo 12 |
|---|---|---|---|
| KIT_wall_1m | #1 rejected: landscape plaque 0.94×0.46, 4 bolt heads. #2 accepted: flat portrait slab 0.515×0.948×0.023, 4 tiny corner bolt bumps | refine #1 (full REF_KIT sheet) painted the whole teal door w/ porthole + orange frame onto the slab → rejected, moved to /tmp. refine #2 (wall-crop ref): cream/white face, teal baseboard strip at bottom, small red dot bottom-left, grey bolt dots at corners. No moulding line. | aspect 0.54 vs target 0.31 (1/3.2) → x squashed ~0.57×; thickness 0.023 → 0.15 = ×6.5 non-uniform (bevel/bolts stretch). Bolt bumps = minor ornament; decimate/snap may keep them. |
| KIT_wall_door | accepted: closed 4-panel door leaf + thin moulded frame + lever handle, 0.554×0.952×0.046 | teal 4-panel leaf, pale orange/yellow frame, chrome lever + red lock. Door closed. No porthole. | Door-only: NO wall margin around frame — at 1 m × 3.2 m it becomes a 3.2 m tall door filling the panel. Aspect 0.58 vs 0.31 → heavy x squash. Frame colour reads pale yellow-orange, not the #FFB74D of the prompt ("orange wooden door" became teal leaf from ref). |
| KIT_floor_1m | #1 rejected: tray with raised rounded rim + crumpled faceted top (carpet → displacement). #2 accepted (doubtful): flat square slab 0.958×0.953×0.021, split into 2×2 sub-panels with cross-hatched groove relief | whitish/very light grey slab, dark black cross-hatch lines baked from the groove relief, only faint speckle (terrazzo ref barely transferred). | DOUBTFUL: reads as 4 woven/grated tiles, not one calm tile; black lines will repeat loudly on a floor grid. Tile plane is XY (stands vertical in Y-up) → after Y-up→Z-up import it is a vertical slab: normalize must rotate so thickness is Z, else floor axis=x scaling hits wrong axes. Thickness 0.021 → 0.1 = ×4.8. Candidate for palette fallback (normalize_kit fallback path) if it looks bad in render. |
| KIT_pillar | accepted (flag): square column 0.233×0.951×0.233 with stepped plinth + capital and two recessed vertical grooves per face | white/cream shaft and capital, teal plinth. Square section OK. | Aspect 4.1:1 vs target 10.7:1 → x/y squash ~0.39× (mouldings flatten). Classical capital/plinth = ornament beyond "square structural pillar". |
