# mvp-1-foundation - Work Plan

## TL;DR (For humans)

Deklarasikan `three`/`@react-three/fiber`/`@react-three/drei`/`@types/three` di `apps/web/package.json` (caret versi ter-resolve, tanpa upgrade major/minor), **baru** ambil baseline snapshot, lalu pecah `apps/web/src/components/OfficeCanvas.tsx` (417 LOC) menjadi 13 file di `apps/web/src/components/office/` dengan kode dipindah byte-identik — satu-satunya perubahan non-mekanis: konstanta `BUILDING_MODEL_URL` di `Building.tsx` dan `<Lighting />` menggantikan dua elemen lampu inline di posisi yang sama. Bukti "tampilan identik" = spec Playwright permanen `apps/web/e2e/dashboard-office.e2e.ts` (screenshot `main`, badge Next dev disembunyikan via CSS, SwiftShader dipaksa) yang mengambil baseline SEBELUM split dan wajib lulus SESUDAHNYA tanpa `--update-snapshots`, plus console-error check, `tsc`, dan `biome lint` per file (hanya 4 diagnostik lama yang ikut pindah). Tutup dengan laporan di `docs/mvp/HANDOFF.md` + update kecil guide §1/§9 dan `apps/web/AGENTS.md`. Worker tidak commit.

**Lint/format gate (disetujui user di brief):** `bun run lint` repo-wide sudah merah (4071 error format pre-existing, biome default double-quote vs kode single-quote) → gate MVP-1 = `biome lint` per file baru tanpa diagnostik baru. `biome format` TIDAK dijalankan dan TIDAK jadi gate (akan mengubah quote di setiap baris dan merusak klaim byte-identik).

## Scope

### Must have

- `three ^0.186.1`, `@react-three/fiber ^9.8.1`, `@react-three/drei ^10.7.9` in `dependencies`, `@types/three ^0.186.0` in `devDependencies` of `apps/web/package.json`; `bun install` at root; lockfile delta scoped to the react-three family.
- Deps declared BEFORE the baseline snapshot so baseline and after-run render with the same resolved versions.
- `apps/web/src/components/OfficeCanvas.tsx` split into `apps/web/src/components/office/`: `OfficeCanvas.tsx` (root), `Building.tsx`, `FloorPlane.tsx`, `DeskMarkers.tsx`, `Agent.tsx`, `CameraRig.tsx`, `FloorSelector.tsx`, `Lighting.tsx`, `WebGLErrorBoundary.tsx`, `Scene.tsx`, `constants.ts`, `focusContext.ts`, `deskLayout.ts` (13 files).
- `Building.tsx` exports `export const BUILDING_MODEL_URL = '/models/building.glb';` and is the only occurrence of the path under `apps/web/src`.
- `apps/web/src/app/dashboard/page.tsx:7` imports `@/components/office/OfficeCanvas`; old monolith deleted.
- Permanent spec `apps/web/e2e/dashboard-office.e2e.ts` + baseline in `apps/web/e2e/dashboard-office.e2e.ts-snapshots/`.
- `docs/mvp/HANDOFF.md` MVP-1 report; guide §1 MUST NOT 7 + §9 updated; `apps/web/AGENTS.md:13` updated.

### Must NOT have

- No behaviour/colour/position/camera/lighting/material/geometry/label/z-order change. Inline materials stay inline. Props byte-identical (e.g. `shadow-mapSize={[2048, 2048]}` stays an array prop).
- No fixing the 4 moved biome diagnostics (`noExplicitAny`, `noStaticElementInteractions`, `noArrayIndexKey`, `useButtonType`) nor `page.tsx:38 useButtonType`.
- No `biome format --write` anywhere. Moved code keeps the original single quotes and layout.
- No `useGLTF.preload`, `frameloop`, `dpr`, `occlude`, barrel `index.ts`, material registry, props refactor, JSDoc, renames, `as const`.
- No major or minor version bumps; no edits to other dependency lines, `apps/assets`, `packages/*`, `apps/api/*`, `next.config.ts`, `playwright.config.ts`, `useAuthStore.ts`, `dashboard/layout.tsx`.
- No Blender/GLB/backend/auth/API changes. Pre-existing dirty files (20 modified + 33 untracked) are never staged or edited — with two tooling exceptions that are already dirty today and get rewritten by `next dev`/Playwright: `apps/web/next-env.d.ts` and `apps/web/test-results/.last-run.json` (accepted, documented in HANDOFF).
- No `git commit`/`branch`/`stash`/branch-`checkout`/`push` unless the user says so in that turn (global consent gate). File-level `git checkout -- <file>` is allowed ONLY for the todo-2 lockfile revert. No deleting `index.lock`, no killing foreign processes on :3100.
- No `--update-snapshots` after the baseline (todo 3). No tolerance change after the baseline.

## Verification strategy

- **Test strategy:** no unit tests (pure move). Regression guard = Playwright visual snapshot of `main` + console-error assertion + `tsc` + per-file `biome lint`. Agent-executed QA in every todo.
- **Shell discipline (always):** the bash tool keeps cwd between calls. Never bare `cd`. Every command uses the repo root var and a subshell: `R=$(git rev-parse --show-toplevel)` once per call, then `(cd "$R/apps/web" && …)`; evidence paths as `"$R/.omo/evidence/mvp-1-foundation/…"`. Below, `cd apps/web && …` is shorthand for that subshell form and `…/NN-file` is shorthand for `"$R/.omo/evidence/mvp-1-foundation/NN-file"`.
- **Playwright invocation (always), in this exact order:** (1) `ss -ltnp | grep 3100` must be empty (else STOP, report — never kill a foreign process); (2) `rm -rf "$R/apps/web/.next/dev"` (identical cold Turbopack cache for baseline and after; folder is gitignored); (3) `(cd "$R/apps/web" && MVP1_PHASE=<phase> bunx playwright test e2e/dashboard-office.e2e.ts --output "$R/.omo/evidence/mvp-1-foundation/pw-output")` — `--output` keeps failure artefacts out of `apps/web/test-results/`. Referred to below as **PW_RUN(<phase>, [extra flags], [extra env])** — extra env vars (e.g. `PW_NEG=1`) go INSIDE the subshell next to `MVP1_PHASE=…`, never in front of the `(`. Every PW_RUN redirects `> …/<NN-file>.txt 2>&1; echo EXIT=$? >> …/<NN-file>.txt` so each evidence file ends with its exit code.
- **Import rule (always):** each new file imports ONLY the symbols its moved block actually uses. biome recommended includes `lint/correctness/noUnusedImports`; an unused import breaks the per-file lint count. Where the plan says "as used", the worker derives the list from the moved body, not from the monolith's original import line.
- **Lint count pattern (always):** `grep -cE '^apps/.*lint/' <file>` — plain `lint/` also matches the `@typescript-eslint/no-explicit-any` comment inside a code frame and over-counts.
- **Gates at the end:**
  - `cd apps/web && bun run typecheck` → exit 0 (run AFTER a Playwright run, because `next dev` regenerates `.next/dev/types` referenced by `next-env.d.ts:3-4`).
  - `bunx biome lint apps/web/src/components/office apps/web/e2e/dashboard-office.e2e.ts apps/web/src/app/dashboard/page.tsx` → exactly 5 diagnostics: `noExplicitAny` CameraRig.tsx, `noStaticElementInteractions` Agent.tsx, `noArrayIndexKey` DeskMarkers.tsx, `useButtonType` FloorSelector.tsx, `useButtonType` page.tsx:38; spec 0.
  - Spec passes against the todo-3 baseline without `--update-snapshots`.
  - `rtk git status --short` vs `00-git-status-before.txt`: new lines only for `apps/web/package.json`, `bun.lock`, `apps/web/src/app/dashboard/page.tsx`, `apps/web/AGENTS.md`, `docs/redhunter-hq-brainstorming-guided.md`, `docs/mvp/HANDOFF.md`, deleted `apps/web/src/components/OfficeCanvas.tsx`, `apps/web/src/components/office/`, `apps/web/e2e/dashboard-office.e2e.ts`, `apps/web/e2e/dashboard-office.e2e.ts-snapshots/`, `.omo/`.
- **Evidence root:** `.omo/evidence/mvp-1-foundation/` (create). Every QA scenario writes there.

## Execution strategy

- **Wave 0 (sequential):** 1 (pre-state) → 2 (deps + install) → 3 (spec + baseline). Deps BEFORE baseline so both snapshots use the same resolved versions.
- **Wave 1 (after 3):** 4 (support files).
- **Wave 2 (parallel after 4):** 5 (Building/FloorPlane/DeskMarkers) ∥ 6 (Agent/CameraRig/FloorSelector/WebGLErrorBoundary/Lighting).
- **Wave 3 (sequential):** 7 (Scene + root) → 8 (page.tsx switch + delete) → 9 (regression run) → 10 (docs).

| Todo | Depends on | Blocks |
|---|---|---|
| 1 | — | 2 |
| 2 | 1 | 3 |
| 3 | 2 | 4 |
| 4 | 3 | 5,6 |
| 5 | 4 | 7 |
| 6 | 4 | 7 |
| 7 | 5,6 | 8 |
| 8 | 7 | 9 |
| 9 | 8 | 10 |
| 10 | 9 | F1-F4 |

## Todos

- [x] 1. Capture pre-state: evidence dir, dirty-worktree ledger, resolved versions, typecheck/lint baseline, install dry-run

**What to do**
- `mkdir -p .omo/evidence/mvp-1-foundation`.
- `rtk git status --short > .omo/evidence/mvp-1-foundation/00-git-status-before.txt`; `rtk git diff --stat apps/web > …/00b-web-diffstat-before.txt` (concurrent-session guard, re-checked in todo 9).
- Resolved versions: `for p in three @react-three/fiber @react-three/drei @types/three; do node -e "console.log('$p', require('./apps/web/node_modules/$p/package.json').version)"; done > …/01-resolved-versions.txt`. Expected `0.186.1 9.8.1 10.7.9 0.186.0`; `wc -l apps/web/src/components/OfficeCanvas.tsx >> …/01-resolved-versions.txt` (expect 417).
- `bun install --dry-run > …/01b-install-dry-run-before.txt 2>&1` (today reports `+3 -1`; this is the pre-edit baseline for the lock drift).
- `cd apps/web && bun run typecheck > ../../.omo/evidence/mvp-1-foundation/02-typecheck-before.txt 2>&1; echo EXIT=$? >> …/02-typecheck-before.txt` (expect EXIT=0). Also root: `bun run --filter '*' typecheck > …/02b-typecheck-root-before.txt 2>&1; echo EXIT=$? >> …` (whatever it is — F3 compares against this, not against 0).
- `bunx biome lint apps/web/src/components/OfficeCanvas.tsx apps/web/src/app/dashboard/page.tsx > …/03-biome-lint-before.txt 2>&1` (expect: L97 noExplicitAny, L170 noArrayIndexKey, L194 noStaticElementInteractions, L300 useButtonType, page.tsx L38 useButtonType).

**Must NOT do**
- No edits outside `.omo/evidence/`. No `git stash`/`checkout`, no deleting `index.lock`.

**Parallelization:** Wave 0, first. Blocks 2.

**References**
- `apps/web/package.json:1-30`; `apps/web/node_modules/{three,@react-three/fiber,@react-three/drei,@types/three}/package.json`; global AGENTS.md "Git Mutation Consent Gate".

**Acceptance criteria**
- Files `00, 00b, 01, 01b, 02, 02b, 03` exist; `02` EXIT=0; `grep -cE '^apps/.*lint/' …/03-biome-lint-before.txt` = 5.

**QA scenarios**
- Happy: `ls .omo/evidence/mvp-1-foundation/ | wc -l` ≥ 7; `grep -c '417' …/01-resolved-versions.txt` = 1.
- Failure: `02-typecheck-before.txt` EXIT≠0 → STOP and report verbatim (pre-existing break, out of scope).

**Commit:** none (evidence only).

- [x] 2. Declare 3D deps in `apps/web/package.json` and run `bun install`

**What to do**
- Edit `apps/web/package.json`: `dependencies` add (alphabetical, other lines untouched) `"@react-three/drei": "^10.7.9"`, `"@react-three/fiber": "^9.8.1"`, `"three": "^0.186.1"`; `devDependencies` add `"@types/three": "^0.186.0"`. Use values from `01-resolved-versions.txt` if they differ.
- Root: `bun install > …/20-bun-install.txt 2>&1; echo EXIT=$? >> …/20-bun-install.txt`.
- Lock delta: `rtk git diff --stat bun.lock > …/21-lock-diff-stat.txt`; `rtk git diff bun.lock | grep '^[+-]' | grep -v '^[+-][+-]' > …/22-lock-diff-lines.txt`. Allowed: `+` lines for `@react-three/fiber`, `@react-three/drei`, `@types/three` and their transitive tree (`three-stdlib`, `@use-gesture/react`, `maath`, `suspend-react`, `its-fine`, `react-reconciler`, `scheduler`, `@monogrid/gainmap-js`, `camera-controls`, `detect-gpu`, `glsl-noise`, `hls.js`, `meshline`, `stats-gl`, `stats.js`, `troika-three-text`, `troika-three-utils`, `troika-worker-utils`, `tunnel-rat`, `utility-types`, `@mediapipe/tasks-vision`, `@babel/runtime`, `cross-env`, `three-mesh-bvh`, `@types/webxr`, `@types/stats.js`, `@types/draco3d`, `@types/offscreencanvas`, `@dimforge/rapier3d-compat`, `bidi-js`, `webgl-sdf-generator`, `fflate`, `potpack`, `promise-worker-transferable`, `is-promise`, `lie`, `immediate`, `@tweenjs/tween.js`, `draco3d`, `requireindex`, `zustand` reuse) and the `-1` already present in `01b`. Any `-` line changing `next`, `react`, `react-dom`, `typescript`, `zustand`, `@playwright/test`, `tailwindcss`, `jwt-decode` → revert `bun.lock` + `package.json` (`git checkout -- bun.lock` is a FILE checkout, allowed), STOP, report.
- Version check: re-run the loop → `23-resolved-versions-after.txt`. Rule: **same major.minor required** (`0.186.x`, `9.8.x`, `10.7.x`, `0.186.x`); patch drift allowed and MUST be recorded in HANDOFF. Major/minor drift → STOP, report (user decides pin vs accept). Because the baseline (todo 3) is taken AFTER this install, patch drift cannot confound the before/after comparison.
- `cd apps/web && bun run typecheck` → `24-typecheck-after-deps.txt` EXIT=0.

**Must NOT do**
- No `bun update`/`bun add`; no `--force`/`--frozen-lockfile`; no edits to other package.json files.

**Parallelization:** Wave 0, after 1. Blocks 3.

**References**
- `apps/web/package.json:13-28`; `bun.lock:39,650` (only `three` today; `grep -c '@react-three' bun.lock` = 0); fiber `package.json:61-69` peer three>=0.156, drei `:55-59` >=0.159; guide §7.3 P0.

**Acceptance criteria**
- `rtk git diff apps/web/package.json` → exactly 4 `+` lines (plus comma adjustments), 0 removed keys.
- `20` EXIT=0; `23` same major.minor as `01` for all 4; `24` EXIT=0; `22` has no forbidden `-` line.

**QA scenarios**
- Happy: `node -e "const p=require('./apps/web/package.json');console.log(p.dependencies.three,p.dependencies['@react-three/fiber'],p.dependencies['@react-three/drei'],p.devDependencies['@types/three'])"` → `^0.186.1 ^9.8.1 ^10.7.9 ^0.186.0`.
- Failure: `grep -E '^-.*"(next|react|react-dom|typescript|zustand|@playwright/test|tailwindcss|jwt-decode)@' …/22-lock-diff-lines.txt` → exit 1 (no match).

**Commit:** none unless asked; suggested `chore(web): declare three/fiber/drei deps explicitly`.

- [x] 3. Write permanent spec `apps/web/e2e/dashboard-office.e2e.ts` and capture the BEFORE-split baseline

**What to do**
- Create the spec in the same style as `apps/web/e2e/landing.e2e.ts` (single quotes, 2-space; do NOT run biome format). Requirements:
  - `import { test, expect } from '@playwright/test';` plus `fs`/`path` imports in exactly the style `landing.e2e.ts:1-4` uses (copy those lines).
  - `test.setTimeout(120_000);` (config timeout is 30s at `playwright.config.ts:7` and is not editable).
  - `const EVIDENCE_DIR = path.resolve(__dirname, '../../.omo/evidence/mvp-1-foundation');`
  - `const AGENT_TITLE_ANCHOR = 'Chief Executive Officer';` (`packages/shared/src/agents.ts:23`; label renders `agent.title`, `OfficeCanvas.tsx:223`).
  - `const WEBGL_FALLBACK_TEXT = 'WebGL not available';` (`OfficeCanvas.tsx:360`).
  - `const ALLOWLIST: string[] = [];`
  - Unsigned JWT `DUMMY_TOKEN`: header `{alg:'none',typ:'JWT'}`, payload `{ email: 'e2e@redhunter.local', role: 'admin', exp: Math.floor(Date.now()/1000) + 3600 }`, empty signature, parts via `Buffer.from(JSON.stringify(x)).toString('base64url')` joined by `.`. Fixed email/role because the header renders them (`page.tsx:30-35`).
  - `test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'dark', launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });` at file top level (worker-scoped option; valid outside `describe`).
  - `test.beforeEach(async ({ page }) => { await page.addInitScript((t) => localStorage.setItem('auth_token', t), DUMMY_TOKEN); });` — init script required because the store reads the token at creation (`useAuthStore.ts:60-61`).
  - One test `'dashboard office canvas renders identically'`:
    1. `const phase = process.env.MVP1_PHASE ?? 'run'; const errors: string[] = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));` (warnings not collected).
    2. `const glb = page.waitForResponse(r => r.url().endsWith('/models/building.glb') && r.status() === 200, { timeout: 60_000 });` then `await page.goto('/dashboard'); await glb; await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });`
    3. `await expect(page.getByText(WEBGL_FALLBACK_TEXT)).toHaveCount(0);` and `const renderer = await page.evaluate(() => { const c = document.querySelector('canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl')); if (!gl) return null; const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); }); expect(renderer).toBeTruthy(); fs.writeFileSync(path.join(EVIDENCE_DIR, \`14-renderer-${phase}.txt\`), String(renderer));` — worker checks the file contains `SwiftShader`; if not, record the actual renderer string in HANDOFF (determinism still gated by the plain re-run below).
    4. `await expect(page.getByText(AGENT_TITLE_ANCHOR)).toBeVisible({ timeout: 30_000 });`
    5. `await page.waitForTimeout(3000);` (lerp `t=min(1,delta*3)` at `OfficeCanvas.tsx:113` leaves <0.001 units after 3s; damping has no input to decay).
    6. `await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });` (hides the Next 16 dev badge host and its shadow tree; `mask` would not reach the shadow root).
    7. `await page.screenshot({ path: path.join(EVIDENCE_DIR, \`10-dashboard-${phase}.png\`) });`
    8. `await expect(page.locator('main')).toHaveScreenshot('dashboard-office.png', { maxDiffPixelRatio: 0.01, animations: 'disabled' });` — `main` exists at `apps/web/src/app/dashboard/page.tsx:46-48` (`<main className="flex-1 overflow-hidden"><OfficeCanvas /></main>`); it excludes the header (`next/font/google` Inter, email/role text) and keeps canvas + FloorSelector. If `main` is absent → STOP, report. Never fall back to `page`.
    9. `fs.writeFileSync(path.join(EVIDENCE_DIR, \`11-console-${phase}.json\`), JSON.stringify(errors, null, 2)); expect(errors.filter(e => !ALLOWLIST.some(a => e.includes(a)))).toEqual([]);` — if the BEFORE run shows errors, add each exact substring to `ALLOWLIST` with `// pre-existing (MVP-1 baseline)` and list them in HANDOFF. Never allowlist an error that first appears AFTER.
    10. Negative self-check hook: `if (process.env.PW_NEG) await page.addStyleTag({ content: 'canvas{filter:invert(1)}' });` placed right before step 8 (3 lines, documented in HANDOFF; keep).
- Baseline: PW_RUN(before, `--update-snapshots`) `> …/12-playwright-before.txt 2>&1; echo EXIT=$? >> …/12-playwright-before.txt`. Snapshot lands at `apps/web/e2e/dashboard-office.e2e.ts-snapshots/dashboard-office-linux.png` (no `projects` in config → no project segment).
- Stability re-run: PW_RUN(before2) (no `--update-snapshots`) `> …/12b-playwright-before-rerun.txt` → must pass. If flaky: raise step-5 wait to 5000 first; then `maxDiffPixelRatio` up to 0.02 max; record in HANDOFF; beyond that STOP and report.
- Negative: PW_RUN(neg, –, `PW_NEG=1`) `> …/13-playwright-negative.txt` → must FAIL on `toHaveScreenshot` (EXIT≠0 recorded).
- `bunx biome lint apps/web/e2e/dashboard-office.e2e.ts` → 0 diagnostics.

**Must NOT do**
- No edits to `playwright.config.ts`, `useAuthStore.ts`, `dashboard/layout.tsx`, `next.config.ts`, any product file. No `biome format`. Baseline from the UNMODIFIED monolith.

**Parallelization:** Wave 0, after 2. Blocks 4.

**References**
- `apps/web/playwright.config.ts:4-25` (no projects, timeout 30s, baseURL :3100, webServer `next dev -p 3100`, `reuseExistingServer:false`).
- `apps/web/e2e/landing.e2e.ts` (style to mirror); `apps/web/src/app/dashboard/layout.tsx:16-23`; `apps/web/src/stores/useAuthStore.ts:39,51,60-61,92-107`.
- `apps/web/src/components/OfficeCanvas.tsx:113` (lerp), `:209-226` (Html labels), `:223` (title), `:360` (fallback text), `:371-417` (root).
- `packages/shared/src/agents.ts:6-14,23`; `apps/web/src/app/layout.tsx:2,5` (Inter font → excluded via `main`).

**Acceptance criteria**
- Spec exists; `bunx biome lint` on it → 0.
- `apps/web/e2e/dashboard-office.e2e.ts-snapshots/dashboard-office*.png` exists, > 20 KB; worker opens it with `read` and confirms building, floor planes, agent labels, FloorSelector visible (not a solid frame).
- `12` EXIT=0, `12b` EXIT=0, `13` EXIT≠0 with a `toHaveScreenshot` failure; `10-dashboard-before.png`, `11-console-before.json`, `14-renderer-before.txt` present.

**QA scenarios**
- Happy: `12b-playwright-before-rerun.txt` contains `1 passed`.
- Failure: `13-playwright-negative.txt` contains `1 failed` and mentions `toHaveScreenshot`.

**Commit:** none unless asked; suggested `test(web): add dashboard office visual regression spec + baseline`.

- [x] 4. Create support files `constants.ts`, `focusContext.ts`, `deskLayout.ts`

**What to do**
- `mkdir -p apps/web/src/components/office`.
- `constants.ts` (no `'use client'`): move verbatim `OfficeCanvas.tsx` L27-52 (`FLOOR_HEIGHT`, `AGENT_Y_OFFSET`, `CAMERA_LERP_SPEED`, `FLOOR_COLORS`, `FLOOR_EMISSIVE`, `STATUS_COLORS`), L54 (`AgentStatuses` type), L67-75 (`DEFAULT_STATUSES`). Prefix each declaration with `export`. Imports: only the `@redhunter/shared` names these blocks use — expected `AgentId`, `AgentStatus`, `FloorId` (types) and `AGENT_DEFINITIONS` only if `DEFAULT_STATUSES` references it (worker checks L67-75; if not referenced, do not import it).
- `focusContext.ts` (`'use client'`): move verbatim L55 (`FocusTarget` — uses `THREE` type), L57-60 (`FocusContextValue` interface), L62-65 (`FocusContext = createContext…`). Export all three. Imports: `createContext` from `react`, `import type * as THREE from 'three'` (type-only), shared types as used.
- `deskLayout.ts` (no `'use client'`): move verbatim L77-92 (`deskPositionForDeskId`, `deskToWorld`, `floorCenter`), export each. Imports (L77-92 uses only `THREE.Vector3`, `FloorId`, `FLOOR_HEIGHT`, `AGENT_Y_OFFSET`): `import * as THREE from 'three'`, `import type { FloorId } from '@redhunter/shared'`, `import { FLOOR_HEIGHT, AGENT_Y_OFFSET } from './constants'`. Do NOT import `OFFICE_LAYOUT`/`findAgentDesk` here (unused → `noUnusedImports`); they belong to the files whose blocks call them (`DeskMarkers`, `FloorSelector`, `Agent`/`Scene` as applicable).
- Verify per block: `diff <(sed -n 'A,Bp' apps/web/src/components/OfficeCanvas.tsx) <(sed -n 'C,Dp' <newfile>)` → only `export ` prefixes differ. Save to `30-diff-support.txt`.
- `bunx biome lint apps/web/src/components/office` → 0.

**Must NOT do**
- No renames, value changes, `as const`, enums, JSDoc, formatting. Do not delete from the old file yet.

**Parallelization:** Wave 1, after 3. Blocks 5, 6.

**References**
- `apps/web/src/components/OfficeCanvas.tsx:1-26` (imports), `:27-92`.
- `packages/shared/src/office-layout.ts:30,60`; `packages/shared/src/index.ts` (copy the exact import specifier the monolith uses).
- Global AGENTS.md naming (camelCase `.ts` for non-components).

**Acceptance criteria**
- 3 files exist; `cd apps/web && bun run typecheck` EXIT=0 (old + new compile side by side); `30-diff-support.txt` shows only `export` insertions; biome lint 0.

**QA scenarios**
- Happy: `grep -n 'FLOOR_HEIGHT = 4' apps/web/src/components/office/constants.ts` → 1 match; `grep -c 'createContext' apps/web/src/components/office/focusContext.ts` ≥ 1.
- Failure: `grep -n 'createContext\|FocusTarget' apps/web/src/components/office/constants.ts apps/web/src/components/office/deskLayout.ts` → empty.

**Commit:** none unless asked; suggested `refactor(web): extract office constants, focus context, desk layout helpers`.

- [x] 5. Create `Building.tsx` (with `BUILDING_MODEL_URL`), `FloorPlane.tsx`, `DeskMarkers.tsx`

**What to do**
- `Building.tsx` (`'use client'`): move L131-134 verbatim; add above: `export const BUILDING_MODEL_URL = '/models/building.glb';` and replace the literal in `useGLTF('/models/building.glb')` with `useGLTF(BUILDING_MODEL_URL)`. `export function Building`. (No `useGLTF.preload` exists in the monolith — do not add one.) Import `useGLTF` from `@react-three/drei`.
- `FloorPlane.tsx` (`'use client'`): move L136-149 verbatim; `export function FloorPlane`; imports `FLOOR_HEIGHT`, `FLOOR_COLORS`, `FLOOR_EMISSIVE` from `./constants`, `FloorId` from shared as original.
- `DeskMarkers.tsx` (`'use client'`): move L151-174 verbatim incl. `key={i}`; `export function DeskMarkers`; imports `Instances`, `Instance` from drei; `useMemo` from react; `deskPositionForDeskId` from `./deskLayout` (`OfficeCanvas.tsx:156`); `OFFICE_LAYOUT`/`FloorId` from shared as used; `FLOOR_HEIGHT` from `./constants` if used.
- `diff` per block → `31-diff-wave2a.txt` (only `export`/import/`BUILDING_MODEL_URL` substitution).
- `bunx biome lint` these 3 → exactly 1 (`noArrayIndexKey` DeskMarkers).

**Must NOT do**
- No geometry/colour/material/flag changes; no material extraction; no format.

**Parallelization:** Wave 2, parallel with 6. Depends on 4. Blocks 7.

**References**
- `apps/web/src/components/OfficeCanvas.tsx:131-174`; guide §9 (MVP-2 swaps GLB via one line).

**Acceptance criteria**
- `grep -nE "BUILDING_MODEL_URL = ['\"]/models/building.glb['\"]" apps/web/src/components/office/Building.tsx` → 1; `grep -c 'building.glb' …/Building.tsx` → 1; `grep -n 'useGLTF(BUILDING_MODEL_URL)' …/Building.tsx` → 1.
- typecheck EXIT=0; lint → only `noArrayIndexKey`; `31` clean.

**QA scenarios**
- Happy: the three greps above.
- Failure: `grep -rnE "['\"]/models/building.glb['\"]" apps/web/src/components/office | grep -v 'BUILDING_MODEL_URL ='` → empty.

**Commit:** none unless asked; suggested `refactor(web): split Building/FloorPlane/DeskMarkers out of OfficeCanvas`.

- [x] 6. Create `Agent.tsx`, `CameraRig.tsx`, `FloorSelector.tsx`, `WebGLErrorBoundary.tsx`, `Lighting.tsx`

**What to do**
- `Agent.tsx` (`'use client'`): move L176-228 verbatim (clickable `<div>` kept); `export function Agent`; imports `Html` (drei), `useFrame` (fiber) if used, react hooks as used, `THREE` if used, `STATUS_COLORS`/`AGENT_Y_OFFSET`/etc. from `./constants`, `FocusContext` from `./focusContext`, `deskToWorld` from `./deskLayout`, shared types.
- `CameraRig.tsx` (`'use client'`): move L94-129 verbatim INCLUDING the `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment and the `any` ref; `export function CameraRig`; imports `OrbitControls` (drei), `useFrame`/`useThree` (fiber), react hooks, `THREE`, `CAMERA_LERP_SPEED` from `./constants`, `FocusContext` from `./focusContext`.
- `FloorSelector.tsx` (`'use client'`): move L277-323 verbatim; `export function FloorSelector`; imports `OFFICE_LAYOUT` (`OfficeCanvas.tsx:296`) + `FloorId` from shared, `FLOOR_COLORS` from `./constants` if used.
- `WebGLErrorBoundary.tsx` (`'use client'`): move L325-369 verbatim (`console.error('[OfficeCanvas] WebGL error:', …)` and the `'WebGL not available'` text unchanged); `export class WebGLErrorBoundary`; imports `Component`, `ErrorInfo`, `ReactNode` from react.
- `Lighting.tsx` (`'use client'`): copy L242-253 EXACTLY (`<ambientLight intensity={0.4} />` and `<directionalLight position={[10, 20, 10]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-far={50} shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15} />` — the real prop order is far, left, right, top, bottom; copy whatever the file has) into `export function Lighting() { return (<>…</>); }`.
- `diff` per block → `32-diff-wave2b.txt`.
- `bunx biome lint` these 5 → exactly 3 (`noStaticElementInteractions` Agent, `noExplicitAny` CameraRig, `useButtonType` FloorSelector).

**Must NOT do**
- No `type="button"`, no typing the controls ref, no div→button, no change to damping/min/max/polar/initial camera, no inline-style changes, no format.

**Parallelization:** Wave 2, parallel with 5. Depends on 4. Blocks 7.

**References**
- `apps/web/src/components/OfficeCanvas.tsx:94-129, 176-228, 242-253, 277-369`; `…/03-biome-lint-before.txt`.

**Acceptance criteria**
- 5 files; typecheck EXIT=0; lint → exactly the 3 listed; `grep -cF "'[OfficeCanvas] WebGL error:'" WebGLErrorBoundary.tsx` = 1; `32` only `export`/import/fragment-wrapper deltas.

**QA scenarios**
- Happy: `grep -cF 'shadow-mapSize={[2048, 2048]}' Lighting.tsx` = 1; `grep -cF 'intensity={0.4}' Lighting.tsx` = 1; `grep -cF 'intensity={1.5}' Lighting.tsx` = 1.
- Failure: `grep -n 'type="button"' FloorSelector.tsx` → empty.

**Commit:** none unless asked; suggested `refactor(web): split Agent/CameraRig/FloorSelector/ErrorBoundary/Lighting out of OfficeCanvas`.

- [x] 7. Create `Scene.tsx` and root `office/OfficeCanvas.tsx`

**What to do**
- `Scene.tsx` (`'use client'`): move L230-275 verbatim, replacing the inline light pair (L242-253) with `<Lighting />` at the SAME tree position (before `<Building />`). `handleAgentClick` (distance 5), FloorPlane map, DeskMarkers, Agents map, `<CameraRig />` order unchanged. `export function Scene`. Imports (only what L230-275 uses): the 6 components from `./Lighting`, `./Building`, `./FloorPlane`, `./DeskMarkers`, `./Agent`, `./CameraRig`; `AgentStatuses` type from `./constants`; `FocusContext` from `./focusContext`; `deskToWorld` from `./deskLayout`; react hooks and `@redhunter/shared` names only if the body references them.
- `office/OfficeCanvas.tsx` (`'use client'`): move L371-417 verbatim — `OfficeCanvasProps` interface (`:371-373`), `useState(2)`, `<Canvas shadows camera={{ position: [0, 6, 18], fov: 60, near: 0.1, far: 200 }} …>`, `gl` (`THREE.ACESFilmicToneMapping`, exposure 1), clearColor `'#0a0a0a'`, `<Suspense fallback={null}>`, `<FocusContext.Provider>`, `handleFloorSelect` (distance 15, uses `floorCenter` `:389`), `<WebGLErrorBoundary>`, `<FloorSelector>`. Keep `export default function OfficeCanvas`. Imports: `Canvas` (fiber), `THREE`, react hooks, `./Scene`, `./FloorSelector`, `./WebGLErrorBoundary`, `FocusContext` + `FocusTarget` type from `./focusContext`, `floorCenter` from `./deskLayout`, constants as used.
- Delete nothing yet. `diff` → `33-diff-wave3.txt`. `bunx biome lint apps/web/src/components/office` → exactly 4.
- Cycle check: `grep -ln "from './OfficeCanvas'\|from './Scene'" apps/web/src/components/office/*.ts apps/web/src/components/office/{Building,FloorPlane,DeskMarkers,Agent,CameraRig,FloorSelector,WebGLErrorBoundary,Lighting}.tsx` → empty.
- `wc -l apps/web/src/components/office/* > …/34-loc-new-files.txt`.

**Must NOT do**
- No barrel; no Canvas prop/tone-mapping/exposure/clearColor/Suspense/provider/initial-floor change; no `frameloop`/`dpr`.

**Parallelization:** Wave 3, after 5 and 6. Blocks 8.

**References**
- `apps/web/src/components/OfficeCanvas.tsx:230-275, 371-417`; `apps/web/src/app/dashboard/page.tsx:7` (default import contract).

**Acceptance criteria**
- 13 files; typecheck EXIT=0; lint exactly 4; cycle grep empty; LOC sum in `34` within ±80 of 417.

**QA scenarios**
- Happy: `grep -nF "'#0a0a0a'" office/OfficeCanvas.tsx` → match; `grep -n 'ACESFilmicToneMapping' office/OfficeCanvas.tsx` → match; `grep -n 'Lighting\|Building' Scene.tsx` shows `<Lighting />` line < `<Building />` line.
- Failure: `grep -n 'ambientLight\|directionalLight' Scene.tsx office/OfficeCanvas.tsx` → empty.

**Commit:** none unless asked; suggested `refactor(web): add Scene and office/OfficeCanvas root`.

- [x] 8. Switch `dashboard/page.tsx` import, delete old monolith

**What to do**
- Edit `apps/web/src/app/dashboard/page.tsx:7`: `import('@/components/OfficeCanvas')` → `import('@/components/office/OfficeCanvas')`; keep `{ ssr: false, loading }` and all else byte-identical.
- `rm apps/web/src/components/OfficeCanvas.tsx` (not `git rm`).
- `grep -rn "components/OfficeCanvas'" apps/web/src apps/web/e2e` → 0 hits.
- No typecheck in this todo: it is deferred to todo 9 after PW_RUN regenerates `.next/dev/types` (the cache is cleared by PW_RUN itself).
- `bunx biome lint apps/web/src/components/office apps/web/src/app/dashboard/page.tsx > …/41-biome-lint-after.txt` → 4 + 1.

**Must NOT do**
- No change to `page.tsx:38` or the `loading` component; no docs edits here.

**Parallelization:** Wave 3, after 7. Blocks 9.

**References**
- `apps/web/src/app/dashboard/page.tsx:7,47`.

**Acceptance criteria**
- `test ! -f apps/web/src/components/OfficeCanvas.tsx`; `grep -rn 'building.glb' apps/web/src` → exactly 1 hit (`office/Building.tsx`); `grep -cE '^apps/.*lint/' …/41-biome-lint-after.txt` = 5.

**QA scenarios**
- Happy: `grep -n 'office/OfficeCanvas' apps/web/src/app/dashboard/page.tsx` → 1 match on the `dynamic(` line; `grep -n 'ssr: false' …/page.tsx` → present.
- Failure: `grep -rn "@/components/OfficeCanvas'" apps/web/src apps/web/e2e` → empty.

**Commit:** none unless asked; suggested `refactor(web): point dashboard at office/OfficeCanvas, remove monolith`.

- [x] 9. Regression run: snapshot matches baseline, console clean, typecheck green

**What to do**
- Concurrent-session guard: `rtk git diff --stat apps/web/src/stores apps/web/src/app/dashboard/layout.tsx apps/web/src/lib > …/50-web-diffstat-after.txt`; those paths must match `00b-web-diffstat-before.txt`; else STOP, report.
- PW_RUN(after) `> …/51-playwright-after.txt 2>&1; echo EXIT=$? >> …/51-playwright-after.txt`. **NEVER `--update-snapshots` here.**
- On `toHaveScreenshot` failure: inspect `…/pw-output/**/*-diff.png` + `10-dashboard-before.png`/`10-dashboard-after.png` with `read`; bisect via `30-33` diff files; fix the move; re-run. Never raise tolerance or regenerate.
- On new console error: it is a behaviour change → todo NOT done; report.
- Negative (gate bites): set `FLOOR_HEIGHT = 5` in `constants.ts`, PW_RUN(neg2) → must FAIL (`56-playwright-negative-after.txt`); revert to `4`, confirm `grep -n 'FLOOR_HEIGHT = 4' constants.ts`; PW_RUN(after2) → pass (`57-playwright-after-rerun.txt`).
- Then gates: `cd apps/web && bun run typecheck` → `52-typecheck-final.txt` EXIT=0; `bunx biome lint apps/web/src/components/office apps/web/e2e/dashboard-office.e2e.ts apps/web/src/app/dashboard/page.tsx > …/53-biome-lint-final.txt` (5).
- LAST (after `57` so no failure artefacts remain): `rtk git status --short > …/55-git-status-after.txt`; `diff 00-git-status-before.txt 55-git-status-after.txt` → only expected paths (see Verification strategy); `next-env.d.ts` and `test-results/.last-run.json` were already ` M` and stay so.

**Must NOT do**
- No `--update-snapshots`; no tolerance change; no edits outside `components/office/` + spec to make it pass.

**Parallelization:** Wave 3, after 8. Blocks 10.

**References**
- Todo 3 spec; `12-playwright-before.txt`; `apps/web/e2e/dashboard-office.e2e.ts-snapshots/`; `apps/web/next-env.d.ts:3-4`.

**Acceptance criteria**
- `51` and `57` EXIT=0 with `1 passed`; `56` `1 failed` on `toHaveScreenshot`; `10-dashboard-after.png`, `11-console-after.json` (equal to before modulo order), `14-renderer-after.txt` present; `52` EXIT=0; `53` count 5; `55` diff clean.

**QA scenarios**
- Happy: `grep -c '1 passed' 51-playwright-after.txt` = 1 and `grep -c 'failed' 51-playwright-after.txt` = 0.
- Failure: `grep -c 'toHaveScreenshot' 56-playwright-negative-after.txt` ≥ 1.

**Commit:** none unless asked.

- [x] 10. Docs: append HANDOFF report, update guide §1/§9 and `apps/web/AGENTS.md`

**What to do**
- Append to `docs/mvp/HANDOFF.md`: `## MVP-1 — Fondasi Web 3D Rapi (YYYY-MM-DD)` with **Selesai** / **Output** / **Keterbatasan**. Must include: declared ranges + resolved versions before/after (`01`, `23`; any patch drift); table new files + LOC (`34`); `BUILDING_MODEL_URL` location (`apps/web/src/components/office/Building.tsx:<line>`); screenshot paths (`10-dashboard-before.png`, `10-dashboard-after.png`, snapshot baseline path); exact Playwright command; screenshot target locator (`main`); `maxDiffPixelRatio` + wait values; renderer string from `14-*`; `ALLOWLIST` contents (or "kosong"); the 5 pre-existing biome diagnostics (file:line after move); repo-wide `bun run lint` still exit 1 (pre-existing format errors) and that `biome format` was deliberately not run; `PW_NEG` hook kept; tooling-rewritten files `next-env.d.ts`/`test-results/.last-run.json`; user instruction overrode guide §1 MUST NOT 7 for this MVP.
- `docs/redhunter-hq-brainstorming-guided.md`: §1 MUST NOT 7 — replace the OfficeCanvas.tsx prohibition with a one-line note that MVP-1 split it into `apps/web/src/components/office/` and further edits there follow the MVP plans. §9 — update the "undeclared deps" and "417 LOC monolith" facts. Minimal diff, Indonesian prose.
- `apps/web/AGENTS.md:13` — path cell → `src/components/office/`, description → "root `OfficeCanvas.tsx` + split 3D components". One row.
- `rtk git diff --stat docs apps/web/AGENTS.md > …/60-docs-diffstat.txt`.

**Must NOT do**
- No other guide sections; no new doc files; no README.

**Parallelization:** Wave 3, last. Depends on 9. Blocks F1-F4.

**References**
- `docs/mvp/HANDOFF.md` (append format); `docs/mvp/MVP-1-foundation.md` "Selesai"; guide §0, §1 MUST NOT 7, §9; `apps/web/AGENTS.md:13`.

**Acceptance criteria**
- `grep -n '## MVP-1' docs/mvp/HANDOFF.md` → 1; `grep -c 'BUILDING_MODEL_URL' docs/mvp/HANDOFF.md` ≥ 1; `grep -n 'office/' apps/web/AGENTS.md` → 1; §1 MUST NOT 7 mentions `components/office/`; `60` lists exactly 3 files.

**QA scenarios**
- Happy: `tail -60 docs/mvp/HANDOFF.md` shows every required field above.
- Failure: `grep -n 'src/components/OfficeCanvas.tsx' apps/web/AGENTS.md` → empty.

**Commit:** none unless asked; suggested `docs: MVP-1 handoff report, guide + AGENTS path updates`.

## Final verification wave

- [x] F1. Plan compliance audit
Re-read every todo's Acceptance criteria and verify each against `.omo/evidence/mvp-1-foundation/` (00-60). Any missing file or failed gate → reopen the owning todo. Write `F1-compliance.md` listing criterion → PASS/FAIL + evidence filename.

- [x] F2. Code quality review
Diff `apps/web/src/components/office/*` against `git show HEAD:apps/web/src/components/OfficeCanvas.tsx`: zero semantic deltas beyond `export`/import/`BUILDING_MODEL_URL`/`<Lighting />` substitution; quotes and layout unchanged (no formatter ran); `'use client'` on every `.tsx` and `focusContext.ts`; no barrel; no new imports outside three/fiber/drei/react/@redhunter/shared/./*; naming per global AGENTS.md. Write `F2-review.md`.

- [x] F3. Real manual QA
Fresh run: PW_RUN(final) → pass; open `10-dashboard-final.png` with `read`, confirm building, floor planes, desk markers, agent labels, FloorSelector top-right — matches `10-dashboard-before.png`. Then `cd apps/web && bun run typecheck` → 0, and root `bun run --filter '*' typecheck` → same exit code as `02b-typecheck-root-before.txt` (apps/api dirt is pre-existing). Write `F3-manual-qa.md` with commands + exit codes.

- [x] F4. Scope fidelity
`rtk git status --short` vs `00-git-status-before.txt`: only expected paths. `rtk git diff apps/web/package.json` → 4 added lines. No edits in `apps/api`, `apps/assets`, `packages/*`, `next.config.ts`, `playwright.config.ts`, `useAuthStore.ts`, `dashboard/layout.tsx`. `rtk git log -1` still `ee8e075` unless the user committed. Write `F4-scope.md`.

QA for F1-F4 — Happy: each `F*.md` exists and ends with `RESULT: PASS`. Failure: any `FAIL` row → reopen the owning todo, re-run its QA, append the re-run evidence filename to the `F*.md`; the final wave is not done until all four read `RESULT: PASS`.

## Commit strategy

The worker does **not** commit (global Git Mutation Consent Gate; user: "Jangan commit git kecuali saya minta"). Suggested grouping when the user later says "commit": (1) `chore(web)` deps + lockfile, (2) `test(web)` spec + baseline, (3) `refactor(web)` split (todos 4-8 squashed), (4) `docs`. Never stage the pre-existing dirty files.

## Success criteria

- `main` region of `/dashboard` pixel-identical (≤ `maxDiffPixelRatio` 0.01, SwiftShader, dev badge hidden) before vs after the split, proven by `apps/web/e2e/dashboard-office.e2e.ts` passing against the pre-split baseline without `--update-snapshots`; negative runs (`13`, `56`) prove the gate bites.
- No console error after that was absent before.
- `three ^0.186.1`, `@react-three/fiber ^9.8.1`, `@react-three/drei ^10.7.9` in `dependencies`, `@types/three ^0.186.0` in `devDependencies`; `bun install` clean; lock delta scoped; same major.minor resolved; baseline taken after install.
- Old monolith gone; 13 files in `components/office/`; `BUILDING_MODEL_URL` the single GLB path source.
- `bun run typecheck` (apps/web) exit 0; `biome lint` on new files shows only the 4 moved diagnostics; no formatter applied.
- HANDOFF report, guide §1/§9, `apps/web/AGENTS.md` updated.
- Evidence `00-60` + `F1-F4` under `.omo/evidence/mvp-1-foundation/`.

