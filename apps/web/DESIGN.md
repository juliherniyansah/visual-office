# DESIGN.md — REDHUNTER web (apps/web)

Operational internal dashboard. Layer A: `taste-skill.md` (neutral/operational, dashboards). Layer B: none — internal ops surface, no brand contract. Plan-locked stack: Next.js 15 App Router, React 19, Tailwind, shadcn-style primitives, zustand, Socket.IO client.

## 0. Research Log

- Embedded references: shortlist `taste-skill.md` (dashboards default) — picked; no brand skill fits an internal ops console. Skipped: lazyweb (no external design ambition in plan acceptance), imagen (no mockup contract; plan §18 defines the screens).
- Design authority: master plan §18/§19 (dashboards list, client stores, JWT in memory). Visual direction is "dark ops console", consistent with the cyberpunk office theme but restrained for readability.

## 1. Tokens

Dark-only ops console. All colors/spacing trace here (mirrored in `tailwind.config.ts`).

| Token | Value | Use |
|---|---|---|
| background | `#0b0d10` | page |
| surface | `#12151a` | cards/panels |
| raised | `#181c22` | inputs, table header, hover |
| border | `#232830` | all borders, 1px |
| fg | `#e6e9ee` | primary text |
| muted | `#8b94a3` | labels, timestamps, empty states |
| accent | `#4f8cff` | links, primary button, active states |
| ok / warn / danger | `#34c07c` / `#e0a63e` / `#e5534b` | status pills (succeeded / in-progress / failed-blocked) |

Type: system-ui/Inter sans; ui-monospace mono for run console + ids. Scale: xs 12 (labels/meta), sm 14 (body), base 16 (headings in cards), xl 24 (page title).

Spacing: base-4 scale; rows 32px; card padding 16px; page gutter 24px.

## 2. Primitives

Minimal in-house shadcn-style set (no radix needed for v0): `Button` (primary/ghost), `Input`, `Card`, `Badge` (status pill with ok/warn/danger/muted variants), `Textarea`. No emojis; no icon library in v0 (text-only affordances).

## 3. Layout

- `/login`: centered card (max-w-sm), email + password, submit.
- `/` (dashboard): header bar (title + user + logout), main grid: left column Directives board (list + "New directive" form), right column Run console (run selector + live event log). Responsive: single column < 768px.

## 4. Motion

None in v0 beyond `transition-colors` on interactive states (150ms). No decorative animation (slop rule).

## 5. Accessibility

- Color is never the only status signal: status pills carry text (`queued`, `succeeded`, …).
- Form fields have associated `<label>`; buttons are real `<button>`; focus-visible ring via accent outline.
- Contrast: fg on surface ≥ 12:1; muted on surface ≥ 4.6:1.

## 6. Accepted debt

- No shadcn CLI/component install; hand-rolled equivalents until a component needs radix behavior (dialogs, dropdowns).
- No icon set (Lucide) until an icon is actually required.
- Run console shows raw event log, not a styled timeline (todo 18+ polish).
- No `framer-motion`; static transitions only.

## 7. Reference fidelity

N/A — no external visual reference. Contract = this file + plan §18 acceptance.
