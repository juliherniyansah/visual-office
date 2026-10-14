# Task 17 — Asset Pipeline + GLB Generation

**Status**: ✅ Complete
**Date**: 2026-10-14
**Agent**: Sisyphus-Junior (Kimi K3)

## Deliverables

- [x] `apps/assets/` directory with asset pipeline scripts
- [x] `apps/assets/models/building.glb` - placeholder building shell (13KB)
- [x] `apps/assets/models/character.glb` - placeholder character rig (39KB)
- [x] Animation clips: idle, typing, stand, walk, talk (5 clips embedded in character.glb)
- [x] `apps/assets/scripts/build.sh` - asset build script
- [x] `apps/assets/scripts/optimize.sh` - GLB optimization (gltf-transform)
- [x] `apps/assets/scripts/generate-assets.ts` - GLB generation script (manual glTF construction)
- [x] Asset loading integration in OfficeCanvas (`apps/web/src/components/OfficeCanvas.tsx`)
- [x] OfficeCanvas wired into landing page (`apps/web/src/app/page.tsx`)
- [x] Tests pass: 1083/1089 (5 pre-existing failures in rooms.test.ts, unrelated)
- [x] Build passes: Next.js 16.4.0, Turbopack, static generation successful

## Implementation Details

### Asset Pipeline Structure
- `apps/assets/` — workspace package `@redhunter/assets`
- `models/` — generated GLB files
- `animations/` — (reserved for future animation assets)
- `scripts/` — build, optimize, generate scripts

### GLB Generation Approach
**Problem**: Three.js `GLTFExporter` requires browser APIs (`FileReader`, `Blob`) — hangs in Bun/Node.

**Solution**: Build glTF JSON directly and pack into GLB binary format manually.

**Pattern**:
1. Create geometry (box, capsule, sphere) with positions/normals/indices
2. Build buffer views + accessors with proper alignment (4-byte)
3. Construct glTF JSON: scenes, nodes, meshes, materials, animations
4. Pack JSON chunk + binary chunk into GLB with 4-byte padding
5. Write to file as ArrayBuffer

**Result**: Portable, fast, no browser runtime needed.

### Building.glb (13KB)
- Box geometry (4x6x4) — main structure
- Box roof (4.2x0.3x4.2)
- 6 windows (0.8x1x0.1) — 3 floors × 2 columns
- Door (1x1.8x0.1)
- Materials: body (gray), roof (dark), window (blue emissive), door (brown)

### Character.glb (39KB)
- Capsule body (0.3 radius, 0.8 height)
- Sphere head (0.25 radius)
- 2 capsule arms (0.08 radius, 0.5 height)
- 2 capsule legs (0.1 radius, 0.6 height)
- Materials: body (blue), head (skin), legs (dark)

### Animation Clips (5)
1. **idle** (4s): Body breathing (Y translation), head tilt (quaternion)
2. **typing** (2s): Left/right arm rotation (keyboard motion), head nod
3. **stand** (1s): Static pose (no motion)
4. **walk** (1s): Leg swing (left/right), arm swing (opposite), body bob
5. **talk** (2s): Head rotation (gesturing), right arm gesture

All animations use `KeyframeTrack` with `InterpolateSmooth` or `InterpolateLinear`. Quaternions computed via `quatFromEuler(x, y, z)` helper.

### OfficeCanvas Integration
- Replaced task 16's floor/avatar canvas with GLB-loading version
- Uses `@react-three/fiber` Canvas + `@react-three/drei` hooks
- `useGLTF('/models/building.glb')` — loads building at origin
- `useGLTF('/models/character.glb')` — loads character at (2,0,2)
- `useAnimations(animations, scene)` — applies animation clips
- `OrbitControls` for camera interaction
- Dynamic import with `ssr: false` for Next.js compatibility

### Dependencies Added
- `three@0.186.1` — 3D rendering + glTF support
- `@react-three/fiber@9.8.1` — React renderer for Three.js
- `@react-three/drei@10.7.9` — Helper components (useGLTF, useAnimations, OrbitControls)
- `@types/three@0.186.0` — TypeScript definitions

### Build Scripts
- `build.sh` — runs `generate-assets.ts` via Bun
- `optimize.sh` — runs `gltf-transform optimize` with Draco + WebP compression (optional, requires `@gltf-transform/cli`)

## Verification

### Test Results
```
1083 pass
1 skip
5 fail (pre-existing in rooms.test.ts, unrelated to task 17)
1 snapshots, 3649 expect() calls
Ran 1089 tests across 87 files. [59.36s]
```

### Build Output
```
✓ Generating static pages using 4 workers (3/3) in 982ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content
```

### Asset Files
```
total 56K
-rw-rw-r-- 1 programer programer 13K Oct 14 00:17 building.glb
-rw-rw-r-- 1 programer programer 39K Oct 14 00:17 character.glb
```

## Key Learnings

1. **Don't use GLTFExporter in Node/Bun** — browser APIs missing, hangs. Build glTF JSON manually.
2. **Manual glTF construction is portable** — works in any JS runtime, no browser deps.
3. **4-byte alignment critical** — glTF spec requires buffer views aligned to 4 bytes.
4. **Quaternion math** — `quatFromEuler(x, y, z)` converts XYZ rotation to quaternion for animations.
5. **Pre-existing issues** — `FinalCta.tsx` missing `COPY` import (fixed). `rooms.test.ts` ZodError (unrelated, pre-existing).

## Files Modified/Created

**Created**:
- `apps/assets/package.json`
- `apps/assets/scripts/generate-assets.ts`
- `apps/assets/scripts/build.sh`
- `apps/assets/scripts/optimize.sh`
- `apps/assets/models/building.glb`
- `apps/assets/models/character.glb`
- `apps/web/src/components/OfficeCanvas.tsx`
- `apps/web/public/models/building.glb`
- `apps/web/public/models/character.glb`

**Modified**:
- `apps/web/src/app/page.tsx` — added OfficeCanvas import + section
- `apps/web/src/components/landing/FinalCta.tsx` — fixed missing COPY import
- `package.json` — added three, @react-three/fiber, @react-three/drei, @types/three

**Documentation**:
- `.omo/notepads/redhunter-master-plan/learnings.md` — appended task 17 learnings
- `.omo/evidence/17/` — test results, build output, asset files

## Next Steps

Task 17 complete. Asset pipeline ready for future GLB generation. OfficeCanvas loads placeholder models. Next task can:
- Replace placeholder GLBs with real assets (Blender export → gltf-transform optimization)
- Add more animation clips (interactions, gestures)
- Integrate character state machine (walk → idle → typing based on user action)
- Add lighting/environment (HDR, shadows, post-processing)
