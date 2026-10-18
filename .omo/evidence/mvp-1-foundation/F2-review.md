# F2 — Code Quality Review (adversarial, independent)

Reviewer: subagent F2. Read-only on product code. Baseline: `git show HEAD:apps/web/src/components/OfficeCanvas.tsx`
(417 lines, md5 `de47fea8e9d0870083eb7a8ddced84c1` — verified: `git show HEAD:... | md5sum` → `de47fea8e9d0870083eb7a8ddced84c1`).

Scope: `apps/web/src/components/office/*` (13 files) vs monolith. Scripts used: `/tmp/opencode/f2-blocks.sh`,
`/tmp/opencode/f2-coverage.sh`, `/tmp/opencode/f2-greps.sh`.

---

## Rule 1 — Zero semantic deltas beyond sanctioned list: PASS

Per-block diff, normalized ONLY for the sanctioned `export `/`export default ` prefix
(`sed -E 's/^export (default )?//'`):

| Monolith region | New file (lines) | Result |
|---|---|---|
| L27-52 + L54 + L67-75 | constants.ts L3-40 | `26a27 > ` — single added blank line between STATUS_COLORS and `type AgentStatuses` (cosmetic; monolith had the FocusContext block there) |
| L55-65 | focusContext.ts L6-16 | IDENTICAL |
| L77-92 | deskLayout.ts L5-20 | IDENTICAL |
| L94-129 | CameraRig.tsx L10-45 | IDENTICAL |
| L131-134 | Building.tsx L7-10 | single delta: `useGLTF('/models/building.glb')` → `useGLTF(BUILDING_MODEL_URL)` (sanctioned; const at Building.tsx L5 holds same literal) |
| L136-149 | FloorPlane.tsx L6-19 | IDENTICAL |
| L151-174 | DeskMarkers.tsx L9-32 | IDENTICAL |
| L176-228 | Agent.tsx L8-60 | IDENTICAL |
| L242-253 (light block) | Lighting.tsx L6-17 | **byte-identical even without normalization** (same 6-space indent) |
| L230-275 | Scene.tsx L21-55 | single delta: 12-line light block → `      <Lighting />` (sanctioned) |
| L277-323 | FloorSelector.tsx L6-52 | IDENTICAL |
| L325-369 | WebGLErrorBoundary.tsx L5-49 | IDENTICAL |
| L371-417 | OfficeCanvas.tsx L14-60 | IDENTICAL |

Line-coverage proof (`f2-coverage.sh`): every non-blank monolith line L27-417 excluding light block L242-253
tested with `grep -Fxq` against `cat office/*`, allowing `export `/`export default ` prefix:

```
MISSING L132:   const { scene } = useGLTF('/models/building.glb');
MISSING_COUNT=1
```

Sole miss is the sanctioned BUILDING_MODEL_URL substitution. No silently dropped code.

Note: `AgentStatuses` type + `DEFAULT_STATUSES` + constants exported — all sanctioned per task spec.

## Rule 2 — Quotes/layout unchanged, no formatter: PASS

- Only double-quote occurrence in office/: `DeskMarkers.tsx:26 color="#78716c"` — identical to monolith L168 (the monolith's only double-quoted line among moved code). No single→double conversion anywhere.
- Block diffs above are byte-level after export-prefix normalization; any trailing-comma/semi/JSX-layout change would have surfaced. None did.
- Lighting.tsx body byte-identical to monolith including indentation.

## Rule 3 — 'use client' placement: PASS

`head -1` of each file:
```
Agent/Building/CameraRig/DeskMarkers/FloorPlane/FloorSelector/Lighting/OfficeCanvas/Scene/WebGLErrorBoundary .tsx → 'use client';
focusContext.ts → 'use client';
constants.ts   → import type { AgentId, AgentStatus, FloorId } from '@redhunter/shared';   (no directive — per plan)
deskLayout.ts  → import * as THREE from 'three';                                           (no directive — per plan)
```
All 10 `.tsx` + `focusContext.ts` have it first-line; `constants.ts`/`deskLayout.ts` correctly do not.

## Rule 4 — No barrel, exactly 13 files: PASS

```
ls office/ | grep -iE '^index\.(ts|tsx)$'  → no barrel
file count: 13   (10 .tsx, 3 .ts, 0 dirs)
```

## Rule 5 — Import allowlist: PASS

All unique import sources: `three`, `react`, `@react-three/fiber`, `@react-three/drei`, `@redhunter/shared`,
and relative `./constants ./deskLayout ./focusContext ./Agent ./Building ./CameraRig ./DeskMarkers ./FloorPlane ./FloorSelector ./Lighting ./Scene ./WebGLErrorBoundary`.
Disallowed filter (`grep -v` of allowlist) → `none`.

## Rule 6 — Naming / no new `any`: PASS

- `.tsx` all PascalCase; `.ts` modules camelCase (`constants.ts`, `focusContext.ts`, `deskLayout.ts`). All identifiers English, carried over verbatim from monolith; no renames, no new abbreviations.
- `grep -n any office/*` → only `CameraRig.tsx:12-13` — the pre-existing `useRef<any>` with its original eslint-disable comment (monolith L96-97). No new `any`.

## Rule 7 — Must-NOT list: PASS

```
useGLTF\.preload : absent        frameloop : absent        dpr : absent
occlude          : absent        type="button" : absent    JSDoc /** : absent
as const         : FloorSelector.tsx:43 textAlign: 'left' as const  ← PRE-EXISTING monolith L314, verbatim (block diff IDENTICAL). Not a new `as const`.
```
- Inline materials still inline: `meshStandardMaterial` present in FloorPlane.tsx, DeskMarkers.tsx, Agent.tsx. No material registry.
- `Lighting.tsx:11 shadow-mapSize={[2048, 2048]}` — still array prop.
- CameraRig: `dampingFactor={0.08}` / `minDistance={3}` / `maxDistance={40}` / `maxPolarAngle={Math.PI * 0.48}` all present (L39-42).
- Agent: `onClick` on mesh (L28-31) + label `<div>` with `{agent.title}` (L55) — monolith structure intact.
- No props refactor (prop shapes byte-identical per block diffs), no renames.

## Rule 8 — Lint exact-4 + typecheck: PASS

`bunx biome lint apps/web/src/components/office` → Checked 13 files, 3 errors + 1 warning = exactly 4 diagnostics:
```
CameraRig.tsx:13:30     lint/suspicious/noExplicitAny
Agent.tsx:26:7          lint/a11y/noStaticElementInteractions
DeskMarkers.tsx:28:24   lint/suspicious/noArrayIndexKey
FloorSelector.tsx:29:11 lint/a11y/useButtonType
```
Matches the expected set 1:1. Biome preset `recommended` (biome.json L33) includes unused-import checks → zero unused-import diagnostics, and manual read of all 13 files confirms every imported symbol is used and nothing is missing.

`(cd apps/web && bun run typecheck)` → `tsc --noEmit -p .` → **EXIT=0** (strict: true). No stale `.next` type issue surfaced.

## Flags (non-blocking)

- constants.ts has one extra blank line vs the raw concatenated monolith region (where the removed FocusContext block used to sit). Cosmetic header/blank-line difference — explicitly NOT a failure per F2 rules.
- Import order in new file headers differs from monolith (derived per file). Explicitly NOT a failure per F2 rules.

RESULT: PASS
