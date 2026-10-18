# F3 — Real manual QA (mvp-1-foundation)

Reviewer: F3 (sole user of :3100 during the final wave). Date: 2026-10-17. `R=/home/programer/work/redhunter-reborn/visual-office`.

## 1. Preflight

| Check | Command | Result |
|---|---|---|
| Port free | `ss -ltnp \| /usr/bin/grep 3100` | empty (grep exit 1) |
| Snapshot untouched | `md5sum apps/web/e2e/dashboard-office.e2e.ts-snapshots/dashboard-office-linux.png` | `a273b6d34ea3689d65a817f6b125e15c` (== T3 baseline) |
| constants.ts | `grep -n FLOOR_HEIGHT …/office/constants.ts` | `3:export const FLOOR_HEIGHT = 4;`, md5 `ce9ca39a3d61692e905affbde556facf` (== T9 pre-flip/post-revert) |
| index.lock | `ls .git/index.lock` | absent |
| Cold cache | standalone `rm -rf apps/web/.next/dev` (cwd = repo root), next call `test -e …/.next/dev` | `absent OK` |

## 2. PW_RUN(final) — no `--update-snapshots`

```
(cd "$R/apps/web" && MVP1_PHASE=final bunx playwright test e2e/dashboard-office.e2e.ts --output "$R/.omo/evidence/mvp-1-foundation/pw-output") > …/F3-playwright-final.txt 2>&1; echo EXIT=$? >> …/F3-playwright-final.txt
```

- `F3-playwright-final.txt`: `✓ 1 … dashboard office canvas renders identically (14.5s)`, `1 passed (17.7s)`, `EXIT=0`. `grep -c failed` = 0.
- Only expected dev noise: next.config.ts `eslint` unrecognized-key warning; browser `THREE.Clock deprecated` and `PCFSoftShadowMap removed` (warnings, not errors).
- `11-console-final.json` = `[]`.
- `14-renderer-final.txt` = `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)` — `cmp` identical to `14-renderer-before.txt`.
- `pw-output/.last-run.json` = `{"status":"passed","failedTests":[]}`.
- After run: `ss -ltnp | grep 3100` empty. Snapshot md5 still `a273b6d3…`.

## 3. Visual inspection (read tool) — `10-dashboard-final.png` vs `10-dashboard-before.png`

Both 1280x800, dark theme. What I saw, identical in both images (no difference visible at all):
- Header: white bar "Visual Office", `e2e@redhunter.local • Admin`, Logout button top-right.
- Building: grey box with two light-blue windows, centred behind the F2 plane edge; below the plane its reflection/lower part shows the brown door between the windows.
- Floor planes: wide dark-blue F2 plane (horizon band ~y 410-520) with a darker navy plane/reflection beneath it filling the lower half.
- 7 agent capsules with labels: Chief Executive Officer (green, top-left), Chief Technology Officer (green, centre), Chief Operating Officer (grey, right), AI Development (green, left), Programming (larger green, front-centre, label box "Programming"), Game (tiny label beside the building), IoT (dark navy capsule, right).
- Desk markers: dark slab under each capsule plus small dark shadow ellipses on the plane.
- FloorSelector top-right: F1 · Lobby & Server Room, **F2 · Domain Floor highlighted** (blue fill, white 2 px border, bold), F3 · Operations, F4 · CEO Office.
- Next dev badge hidden (as the spec intends).

Verdict: final matches before.

## 4. Interaction smoke (floor switching)

Throwaway script `/tmp/opencode/f3-interact.mjs` (outside repo). It spawned its own `bun run next dev -p 3100` in `apps/web` (detached process group, env `NEXT_PUBLIC_API_URL=http://localhost:4100`, `BROWSER=none`), aborts if :3100 is already busy, launches chromium with the spec's SwiftShader args, viewport 1280x800 dark, same unsigned DUMMY_TOKEN injected into `localStorage.auth_token` via init script. Log: `F3-interact.txt`.

```
node /tmp/opencode/f3-interact.mjs > …/F3-interact.txt 2>&1; echo EXIT=$? >> …/F3-interact.txt
```

Result: `EXIT=0`, `CONSOLE_ERRORS []`. Active-button probe (button with 2 px border):
- initial: `["F2 · Domain Floor"]`
- after clicking `F4 · CEO Office` + 3 s: `["F4 · CEO Office"]`
- after clicking `F1 · Lobby & Server Room` + 3 s: `["F1 · Lobby & Server Room"]`

Cleanup: killed only its own process group (PGID 326204, SIGTERM then SIGKILL); `ps` shows no process in that group; `ss -ltnp | grep 3100` empty afterwards.

What I saw:
- `F3-floor4.png`: camera moved up to floor 4 — large brown/orange F4 plane seen from above at an angle; only the CEO capsule (green) stands on it with its desk; the other six agent labels (CTO, COO, AI Development, Game, IoT, Programming) float as small tags projected through the plane from the floors below; red (F3) and blue (F2) plane edges peek out at the lower-left. FloorSelector: **F4 · CEO Office highlighted** (brown fill, white border, bold); F2 no longer highlighted.
- `F3-floor1.png`: camera moved down to floor 1 — blue lower plane close-up, grey building with light-blue windows and roof slab in the middle, Programming (green), Game (grey), IoT (dark navy) capsules with desks and shadows, upper-floor capsules cut off at the top. FloorSelector: **F1 · Lobby & Server Room highlighted** (dark slate fill, white border, bold).

Floor switching, camera rig and highlight state work after the split.

## 5. Typecheck gates (run after the Playwright runs)

| Gate | Command | Result |
|---|---|---|
| Web | `(cd "$R/apps/web" && bun run typecheck)` → `F3-typecheck-web.txt` | `tsc --noEmit -p .`, `EXIT=0` |
| Root | `(cd "$R" && bun run --filter '*' typecheck)` → `F3-typecheck-root.txt` | `EXIT=1` == `02b-typecheck-root-before.txt` `EXIT=1` |

Root error-set comparison: `grep 'error TS' | sort` before = 13 lines, now = 13 lines, `diff` empty (exit 0). Whole-file sorted diff also empty (only workspace output order differs). All errors are pre-existing `@redhunter/api` `owner` errors (app.test.ts, env.test.ts, index.ts, seed/cli.ts, seed.test.ts). `@redhunter/web typecheck: Exited with code 0`; 0 `@redhunter/web` error lines.

## 6. Hygiene

- No edits to spec, snapshot, configs, `apps/web/src/**`, package.json, bun.lock, docs, plan. No `--update-snapshots`. No git writes.
- Temp files only in `/tmp/opencode/` (`f3-interact.mjs`, `f3-err-before.txt`, `f3-err-now.txt`). New repo files only in this evidence dir: `F3-playwright-final.txt`, `10-dashboard-final.png`, `11-console-final.json`, `14-renderer-final.txt`, `F3-interact.txt`, `F3-floor4.png`, `F3-floor1.png`, `F3-typecheck-web.txt`, `F3-typecheck-root.txt`, this file.
- `apps/web/.next/dev` regenerated by the dev servers (gitignored). `apps/web/playwright-report/` and `test-results/.last-run.json` pre-existing, not touched by this run (mtimes 2026-10-15).
- End state: snapshot md5 `a273b6d34ea3689d65a817f6b125e15c`, `constants.ts` `FLOOR_HEIGHT = 4` (md5 `ce9ca39a…`), :3100 free.

RESULT: PASS
