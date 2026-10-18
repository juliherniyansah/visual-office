---
slug: mvp-1-foundation
status: approved
intent: clear
review_required: true
plan_path: .omo/plans/mvp-1-foundation.md
review_round_id: r2
pending-action: dual high-accuracy review round r2 of .omo/plans/mvp-1-foundation.md
decisions_approved: "user 'tulis plan lalu high review' + 'lanjutkan' => all 3 defaults accepted"
metis: { status: done, session: ses_eb8ed7350ffe7Zg4BDIO6LBQHB }
review:
  r1:
    momus: { session: ses_eb8e6ba4fffeAbsh71x1Sh3nmM, result: REJECT, blockers: [snapshot filename no project segment, Lighting props shadow-mapSize array, quote style vs format gate], majors: [lint count regex, test-results dirt + --output, 30s timeout], minors: [L54-65 split, title not name, useAuthStore:60-61, nextjs-portal mask shadow root, import lists, F3 root baseline, bun install drift] }
    independent: { session: ses_eb8e67bc7ffeFSBfpYsHjfQ9pl, result: REJECT, blockers: [B1 deps before baseline + major.minor rule, B2 drop biome format, B3 setTimeout 120s, B4 Lighting verbatim, B5 title anchor + fallback text, B6 snapshot glob], majors: [M1 screenshot main + CSS hide badge, M2 rm -rf .next/dev + typecheck after PW, M3 line refs], minors: [git status after final rerun, log SwiftShader renderer] }
    fixes_applied: all of the above incorporated into plan (rewritten; plan file had been lost from disk and was regenerated with fixes)
  r2:
    momus: { session: ses_eb8d4da28ffefLu8ktvTlw2gYg, result: APPROVE, minors: [phase decl order, import order, F QA lines] }
    independent: { session: ses_eb8d49cd6ffe4wVSMCmMVvD42k, result: REJECT, majors: [M1 deskLayout imports + noUnusedImports rule, M2 shell cwd persistence -> subshell + $R], minors: [M3 port check before rm, m1 phase decl, m2 main exists STOP, m3 file checkout wording] }
    fixes_applied: all r2 findings incorporated (Shell discipline + PW_RUN macro + Import rule in Verification strategy; todo 3/4/7/8/9/F3 updated; F QA lines added)
  r3:
    momus: { status: carried-over APPROVE from r2 (r3 edits are exactly its listed minors + oracle fixes) }
    independent: { session: ses_eb8d49cd6ffe4wVSMCmMVvD42k, result: APPROVE, nits_applied: [PW_RUN env param, EXIT suffix on every run, HANDOFF main wording] }
review_round_id: r3
status: plan-complete-reviewed
pending-action: handoff to user; execution via $start-work mvp-1-foundation
approach: Declare three/fiber/drei/@types/three in apps/web at resolved versions; capture Playwright screenshot baseline of /dashboard BEFORE refactor; split OfficeCanvas.tsx verbatim into components/office/*; re-run screenshot spec to prove identical render; append HANDOFF.
---

# Draft: mvp-1-foundation

<!-- hand-written: bash tool unavailable in this session; mirrors scaffold-plan.mjs buildDraft() so a later script run is a no-op -->

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
- C1 | deps declared: apps/web/package.json gains three ^0.186.1, @react-three/fiber ^9.8.1, @react-three/drei ^10.7.9, @types/three ^0.186.0; bun.lock updated | active | .omo/evidence/mvp-1-foundation/deps-*.txt
- C2 | monolith split: apps/web/src/components/OfficeCanvas.tsx (417 LOC) -> components/office/* verbatim; old file deleted; page.tsx import updated; BUILDING_MODEL_URL constant | active | .omo/evidence/mvp-1-foundation/split-*.txt
- C3 | visual regression harness: Playwright spec screenshots /dashboard with injected JWT, baseline captured BEFORE refactor, re-run AFTER must match | active | .omo/evidence/mvp-1-foundation/*.png
- C4 | docs: HANDOFF.md appended; guide §1/§9 + apps/web/AGENTS.md row updated to reflect new truth | active | docs/mvp/HANDOFF.md

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
- Shared constants/types/context/helpers not in user's 9-file list | add constants.ts, focusContext.ts, deskLayout.ts, Scene.tsx inside components/office/ | avoids circular imports; naming per AGENTS.md (camelCase utils, PascalCase components) | yes
- Lint gate | `bun run lint` fails repo-wide pre-existing (4071 errors, mostly biome format quote-style). Gate = `bunx biome lint` on new files shows ONLY the 4 diagnostics that moved verbatim (noExplicitAny, noStaticElementInteractions, noArrayIndexKey, useButtonType) and no new ones; no `biome format --write` | prompt: move as-is, don't fix | yes
- Quote style | keep single quotes as in rest of apps/web | repo-wide consistency; biome.json has no quoteStyle | yes
- Screenshot method | Playwright `toHaveScreenshot` in a new permanent spec apps/web/e2e/dashboard-office.e2e.ts; baseline via `--update-snapshots` BEFORE refactor | reusable regression guard; MVP-2 regenerates snapshot | yes
- Auth for /dashboard in test | inject unsigned JWT (email/role/exp) into localStorage `auth_token` via addInitScript; no API needed (layout only decodes client-side) | useAuthStore.checkAuth only checks presence+expiry | yes
- Console-error gate | spec asserts zero console errors; if BASELINE already has errors, record exact strings in HANDOFF + allowlist constant in spec | distinguishes pre-existing from new | yes
- Doc updates | guide §1 MUST NOT 7 reworded (split allowed per MVP-1, visuals unchanged until GLB approved), §9 repo facts updated, apps/web/AGENTS.md "3D office" row -> components/office/ | guide itself mandates update when user overrides | yes

## Findings (cited - path:lines)
- apps/web/package.json:13-28 — no three/fiber/drei/@types/three declared.
- apps/web/node_modules/{three,@react-three/fiber,@react-three/drei,@types/three}/package.json — versions 0.186.1 / 9.8.1 / 10.7.9 / 0.186.0 (symlinks into node_modules/.bun store).
- bun.lock:39,650 — only `three@0.186.1` (from apps/assets); NO react-three or @types/three entries -> lockfile stale vs node_modules; `bun install` will add them.
- fiber peer three >=0.156; drei peer three >=0.159 — 0.186.1 OK.
- apps/web/src/components/OfficeCanvas.tsx:1-417 — Building L131-134 (useGLTF('/models/building.glb')), FloorPlane L136-149, DeskMarkers L151-174, Agent L176-228, Scene L230-275 (lights L242-253), FloorSelector L277-323, WebGLErrorBoundary L325-369, OfficeCanvas L371-417, CameraRig L94-129, constants L27-52, types/context L54-65, DEFAULT_STATUSES L67-75, helpers L77-92.
- apps/web/src/app/dashboard/page.tsx:7 — `dynamic(() => import('@/components/OfficeCanvas'), { ssr:false })`.
- apps/web/src/app/dashboard/layout.tsx:16-23 — gate via useAuthStore.checkAuth() (client-only). apps/web/src/stores/useAuthStore.ts:20,49-57,92-107 — localStorage `auth_token`, jwt-decode exp check only.
- apps/web/playwright.config.ts — testMatch `**/*.e2e.ts`, baseURL :3100, webServer `bun run next dev -p 3100`, reuseExistingServer:false, env NEXT_PUBLIC_API_URL :4100. Playwright 1.64.0, chromium cached.
- apps/web/.env.local — NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 (dashboard page makes no API call; irrelevant).
- apps/web/e2e/landing.e2e.ts:4 — evidence pattern `.omo/evidence/<slug>`.
- Typecheck: `cd apps/web && bun run typecheck` exit 0 today. Lint: `bun run lint` exit 1, 4071 errors repo-wide (format). OfficeCanvas.tsx lint rules: L97 noExplicitAny, L194 noStaticElementInteractions, L170 noArrayIndexKey, L300 useButtonType; page.tsx L38 useButtonType.
- apps/web/AGENTS.md:13 — table row points to `src/components/OfficeCanvas.tsx`.
- Guide §1 MUST NOT 7 forbids touching OfficeCanvas.tsx; user message grants MVP-1 scope -> user wins; guide §0 says then update guide.
- Git: single worktree on main @ ee8e075; 20 modified + 33 untracked files pre-existing (dirty_worktree risk) — out of scope, never revert/commit.
- components/office/ does not exist yet. No unit tests in apps/web/src.

## Decisions (with rationale)
- Add @types/three ^0.186.0 as devDependency: three ships no types; typecheck passes today only via undeclared hoisted symlink.
- Baseline screenshot captured BEFORE any code change (TDD-style regression guard).
- Each todo moves code verbatim; the only allowed edits: import paths, `export`, BUILDING_MODEL_URL constant.

## Scope IN
- apps/web/package.json deps; `bun install` at root (bun.lock changes).
- New dir apps/web/src/components/office/ with: OfficeCanvas.tsx, Scene.tsx, Building.tsx, FloorPlane.tsx, DeskMarkers.tsx, Agent.tsx, CameraRig.tsx, FloorSelector.tsx, Lighting.tsx, WebGLErrorBoundary.tsx, constants.ts, focusContext.ts, deskLayout.ts.
- Delete apps/web/src/components/OfficeCanvas.tsx; update page.tsx import.
- New apps/web/e2e/dashboard-office.e2e.ts + snapshot baseline.
- docs/mvp/HANDOFF.md append; guide §1/§9 + apps/web/AGENTS.md minimal edits.

## Scope OUT (Must NOT have)
- No visual/behavior change (colors, positions, camera, lighting, materials, GLB path value).
- No lint/format fixes, no `biome format --write`, no other package changes, no major upgrades.
- No Blender/GLB/backend/apps/assets changes. No git commit/branch/push.
- No touching pre-existing dirty files outside scope.

## Open questions
1. Extra files beyond the 9 listed (constants.ts, focusContext.ts, deskLayout.ts, Scene.tsx)? default YES.
2. Doc updates (guide §1/§9, AGENTS.md row)? default YES minimal.
3. Keep Playwright spec + snapshot permanently in e2e/? default YES.

## Approval gate
status: awaiting-approval
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
next action: on explicit okay -> write .omo/plans/mvp-1-foundation.md (hand-built skeleton mirroring scaffold-plan.mjs headers), run metis, append todos, fill TL;DR last.
