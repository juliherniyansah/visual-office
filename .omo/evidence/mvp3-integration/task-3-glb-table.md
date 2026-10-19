# Task 3 — GLB Verification Table

Source: `.omo/evidence/mvp3-integration/task-2-optimize-happy.txt` lines 180-201 (post-optimization sizes, tri counts, staging baselines).

Draw-call formula (reproducible from glTF JSON via stdlib Python):

```
draw_calls = |{(mesh_index, material_index) for every primitive}| + |{nodes with EXT_mesh_gpu_instancing}|
```

i.e. one draw call per unique `(mesh, material)` pair across all mesh primitives, plus one draw call per `EXT_mesh_gpu_instancing` batch node (not per instance).

## Per-GLB Table

| File | Size (MB) | Tris (Δ vs staging baseline) | Draw Call Estimate | Prefix Counts (COL / NAV / TASK / ROOM / CHAR) | Max Tex | Instance Batches | Notes |
|------|-----------|------------------------------|--------------------|------------------------------------------------|---------|------------------|-------|
| `hq_shell.glb` | 12.84 | 561,718 (+0 / 0.00%) | 33 | 0 / 0 / 0 / 0 / 0 | 2048 | 0 | Budget verdict: **INFO** — shell ~561,718 tris post-instance is accepted per decision #21; **no decimate allowed**. If user considers it heavy, the only sanctioned option is splitting the facade per floor into `floor_N.glb`. |
| `floor_1.glb` | 6.73 | 103,148 (+0 / 0.00%) | 117 + 2 = **119** | 20 / 7 / 9 / 3 / 0 | 2048 | 2 | Real-file `nodes.ts` verification **PASS** (see below). |
| `floor_2.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `floor_3.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `floor_4.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `char_base.glb` | 0.93 | 19,499 (+0 / 0.00%) | 1 | 0 / 0 / 0 / 0 / 2 | 2048 | 0 | `CHAR_`=2 are legacy avatar bones; not tracked in the staging expected map. |

## Prefix Mismatch Check

Expected from `task-2-optimize-happy.txt` line 191:

- `floor_1`: NAV 7 / TASK 9 / ROOM 3 / COL 20
- `hq_shell`: 0 for all
- `floor_2`–`floor_4`: COL 1 each, all others 0
- `char_base`: 0 for COL/NAV/TASK/ROOM

Actual counts from real GLB JSON match those expected prefixes. **No BLOCK.**

## Real-File Verification of `nodes.ts` against `floor_1.glb`

A small Bun script parsed the actual `floor_1.glb` JSON chunk, rebuilt the node hierarchy with real `THREE.Object3D` instances, and ran the helper functions from `apps/web/src/components/office/nodes.ts` on it.

Command:

```bash
cd apps/web && bun /tmp/opencode/verify-nodes.ts
```

Exact output:

```
Real-file verification against floor_1.glb scene graph:
  COL_ count  = 20
  NAV_ count  = 7
  TASK_ count = 9
  ROOM_ count = 3
  NAV_spawn_lobby found = YES
  NAV_spawn_lobby world position = 0.000, 0.000, 0.000
  ASSERT PASS: COL_ count > 0
  ASSERT PASS: NAV_spawn_lobby found
  ASSERT PASS: TASK_ count === 9 (8 desks + board)
All real-file nodes.ts assertions PASS
```

This proves IS-8 (collision, navigation spawn, and 8 desks + board task nodes) on the real file, not a dummy scene.

## Reproducibility Notes

- Tri counts are taken from the post-optimization verification table because the GLBs use `EXT_meshopt_compression` / `KHR_mesh_quantization`; the raw accessor counts in the JSON chunk represent compressed data, not decoded triangle counts.
- Max texture size was confirmed by parsing the KTX2 header (`pixelWidth` at byte offset 20) inside each image `bufferView`; all maxima are 2048 px.
- `apps/web/public/models/character.glb` and `apps/web/public/models/building.glb` are not part of the final 6-file set; they are excluded from this table.
