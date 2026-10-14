---
slug: vyron-landing-page
status: approved
intent: clear
review_required: true
plan_path: .omo/plans/vyron-landing-page.md
pending-action: none — plan complete, handed off; user runs $start-work
approved-defaults: hello@vyron.ai mailto | text wordmark | Playwright devDep | 4 agent cards + planned note | next@^16.2.11 (user decision B1; deviates master-plan Next 15 lock because Next 15.5.27 build fails with typescript ^7.0.2)
approach: Scaffold Next.js 16 App Router + Tailwind 4 inside apps/web (master-plan locks Next 15; deviation recorded above), build VYRON landing at apps/web/src/app/page.tsx with sections under apps/web/src/components/landing/**, static/CSS HQ visual (no R3F), honest mailto early-access, Playwright smoke for visual QA.
---

# Draft: vyron-landing-page

## Components (topology ledger)
<!-- id | outcome | status: active|deferred | evidence path -->
- web-scaffold | apps/web becomes a runnable Next.js 15 App Router app (dev/build/start/typecheck) with Tailwind, biome-clean | active | .omo/evidence/vyron-landing-page/task-1-scaffold.txt
- landing-route | `/` renders full VYRON landing (10 sections) | active | .omo/evidence/vyron-landing-page/task-*-section.png
- hq-visual | Hero + Showcase use static SVG/CSS isometric 4-floor HQ (F1 Lobby/AI Core, F2 domain agents, F3 COO/CTO, F4 CEO) | active | .omo/evidence/vyron-landing-page/task-4-hero.png
- early-access | "Get Early Access"/"Get in Touch" = `mailto:` link, no form, no api | active | .omo/evidence/vyron-landing-page/task-9-cta.txt
- e2e-smoke | Playwright smoke: nav anchors resolve, no console errors, no horizontal overflow at 375/768/1440 | active | .omo/evidence/vyron-landing-page/task-10-e2e.txt
- 3d-scene | R3F OfficeCanvas in hero | deferred (RH-3D-001 in master plan; no GLB assets exist) | n/a
- shadcn-ui | shadcn components | deferred (not needed for static landing; master plan adds later) | n/a

## Open assumptions (announced defaults)
<!-- assumption | adopted default | rationale | reversible? -->
- No logo asset exists | text wordmark "VYRON" (tracking-wide, silver on obsidian) in nav + footer | apps/web has no public/, no svg anywhere | yes (drop SVG in `apps/web/public/logo.svg` later)
- Early-access destination unknown | `mailto:hello@vyron.ai?subject=VYRON%20Early%20Access` placeholder constant in `apps/web/src/lib/site.ts` | spec forbids fake signup; api is Tailscale-only JWT, no public endpoint | yes (one constant)
- Styling system | Tailwind v4 (`@tailwindcss/postcss`) + CSS vars for palette | master plan locks Tailwind for apps/web; avoids second system later | yes
- Fonts | `next/font/google` Inter (body) + Geist/Inter tight for headings; no external font CDN | zero CLS, self-hosted by Next | yes
- Visual QA tool | Playwright (`@playwright/test`) devDep in apps/web, `apps/web/e2e/landing.spec.ts` | master plan already expects `apps/web/e2e`; agent-executable evidence | yes
- Agents shown | CEO/COO/CTO/Programming as "current"; Game/IoT/AI-Dev omitted from cards, mentioned once as "additional domain agents (planned)" | spec lists four; master plan has seven permanent | yes

## Findings (cited - path:lines)
- `apps/web/src/index.ts:1` — only `export const PACKAGE_NAME = '@redhunter/web';` (empty stub, no framework).
- `apps/web/package.json` — name `@redhunter/web`, type module, single script `typecheck: tsc --noEmit -p .`, zero deps. No dev/build.
- `apps/web/tsconfig.json` — extends `../../tsconfig.base.json`, lib ES2022+DOM+DOM.Iterable, include `["src"]`. Needs Next plugin + jsx preserve + `.next/types`.
- Root `package.json` — bun workspaces `apps/*`, `packages/*`; scripts typecheck `bun run --filter '*' typecheck`, lint `biome check .`, test `bun test --pass-with-no-tests`. Biome ^2.5.15, TS ^7.0.2.
- `docker-compose.yml` — only mongo:7; web not served anywhere (deploy later via `next start`, Tailscale-only per master plan).
- `.omo/plans/redhunter-master-plan.md:21,36` — apps/web stack LOCKED: Next.js 15 App Router + React 19 + R3F v9 + Drei + Tailwind + shadcn/ui + Socket.IO client + zustand. Web todos RH-WEB-001 (`apps/web/src/app/{login,(dashboard)}/**`, `src/lib/{api,socket}.ts`, `src/stores/*.ts`) and RH-3D-001 (`src/components/office/**`, `public/models/*.glb`, `public/draco`) NOT done → landing must not collide with those paths.
- `.omo/plans/redhunter-master-plan.md` office layout Option A — 4 floors: F4 CEO, F3 COO/CTO, F2 four domain agents, F1 Lobby/AI Core. Reused as showcase floor labels.
- `packages/shared/src/office-layout.ts`, `packages/shared/src/schemas/office-state.ts` — desk map constants exist; landing may import floor names from `@redhunter/shared` if exported, else hardcode copy (no runtime dep needed).
- No 3D scene, no GLB, no `assets/blender`, no logo, no images anywhere in repo.
- Repo is NOT git → commit lines in plan are advisory; `$start-work` `--make-pr`/`--ship` not applicable.

## Decisions (with rationale)
1. Framework = Next.js 15 App Router inside existing `apps/web` (not a new app, not Vite/Astro). Rationale: master plan lock; spec says reuse architecture; landing becomes the first real route and RH-WEB-001 later adds `login`/`(dashboard)` beside it.
2. File layout: `apps/web/src/app/{layout.tsx,page.tsx,globals.css}`, `apps/web/src/components/landing/{Nav,Hero,ProductIntro,OfficeShowcase,Workforce,HowItWorks,AiCore,Capabilities,Audience,FinalCta,Footer}.tsx`, `apps/web/src/components/landing/HqIllustration.tsx` (SVG), `apps/web/src/lib/site.ts` (copy constants, nav links, mailto). Delete `src/index.ts` stub (package `main` no longer meaningful; remove `main`/`types` from package.json).
3. No R3F/three/drei for landing. Hero + showcase = inline SVG isometric 4-floor HQ with CSS keyframe glow/parallax, `prefers-reduced-motion` guarded. Honest label "Concept preview". Hook: `HqIllustration` accepts `className` so RH-3D-001 can swap in `dynamic(() => import('../office/OfficeCanvas'), { ssr:false })` later.
4. Motion: CSS only + one tiny `IntersectionObserver` reveal hook (`useReveal.ts`, <40 LOC) marked `'use client'`; everything else server components. No framer-motion/gsap.
5. Early access: `mailto:` anchor; nav "Get Early Access" + final "Get in Touch" both use `SITE.contactHref`. No form, no API route, no localStorage.
6. Honesty labels: Capabilities grid marks Virtual Office / AI Agents / Tasks & Projects / Company Knowledge / Execution Monitoring as "Current", Workflow Orchestration / Human–AI Collaboration / Security & Permissions as "Vision". AI Core shows static concept diagram, no numbers. Audience section = plain list, no logos/testimonials/metrics.
7. Verification: `bun --cwd apps/web run build` + `bun run lint` + `bun run typecheck` + Playwright smoke (3 viewports, console error assert, overflow assert, anchor resolution, reduced-motion render). Screenshots saved to `.omo/evidence/vyron-landing-page/`.
8. Deps added (apps/web only): `next@15`, `react@19`, `react-dom@19`, `tailwindcss@4`, `@tailwindcss/postcss`, `postcss`, `@types/react`, `@types/react-dom`, `@playwright/test` (dev). Nothing else.

## Scope IN
- Next.js scaffold of apps/web (layout, page, globals, postcss config, next.config.ts, tsconfig update, package.json scripts dev/build/start/lint/typecheck/e2e).
- All 10 landing sections with spec copy verbatim, VYRON palette (obsidian `#0A0A0B`, graphite `#1A1B1E`, silver `#C9CCD1`, white `#F4F4F5`, red `#E32636`), thin borders, subtle glows.
- Accessible nav: semantic `<nav>`, mobile menu `<button aria-expanded>` + `<dialog>`/disclosure, smooth scroll (`scroll-behavior: smooth` + `scroll-margin-top`), active section highlight via IntersectionObserver.
- Responsive 360→1920, no horizontal overflow, no CLS (fixed aspect SVG, `next/font`).
- SEO basics: `metadata` title/description/OG, `lang="en"`, semantic headings h1→h2→h3.
- Playwright e2e smoke + evidence screenshots.
- Biome-clean; root `bun run lint` passes.

## Scope OUT (Must NOT have)
- No R3F/three.js, no GLB, no Blender pipeline.
- No shadcn/ui, no zustand, no Socket.IO client, no framer-motion/gsap, no icon library (inline SVG only).
- No login/dashboard routes, no `src/lib/api.ts`/`socket.ts`, no `src/stores`.
- No API endpoint, no form submission, no waitlist DB, no analytics, no cookies.
- No fake stats, logos, testimonials, live counters, Matrix rain, purple gradients, glassmorphism, neon, cartoon robots.
- No changes to apps/api, packages/*, root tooling beyond nothing (root lint/typecheck already cover apps/web via workspace filter).
- No Docker/deploy changes.

## Open questions
1. Contact destination for early access — confirm email (default `hello@vyron.ai`) or give real one.
2. Logo — confirm text wordmark OK (default yes) or provide SVG path.
3. Playwright devDep OK in apps/web now (default yes; ~Chromium download on first run)? Alternative: skip e2e, rely on build+lint+manual screenshots via agent browser.
4. Agent roster on landing — four cards only (default) or seven?

## Approval gate
status: approved (user: "draft approved; write plan to .omo/plans/vyron-landing-page.md then review")
plan written: todos 1-12, F1-F4, commit strategy, success criteria complete

## Review receipts
- metis gap check: bg_836fb385 (ses_edf55763dffeTBvbln73xdN5zL) — gaps folded into plan.
- momus (Plan Critic): bg_17da446b (ses_edf405fefffeRrYh7zUI8VzsZ5) — REJECT, findings M1-M15 + minors.
- oracle: bg_dc625d7f (ses_edf402f88ffe7UVWHZNGaXhueA) — REJECT, findings B1-B4; empirical: Next 15.5.27 build fails on TS 7.0.2, Next 16.4.0 builds `/` static OK.
- B1 resolved by user: `next@^16.2.11 (Recommended)`; fallback if 16 fails = STOP and report, never downgrade TS.
- Fixes applied to plan (all findings): Next 16 scaffold + deviation note; root `biome.json` allowance; gate order build→typecheck→lint; placeholder body copy constants in todo 2 (spec has headings/hero/final-CTA only); `motion-safe:` + `data-visible` reveal contract; `HqIllustration` `titleId` + fixed 800×600; e2e file renamed `landing.e2e.ts`, all tests (a)-(j) written in todo 4 behind `LANDING_READY` fixme, unguarded in todo 11; Blocked-by lists per todo; JSX-text-only metric greps; `AI_CORE_NODES` six nodes; `AUDIENCE_GROUPS`; primary CTA `href="#platform"`; F2 size exception for SVG file; F3 relies on Playwright webServer; F4 component set + `useReveal.ts`, `status: 'vision'` grep; success criteria aligned.
- Re-review: not re-run after fixes (every finding addressed by targeted same-line edits; structural check: 12 todos + F1-F4, zero stale references). User may request another momus/oracle pass before `$start-work`.
