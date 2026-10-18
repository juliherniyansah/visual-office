# F1 — Plan compliance audit (mvp-1-foundation)

Auditor: independent F1 reviewer (read-only on product/config/docs). Date: 2026-10-17.
Method: re-read the Acceptance criteria + QA scenarios of todos 1-10 (plan L66-360) and re-ran the checks against the live filesystem and `.omo/evidence/mvp-1-foundation/`. Count checks use `/usr/bin/grep` (rtk rewrites chained grep). The monolith reference is `git show HEAD:apps/web/src/components/OfficeCanvas.tsx` (417 lines, md5 `de47fea8e9d0870083eb7a8ddced84c1`, identical to the pre-delete md5 in `40-t8-checks.txt`). All per-block diffs below were re-run by the auditor against that copy, not copied from worker evidence. No Playwright, no `next dev`, no :3100 use.

| Todo | Criterion | PASS/FAIL | Evidence file or command output |
|---|---|---|---|
| 1 | Files `00, 00b, 01, 01b, 02, 02b, 03` exist (non-empty) | PASS | `test -s` on each → all OK |
| 1 | `02-typecheck-before.txt` EXIT=0 | PASS | last line `EXIT=0` |
| 1 | `grep -cE '^apps/.*lint/' 03-biome-lint-before.txt` = 5 | PASS | `5` (L97 noExplicitAny, page L38 useButtonType, L194 noStaticElementInteractions, L170 noArrayIndexKey, L300 useButtonType) |
| 1 | QA: evidence dir has ≥ 7 files | PASS | 58+ entries |
| 1 | QA: `grep -c '417' 01-resolved-versions.txt` = 1 | PASS | `1` (`417 src/components/OfficeCanvas.tsx`); versions `0.186.1 9.8.1 10.7.9 0.186.0` |
| 1 | `02b` captured (whatever exit) for F3 comparison | PASS | `02b-typecheck-root-before.txt` ends `EXIT=1` (pre-existing apps/api `owner` errors, documented) |
| 2 | `git diff apps/web/package.json` → exactly 4 `+` lines, 0 removed | PASS | `git diff --numstat` → `4 0`; adds drei, fiber, three (deps) + @types/three (devDeps) |
| 2 | QA: declared ranges | PASS | node check → `^0.186.1 ^9.8.1 ^10.7.9 ^0.186.0` |
| 2 | `20-bun-install.txt` EXIT=0 | PASS | `6 packages installed` / `EXIT=0` |
| 2 | `23` same major.minor as `01` for all 4 | PASS | `three 0.186.1`, `fiber 9.8.2`, `drei 10.7.9`, `@types/three 0.186.0`; fiber patch drift 9.8.1→9.8.2 allowed and recorded in HANDOFF; live `node_modules` re-check gives the same 4 versions |
| 2 | `24-typecheck-after-deps.txt` EXIT=0 | PASS | `EXIT=0` |
| 2 | `22` has no forbidden `-` line | PASS | `/usr/bin/grep -E '^-.*"(next\|react\|…\|jwt-decode)@' 22-lock-diff-lines.txt` → exit 1; `grep -c '^-'` = 0 |
| 2 | Lock delta scoped (additions only) | PASS | `21-lock-diff-stat.txt` and live `git diff --numstat bun.lock` → `108 0` |
| 3 | Spec `apps/web/e2e/dashboard-office.e2e.ts` exists | PASS | file present, 82 lines |
| 3 | `bunx biome lint` on spec → 0 diagnostics | PASS | auditor re-run: `Checked 1 file … No fixes applied.` EXIT=0; also `15-biome-lint-spec.txt` |
| 3 | Snapshot `dashboard-office*.png` exists, > 20 KB | PASS | only file `dashboard-office-linux.png`, 29439 B, md5 `a273b6d34ea3689d65a817f6b125e15c` |
| 3 | Snapshot not a solid frame (building, floor planes, agent labels, FloorSelector) | PASS | auditor opened it with `read`: building, 2 floor planes, desk markers, agent capsules + title labels, FloorSelector F1-F4 top-right (F2 active) |
| 3 | `12-playwright-before.txt` EXIT=0 | PASS | `writing actual` (baseline creation) + `1 passed` + `EXIT=0` |
| 3 | `12b` EXIT=0 + `1 passed` | PASS | `1 passed (17.4s)` / `EXIT=0`, no `writing actual` |
| 3 | `13` EXIT≠0, `1 failed`, mentions `toHaveScreenshot` | PASS | `1 failed`=1, `toHaveScreenshot`=3, ratio 0.97, `EXIT=1` |
| 3 | `10-dashboard-before.png`, `11-console-before.json`, `14-renderer-before.txt` present | PASS | 36418 B / `[]` / 92 B |
| 3 | Renderer contains SwiftShader | PASS | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` |
| 3 | Spec: imports in `landing.e2e.ts` style + `setTimeout(120_000)` | PASS | L1-3 `@playwright/test`, `node:fs`, `node:path` default imports; L5 `test.setTimeout(120_000)` |
| 3 | Spec: constants `AGENT_TITLE_ANCHOR`, `WEBGL_FALLBACK_TEXT`, `ALLOWLIST: string[] = []`, unsigned `DUMMY_TOKEN` (alg none, fixed email/role, exp +3600, base64url, empty sig) | PASS | L9-19 |
| 3 | Spec: `EVIDENCE_DIR` path | PASS (documented deviation) | L8 uses `'../../../.omo/evidence/mvp-1-foundation'`; plan's `../../` resolves to `apps/.omo/` (plan bug). Recorded in HANDOFF "Deviasi (a)" and `issues.md` T3; failed first attempt kept as `12-playwright-before-attempt1-pathbug.txt` |
| 3 | Spec: top-level `test.use` (viewport 1280x800, DSF 1, dark, 4 SwiftShader args) | PASS | L21-28 |
| 3 | Spec: `beforeEach` `addInitScript` sets `auth_token` | PASS | L30-33 |
| 3 | Spec steps 1-2: console/pageerror collection, GLB `waitForResponse` (60 s) before goto, canvas visible 60 s | PASS | L36-49 |
| 3 | Spec step 3: fallback text count 0, renderer capture → `14-renderer-${phase}.txt` | PASS | L51-60 |
| 3 | Spec steps 4-7: anchor text visible 30 s, `waitForTimeout(3000)`, `nextjs-portal{display:none!important}`, full-page evidence screenshot | PASS | L62-70 |
| 3 | Spec step 10 + 8: `PW_NEG` invert hook right before `toHaveScreenshot` on `main`, `maxDiffPixelRatio: 0.01`, `animations: 'disabled'` | PASS | L73, L75-78 |
| 3 | Spec step 9: console JSON written + ALLOWLIST filter assertion | PASS | L80-81 |
| 4 | 3 support files exist | PASS | `constants.ts`, `focusContext.ts`, `deskLayout.ts` |
| 4 | Typecheck EXIT=0 (old + new side by side) | PASS | `30b-typecheck-t4.txt` EXIT=0 |
| 4 | `30-diff-support.txt` shows only `export` insertions | PASS | worker file + auditor re-diff vs HEAD monolith (L27-52, 54, 67-75, 55-65, 77-92): every `>` line = original + `export ` prefix |
| 4 | Biome lint on office dir (at T4) = 0 | PASS | `30-lint-t4.txt` `Checked 3 files`, `LINT_EXIT=0` |
| 4 | QA: `grep -n 'FLOOR_HEIGHT = 4' constants.ts` → 1 | PASS | `3:export const FLOOR_HEIGHT = 4;` |
| 4 | QA: `grep -c createContext focusContext.ts` ≥ 1 | PASS | `2` |
| 4 | QA failure: `createContext\|FocusTarget` in constants.ts/deskLayout.ts → empty | PASS | grep exit 1 |
| 4 | `'use client'` only on focusContext.ts | PASS | constants.ts/deskLayout.ts L1 are imports; focusContext.ts L1 `'use client';` |
| 5 | `BUILDING_MODEL_URL = '/models/building.glb'` in Building.tsx → 1 | PASS | `5:export const BUILDING_MODEL_URL = '/models/building.glb';` |
| 5 | `grep -c 'building.glb' Building.tsx` = 1 | PASS | `1` |
| 5 | `grep -n 'useGLTF(BUILDING_MODEL_URL)'` → 1 | PASS | `8:  const { scene } = useGLTF(BUILDING_MODEL_URL);` |
| 5 | QA failure: quoted GLB literal outside the const line → empty | PASS | pipe exit 1 |
| 5 | Typecheck EXIT=0 | PASS | `31b-typecheck-t5.txt` EXIT=0 |
| 5 | Lint on 3 files → only `noArrayIndexKey` | PASS | `31-lint-wave2a.txt` strict count `1` (DeskMarkers.tsx:28:24) |
| 5 | `31` clean (only export / `BUILDING_MODEL_URL` substitution) | PASS | worker file + auditor re-diff: Building L131-134, FloorPlane L136-149, DeskMarkers L151-174 → only those deltas |
| 6 | 5 files exist | PASS | Agent, CameraRig, FloorSelector, WebGLErrorBoundary, Lighting |
| 6 | Typecheck EXIT=0 | PASS | `32b-typecheck-t6.txt` EXIT=0 |
| 6 | Lint → exactly 3 listed | PASS | `32-lint-wave2b.txt` strict count `3`: CameraRig noExplicitAny, Agent noStaticElementInteractions, FloorSelector useButtonType |
| 6 | `grep -cF "'[OfficeCanvas] WebGL error:'" WebGLErrorBoundary.tsx` = 1 | PASS | `1` |
| 6 | `32` only export/import/fragment-wrapper deltas | PASS | worker file + auditor re-diff (Agent L176-228, CameraRig L94-129, FloorSelector L277-323, WebGLErrorBoundary L325-369): only `export`; Lighting L242-253 vs Lighting.tsx L6-17 → identical (exit 0) |
| 6 | QA: Lighting `shadow-mapSize={[2048, 2048]}` / `intensity={0.4}` / `intensity={1.5}` each = 1 | PASS | `1 / 1 / 1` |
| 6 | QA failure: no `type="button"` in FloorSelector.tsx | PASS | grep exit 1 |
| 7 | Exactly 13 files in `components/office/`, names match plan L15 | PASS | Agent, Building, CameraRig, DeskMarkers, FloorPlane, FloorSelector, Lighting, OfficeCanvas, Scene, WebGLErrorBoundary (.tsx) + constants, deskLayout, focusContext (.ts); no `index.*` barrel |
| 7 | Typecheck EXIT=0 | PASS | `33b-typecheck-t7.txt` EXIT=0; auditor live `bun run typecheck` (apps/web) EXIT=0 |
| 7 | Lint on office dir exactly 4 | PASS | `33-lint-wave3.txt` = 4; auditor live re-run `Checked 13 files`, strict count 4 |
| 7 | Cycle grep empty | PASS | grep over `*.ts` + 8 leaf `.tsx` → exit 1; only importer of `./Scene` is `office/OfficeCanvas.tsx` |
| 7 | LOC sum in `34` within ±80 of 417 | PASS | `478 total` (+61); live `wc -l` also 478 |
| 7 | QA: `'#0a0a0a'` and `ACESFilmicToneMapping` in office/OfficeCanvas.tsx | PASS | L48 `gl.setClearColor('#0a0a0a')`, L44 `toneMapping: THREE.ACESFilmicToneMapping` |
| 7 | QA: `<Lighting />` line < `<Building />` line in Scene.tsx | PASS | 33 < 35 |
| 7 | QA failure: no `ambientLight\|directionalLight` in Scene.tsx / office/OfficeCanvas.tsx | PASS | grep exit 1 |
| 7 | Scene/root bodies moved verbatim | PASS | auditor re-diff: Scene vs L230-275 → only `export` + light pair → `<Lighting />`; root tail-47 vs L371-417 → identical (exit 0). `33-diff-wave3.txt` first block's extra blank-line delta was a bad range, superseded by its final `IDENTICAL` block (known) |
| 8 | `test ! -f apps/web/src/components/OfficeCanvas.tsx` | PASS | absent; git shows ` D` (unstaged, not `git rm`) |
| 8 | `grep -rn 'building.glb' apps/web/src` → exactly 1 hit (office/Building.tsx) | PASS | 1 hit, Building.tsx:5 |
| 8 | `grep -cE '^apps/.*lint/' 41-biome-lint-after.txt` = 5 | PASS | `5` (4 office + page.tsx:38) |
| 8 | QA: `office/OfficeCanvas` on the `dynamic(` line; `ssr: false` present | PASS | page.tsx L7 / L8; `git diff --numstat` page.tsx → `1 1`, only the import line |
| 8 | QA failure: no stale `@/components/OfficeCanvas` refs in apps/web/src, apps/web/e2e | PASS | both greps exit 1 |
| 8 | page.tsx:38 button untouched | PASS | HEAD vs working L38-48 diff → empty |
| 9 | `50` concurrent-session guard matches `00b` for stores/layout/lib | PASS | `api.ts 34`, `useAuthStore.ts 3` in both; live re-run identical |
| 9 | `51` EXIT=0, `1 passed`, 0 `failed`, no baseline rewrite | PASS | `1 passed`=1, `failed`=0, `writing actual`=0, `EXIT=0`; `11-console-after.json` exists, which the spec only writes after `toHaveScreenshot` passed |
| 9 | `57` EXIT=0, `1 passed`, 0 `failed` | PASS | same counts. Note: `57` is byte-identical to `51` (md5 `4cb03d61…`, both 14.5 s / 17.7 s), but a separate after2 run is corroborated by distinct mtimes (09:40:57 vs 09:42:40) and its own `14-renderer-after2.txt`, `10-dashboard-after2.png` (different md5) and `11-console-after2.json` (`[]`, only written after the screenshot assertion passes) |
| 9 | `56` `1 failed` on `toHaveScreenshot` | PASS | `1 failed`=1, `toHaveScreenshot`=3, 22234 px ratio 0.03, `EXIT=1`; no `11-console-neg2.json` (consistent with failing at the screenshot) |
| 9 | `10-dashboard-after.png`, `11-console-after.json` (== before), `14-renderer-after.txt` present | PASS | 36439 B / `[]` (before `[]`) / `cmp` identical to before |
| 9 | `52-typecheck-final.txt` EXIT=0 | PASS | `EXIT=0` |
| 9 | `53` lint count 5 | PASS | strict count `5`, `Checked 15 files` (office + spec + page) |
| 9 | `55` vs `00` diff clean (expected paths only) | PASS | new non-`.omo/` lines: `apps/web/package.json`, `dashboard/page.tsx`, `D components/OfficeCanvas.tsx`, `bun.lock`, spec, snapshots dir, `components/office/`; other new lines are `.omo/start-work/ledger.jsonl` + 20 `.omo/run-continuation/*` (tooling, `.omo/` allowance); 0 removed lines |
| 9 | Snapshot md5 unchanged; `FLOOR_HEIGHT = 4` restored | PASS | md5 `a273b6d34ea3689d65a817f6b125e15c`; `constants.ts:3 FLOOR_HEIGHT = 4`, md5 `ce9ca39a…` = pre-flip md5 in learnings T9 |
| 10 | `grep -n '## MVP-1' docs/mvp/HANDOFF.md` → 1 | PASS | `18:## MVP-1 — Fondasi Web 3D Rapi (2026-10-17)` |
| 10 | `grep -c BUILDING_MODEL_URL HANDOFF.md` ≥ 1 | PASS | `3` |
| 10 | `grep -n 'office/' apps/web/AGENTS.md` → 1 | PASS | L13 `src/components/office/` / root `OfficeCanvas.tsx` + split 3D components |
| 10 | Guide §1 MUST NOT 7 mentions `components/office/` | PASS | guide L61; §9 facts updated (L286-287) |
| 10 | `60` lists exactly 3 files | PASS | `3 files changed` (HANDOFF +43 -0, guide +3 -3, AGENTS.md +1 -1); auditor diff vs `60-orig/*` gives the same counts |
| 10 | QA failure: no `src/components/OfficeCanvas.tsx` in apps/web/AGENTS.md | PASS | grep exit 1 |
| 10 | HANDOFF fields: versions before/after + drift, lock delta | PASS | HANDOFF L20 |
| 10 | HANDOFF fields: file table + LOC, `BUILDING_MODEL_URL` location | PASS | 13-row table (sum 478); `Building.tsx:5` (verified live) |
| 10 | HANDOFF fields: screenshot paths, exact Playwright command, locator `main`, `maxDiffPixelRatio`, waits, renderer | PASS | before/after png + snapshot path; command with `--output`; `main`, 0.01, 3000 ms, SwiftShader string |
| 10 | HANDOFF fields: ALLOWLIST, 5 biome diagnostics file:line, lint-not-format note | PASS | "kosong"; 5 locations match `53` exactly; `bun run lint` exit 1 + `biome format` deliberately not run |
| 10 | HANDOFF fields: PW_NEG hook kept, tooling-rewritten files, guide §1 MUST NOT 7 override | PASS | all three present in "Keterbatasan" |
| Plan | Todos 1-10 ticked `- [x]`, F1-F4 `- [ ]` | PASS | `/usr/bin/grep -nE '^- \[(x\| )\]'` → L68-337 `[x]` (10), L364-373 `[ ]` (4) |
| Scope | Must-NOT spot checks: no `useGLTF.preload`/`frameloop`/`dpr`/`occlude`/barrel; `'use client'` on every `.tsx` + focusContext.ts; protected files untouched | PASS | grep only hits `textAlign: 'left' as const` in FloorSelector.tsx:43, which is verbatim from monolith L314 (not added); `next.config.ts`, `playwright.config.ts`, `dashboard/layout.tsx`, `apps/assets` no diff; `packages/shared/src/index.ts` diff pre-existing in `00` |

## Observations (not F1 failures; for F4 and the orchestrator)

1. HEAD moved after `55` was captured. `git log`: `ee8e075` → `681a7e1` (09:50:17, "docs: kunci visi MVP-0 di guide Redhunter HQ", adds `docs/mvp/HANDOFF.md`, `docs/redhunter-hq-brainstorming-guided.{md,html}`) → `2c8041a` (09:51:29, "docs: tambah prompt pack MVP-0..5", adds the other `docs/mvp/*.md` + `docs/redhunter-hq-step-prompts.md`). Author identity is `Juliherniyansah <juliherniyansah@redhunter.dev>`. Both commits came after T10 (docs written 09:46). `681a7e1` therefore contains the MVP-1 HANDOFF section and the updated guide §1/§9 (`git diff HEAD -- docs/mvp/HANDOFF.md docs/redhunter-hq-brainstorming-guided.md` is empty). No notepad or ledger entry claims an MVP-1 worker committed, and no product/code file was committed, so this reads as a user/other-session commit. F4's "`git log -1` still `ee8e075` unless the user committed" check must confirm with the user. HANDOFF line "Tidak ada commit" now only holds for the MVP-1 worker.
2. Because of (1), live `git status` no longer lists `docs/mvp/`, `docs/redhunter-hq-brainstorming-guided.*` and `docs/redhunter-hq-step-prompts.md` as untracked. Every other non-`.omo/` line still matches `55` exactly.
3. `docs/redhunter-hq-brainstorming-guided.html` still has the old §1/§9 text (documented in HANDOFF Keterbatasan). The plan only asks for the `.md`, so this is not a FAIL.
4. `10-dashboard-final.png` / `14-renderer-final.txt` / `11-console-final.json` (09:49) showed up during this audit: they come from the parallel F3 run, not from T1-T10.

RESULT: PASS
