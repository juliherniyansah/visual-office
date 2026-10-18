
## todo1
```
rows13-17: 5
§4.1 Atmosfer: 1
§8.4 Game Feel: 1
baseline lines: 12
| 17 |: 1
| 18 |: 0
TBD: 4
total lines: 325
```

## todo2

Inserted §8.4 Game Feel at docs lines 252-263 (after §8.3 bullet, before ---/## 9 now line 266).

```
$ grep -n "### 8.4 Game Feel"
252:### 8.4 Game Feel (MVP-0, terkunci)
$ grep -n "^## 9\."
266:## 9. Fakta Lingkungan (hasil audit)
s84 | grep -c 'waiting_permission': 1
s84 | grep -c 'ROOM_lobby': 1
s84 | grep -c 'NAV_wp_': 1
s84 | grep -c 'Cinematic intro': 1
s84 | grep -c '1.05': 1
s84 | grep -c 'MUST NOT 6': 2
6 statuses: 6
meeting backtick: 0
ROOM_lounge: 0
api/schema: 0
TBD total: 4
table byte-match plan: identical
```

## todo3
```
s51 TBD: 0
file TBD: 1
37:Tingkat aturan: **MUST** = wajib, **MUST NOT** = dilarang, **SHOULD** = default kecuali ada alasan, **TBD** = belum diputuskan — tanya user, jangan mengarang.
face_blink: 1
≤ 8.000 tris: 1
celebrate: 1
0.25 m: 1
≤ 200 tris: 1
parts sederhana: 1
untuk rigging: 1
Humanoid low-poly: 1
rows: 10
**TBD** —: 0
3:| Atribut | Nilai |
5:| Bentuk | Humanoid low-poly, proporsi
6:| Tinggi | 1.7 m (skala real, konsiste
7:| Staff vs AI agent | Bentuk & rig SAM
8:| Wajah | Ekspresif: mata + mulut term
9:| Animasi wajib | `idle`, `walk`, `sit
10:| Polycount | ≤ 8.000 tris per kara
11:| Pose dasar | T-pose atau A-pose (un
12:| Pembeda antar agent | Warna aksen +
13:| Generator | Meshy (utama), procedur
```
## todo4
```
h3: 138:### 4.1 Atmosfer (MVP-0, terkunci)
h2-5: 154:## 5. Karakter
#F4EFE6: 1
#4DB6AC: 1
#1A237E: 1
PCFSoft: 1
HemisphereLight: 1
80×80 m: 1
4.1 Atmosfer count: 2
README ref: 1
^## 4.1: 0
badge AI: 0
TBD: 1
diff:
(empty, exit 0)
```

## todo7
Date (time tool, Asia/Jakarta): 2026-10-17
- grep -c "## MVP-0" = 1
- head -1 = `# Redhunter HQ — MVP Handoff Log`
- grep -c AGENT_STATUSES = 1 ; grep -c NAV_wp_lobby = 1
- QA happy: grep -c "MVP-4 (P3)" = 1
- QA failure: wajib in MVP-0 section = 0 ; grep -c ROOM_lounge = 0
- diff plan 176-178 (4-space trimmed) vs appended bullets: empty
- `-->` at line 11, `## MVP-0` at line 13 (outside comment); file ends with single \n; 16 lines total
## todo5
class="tbd": 1
4.1 Atmosfer: 2
8.4 Game Feel: 2
#F4EFE6: 2
#1A237E: 1
face_blink: 1
waiting_permission: 1
HemisphereLight: 2
<h3>4.1 Atmosfer: 1
<h3>8.4 Game Feel: 1
parts sederhana: 1
untuk rigging: 1
ROOM_lounge: 0
Status: Brainstorming: 1
td13-17: 5
TBD</span> —: 0
5.1 tbd: 0
rows 4.1: 7
rows 5.1: 9
rows 8.4: 5
rows 11: 17
tail: </html>
balance: {'table': (13, 13), 'tr': (126, 126), 'td': (283, 283), 'th': (31, 31), 'ul': (9, 9), 'ol': (3, 3), 'li': (61, 61), 'h2': (12, 12), 'h3': (19, 19), 'p': (14, 14), 'code': (144, 144), 'strong': (45, 45), 'div': (3, 3)} ALL_BALANCED

## todo6

Sync check .md <-> .html, 20 discriminative values (grep -cF counts, md | html):

| value | md | html |
|---|---|---|
| #F4EFE6 | 2 | 2 |
| #FFF8F0 | 2 | 2 |
| #D9D4CB | 2 | 2 |
| #FFB74D | 2 | 2 |
| #4DB6AC | 2 | 2 |
| #E53935 | 3 | 3 |
| #BFE3F7 | 1 | 1 |
| #1A237E | 1 | 1 |
| 8.000 tris | 1 | 1 |
| 0.25 m | 2 | 2 |
| ≤ 200 tris | 1 | 1 |
| PCFSoft | 1 | 1 |
| HemisphereLight | 2 | 2 |
| 2048 | 2 | 2 |
| celebrate | 3 | 3 |
| face_blink | 1 | 1 |
| 0.6 s | 1 | 1 |
| 1.05 | 1 | 1 |
| NAV_wp_ | 1 | 1 |
| waiting_permission | 1 | 1 |

Data row counts (md | html):
- §5.1: 9 | 9 (expected 9) PASS
- §4.1: 7 | 7 (expected 7) PASS
- §8.4: 5 | 5 (expected 5) PASS
- §11: 17 | 17 (expected 17) PASS

Content equivalence (html tags/entities stripped, md backticks/** stripped, whitespace collapsed, row-by-row cell compare):
- §5.1: 9 rows, 0 mismatches. Row order matches md (Pose dasar below Polycount). PASS
- §4.1: 7 rows, 0 mismatches. PASS
- §8.4: 5 rows, 0 mismatches. PASS

Verdict: PASS. No zero counts, no row-count diffs, no content mismatches. No fixes applied.

## F4 — Scope fidelity (independent reviewer)

### (a) sha256sum -c baseline | grep -v ': OK$'
```
docs/mvp/HANDOFF.md: FAILED
docs/redhunter-hq-brainstorming-guided.html: FAILED
docs/redhunter-hq-brainstorming-guided.md: FAILED
```
Exactly 3 FAILED lines = the 3 in-scope docs. Full check (12 lines): architecture.md OK, MVP-0..5-*.md OK, README.md OK, step-prompts.md OK — all 9 out-of-scope docs untouched.

### (b) files-after vs baseline paths
Verified column slice first: hash field length = 64, separator = 2 spaces, path starts at col 67 → `cut -c67-` correct.
```
diff <(cut -c67- baseline.sha256 | sort) files-after.txt
→ (empty), diff_exit=0
```
No files added/removed in docs/ (12 files both sides). after.sha256 saved (12 lines). files-after.txt saved.

### (c) git status --porcelain outside docs/ (INFORMATIONAL ONLY — other sessions, NOT reject criteria)
Outside docs/ and outside this plan's allowed .omo paths (.omo/notepads/mvp-0-vision/, .omo/start-work/, .omo/plans/mvp-0-vision.md, .omo/boulder.json, .omo/run-continuation/):
```
 M apps/api/package.json
 M apps/api/src/auth/credentials.ts
 M apps/api/src/config/env.ts
 M apps/api/src/http/response.ts
 M apps/api/src/index.ts
 M apps/api/src/routes/auth.ts
 M apps/api/src/seed/cli.ts
 M apps/api/src/seed/index.ts
 M apps/web/next-env.d.ts
 M apps/web/package.json
 M apps/web/src/app/login/page.tsx
 M apps/web/src/app/page.tsx
 M apps/web/src/components/landing/Nav.tsx
 M apps/web/src/lib/api.ts
 M apps/web/src/stores/useAuthStore.ts
 M apps/web/test-results/.last-run.json
 M bun.lock
 M package.json
 M packages/shared/src/index.ts
?? .omo/drafts/mvp-0-vision.md
?? .omo/drafts/mvp-1-foundation.md
?? .omo/evidence/mvp-1-foundation/
?? .omo/notepads/initial-setup/
?? .omo/notepads/mvp-1-foundation/
?? .omo/plans/initial-setup.md
?? .omo/plans/mvp-1-foundation.md
?? apps/.omo/evidence/vyron-setup-flow/
?? apps/api/AGENTS.md
?? apps/api/scripts/
?? apps/api/src/routes/setup.test.ts
?? apps/web/AGENTS.md
?? apps/web/e2e/dashboard-office.e2e.ts
?? apps/web/e2e/dashboard-office.e2e.ts-snapshots/
?? apps/web/e2e/setup-global-setup.ts
?? apps/web/e2e/setup.spec.ts
?? apps/web/playwright-report/
?? apps/web/playwright.setup.config.ts
?? apps/web/src/app/setup/
?? packages/adapters/AGENTS.md
?? packages/agent-runtime/AGENTS.md
?? packages/shared/src/password.ts
```
None of these paths reference mvp-0 docs work — they belong to mvp-1-foundation/initial-setup/other sessions.

### Extra checks
- No git write: `git log -1 --format=%H` = ee8e075e3aea24d465f4409fb7db036fb82755a3 (matches expected). `git stash list | wc -l` = 0. `git branch --show-current` = main.
- `git diff --stat -- package.json bun.lock` (informational, other session): bun.lock +108, package.json +3/-1.

### F4 verdict: APPROVE

## F3 — Real QA sinkronisasi (.md ↔ .html) + browser render

### Table data-row counts (md | html)
| Section | md rows | html rows | match |
|---|---|---|---|
| §0 tabel | 13 | 13 | ✅ (11 lama + §4.1 + §8.4) |
| §4.1 Atmosfer | 7 | 7 | ✅ |
| §5.1 Preferensi | 9 | 9 | ✅ |
| §8.4 Game Feel | 5 | 5 | ✅ |
| §11 Changelog | 17 | 17 | ✅ (#1–#17) |

(md counts: `grep -c '^| '` minus header; html: `grep -c '<tr><td>'` per section range)

### String counts
| Check | md | html | expected | pass |
|---|---|---|---|---|
| `TBD` | 1 | — | 1 (hanya definisi §0) | ✅ |
| `class="tbd"` | — | 1 | 1 | ✅ |
| `parts sederhana` | 1 | 1 | 1 di kedua | ✅ |
| `untuk rigging` | 1 | 1 | 1 di kedua | ✅ |
| `Status: Brainstorming` (hero badge) | — | 1 | 1, unchanged | ✅ |
| `tail -1` html | — | `</html>` | `</html>` | ✅ |

### HTML escaping
- raw `<id>` / `<room_id>` in html source: 0 / 0 ✅
- `&lt;id&gt;` = 6, `&lt;room_id&gt;` = 1 ✅
- bare ` & ` outside `&amp;`: none ✅; double-escape `&amp;lt`: 0 ✅

### Real browser render (PERFORMED)
- Tool: Playwright chromium headless, `file://` URL, viewport 1280×900.
- Screenshot: `.omo/notepads/mvp-0-vision/f3-html.png` (full page) — viewed by reviewer: dark theme intact, hero + badge, semua tabel ter-render, §4.1/§8.4 terlihat.
- DOM checks: h3 "4.1 Atmosfer (MVP-0, terkunci)" ✅, h3 "8.4 Game Feel (MVP-0, terkunci)" ✅, total `<table>` = 13, rendered text contains `CHAR_FACE_<id>` & `NAV_wp_<room_id>` (placeholders display correctly), no literal `&lt;`/`&amp;` artefacts in body text ✅.
- Console errors / pageerrors: 0 ✅.

### Cleanup receipt
- Started: 1 headless chromium via Playwright script `/tmp/opencode/f3qa/render.mjs`.
- Closed: `browser.close()` in script; verified post-run `pgrep -af "chromium.*headless"` → no headless chromium left.
- Temp dir `/tmp/opencode/f3qa` removed. Only artifact kept: `f3-html.png`.

### F3 verdict: APPROVE

## F2 — Doc quality review (§4.1, §5.1, §8.4)

| Check | Result | Evidence |
|---|---|---|
| Forbidden words (mungkin/sebaiknya/TBD/kira-kira/nanti) in §4.1/§5.1/§8.4 | PASS (0 hits) | `s41/s51/s84 \| grep -niE 'mungkin\|sebaiknya\|TBD\|kira-kira\|nanti'` → empty, exit 1 |
| `TBD` whole .md | PASS | only l.37 §0 definition (by design) |
| Every table cell concrete (hex/number/identifier) | PASS | all hex `#RRGGBB` 6-digit uppercase (21 unique, 0 malformed); numbers: 1.7 m, 8.000 tris, 0.25 m, ≤200 tris, 2048², -0.0005, 80×80 m, 06–10/10–16/16–19/19–06, 0.35, 1.05, 180 ms, 0.6 s, 20–60 s |
| Identifiers in backticks, English | PASS | `CHAR_BASE`, `CHAR_TOP_*`, `CHAR_FACE_<id>`, `TASK_desk_<id>`, `ROOM_lobby`, `ROOM_meeting_a`, `NAV_wp_<room_id>`, `AGENT_STATUSES`, `HemisphereLight`, `DirectionalLight`, `PCFSoft`, `persist`, clip names, shape keys `face_blink`/`face_smile`/`face_talk` all backticked in §4.1/§5.1/§8.4; no Indonesian identifiers |
| 6 status names match `AGENT_STATUSES` (packages/shared/src/enums.ts l.16–23) | PASS | enum real: `idle`, `thinking`, `working`, `blocked`, `waiting_permission`, `offline`; §8.4 uses exactly these 6 (sorted-unique grep = 6); `meeting` as status = 0 |
| Clip consistency §5.1 (7 clips) vs §8.4 usage | PASS | §5.1: idle,walk,sit,type,wave,talk,celebrate; §8.4 uses idle,walk,sit,type,talk,celebrate — all ∈ §5.1 (wave unused in §8.4, OK) |
| Tris arithmetic | PASS | 8.000 × 10 agents = 80k ✓ |
| Day-night 24h coverage | PASS | 06–10,10–16,16–19,19–06 — no gap/overlap (shared boundaries) |
| No contradiction §1 MUST NOT 6 / §4 flat-shaded | PASS | §8.4 explicitly cites "MUST NOT menambah status di luar enum backend (§1 MUST NOT 6)"; ambient bubble labeled non-status/non-demo; §4.1 vibe row says "tetap §4 flat-shaded" |
| Table format (pipes, separators, blank lines, ### level) | PASS | separators `\|---\|` intact (l.141,159,272); blank line before tables (l.139,270); headings l.138/156/269 all `###`; §4.1 table 7 data rows, §5.1 9, §8.4 5 |
| Cross-doc vs docs/mvp/README.md + HANDOFF.md | PASS w/ 1 NIT | §4.1 closing → MVP-2 (P0), MVP-3 (P1–P2); §8.4 closing → MVP-3/4/5 (P1–P4); all MVP numbers exist in README map; HANDOFF `## MVP-0` consistent. NIT: README phase map row MVP-0 says "Guide §4 Atmosfer" while actual section is §4.1 — README is MUST-NOT-edit, cosmetic only |
| §11 #13–#17 identifiers unbackticked (ROOM_lobby, face_*, hex) | NIT (not blocking) | matches Decisions D verbatim text — plan mandates verbatim copy, executors MUST NOT improve |

**F2 verdict: APPROVE** — 0 BLOCKING, 2 NIT.

## final (F1)

Independent reviewer F1 — re-ran ALL acceptance/QA commands todo 1-7 + Success criteria. 2026-10-17T09:34:32+00:00

```
=== TODO 1 ===
rows13-17 (exp5): 5
§4.1 Atmosfer md (exp1): 1
§8.4 Game Feel md (exp1): 1
baseline.sha256 lines (exp>=8): 12
QH '| 17 |' (exp1): 1
QF '| 18 |' (exp0): 0
=== TODO 2 ===
269:### 8.4 Game Feel (MVP-0, terkunci)
283:## 9. Fakta Lingkungan (hasil audit)
waiting_permission (>=1): 1
ROOM_lobby (>=1): 1
NAV_wp_ (>=1): 1
Cinematic intro (>=1): 1
1.05 (>=1): 1
MUST NOT 6 (>=1): 2
QH enum-6 (exp6): 6
QF `meeting` (exp0): 0
QF ROOM_lounge s84 (exp0): 0
QF endpoint/api/schema (exp0): 0
=== TODO 3 ===
s51 TBD (exp0): 0
md TBD total (exp1): 1
face_blink (>=1): 1
'≤ 8.000 tris' (>=1): 1
celebrate (>=1): 1
'0.25 m' (>=1): 1
'≤ 200 tris' (>=1): 1
'parts sederhana' (exp1): 1
'untuk rigging' (exp1): 1
'^| ' rows (exp10): 10
QH 'Humanoid low-poly' (exp1): 1
QF '**TBD** —' (exp0): 0
=== TODO 4 ===
138:### 4.1 Atmosfer (MVP-0, terkunci)
154:## 5. Karakter
#F4EFE6 (>=1): 1
#4DB6AC (>=1): 1
#1A237E (>=1): 1
PCFSoft (>=1): 1
HemisphereLight (>=1): 1
'80×80 m' (>=1): 1
'4.1 Atmosfer' md total (exp2): 2
QH docs/mvp/README.md (>=1): 1
QF '^## 4.1' (exp0): 0
QF 'badge AI' (exp0): 0
=== TODO 5 ===
class="tbd" (exp1): 1
'4.1 Atmosfer' html (exp2): 2
'8.4 Game Feel' html (exp2): 2
<td>13-17</td> (exp5): 5
#F4EFE6 (>=1): 2
#1A237E (>=1): 1
face_blink (>=1): 1
waiting_permission (>=1): 1
HemisphereLight (>=1): 2
tail -1 (exp </html>): </html>
QH <h3>4.1 Atmosfer (exp1): 1
QH <h3>8.4 Game Feel (exp1): 1
QF 'TBD</span> —' (exp0): 0
QF s51-html tbd (exp0): 0
QF 'parts sederhana' html (exp1): 1
QF ROOM_lounge html (exp0): 0
=== TODO 6 (20 values md|html) ===
#F4EFE6 | md=2 | html=2
#FFF8F0 | md=2 | html=2
#D9D4CB | md=2 | html=2
#FFB74D | md=2 | html=2
#4DB6AC | md=2 | html=2
#E53935 | md=3 | html=3
#BFE3F7 | md=1 | html=1
#1A237E | md=1 | html=1
8.000 tris | md=1 | html=1
0.25 m | md=2 | html=2
≤ 200 tris | md=1 | html=1
PCFSoft | md=1 | html=1
HemisphereLight | md=2 | html=2
2048 | md=2 | html=2
celebrate | md=3 | html=3
face_blink | md=1 | html=1
0.6 s | md=1 | html=1
1.05 | md=1 | html=1
NAV_wp_ | md=1 | html=1
waiting_permission | md=1 | html=1
table rows md/html: s51 9/9, s41 7/7, s84 5/5, §11 17/17 (html <tr><td> data-only; +1 <tr><th> header each)
=== TODO 7 ===
'## MVP-0' (exp1): 1
head -1: # Redhunter HQ — MVP Handoff Log
AGENT_STATUSES (exp1): 1
NAV_wp_lobby (exp1): 1
QH 'MVP-4 (P3)' (exp1): 1
QF 'wajib' in MVP-0 section (exp0): 0
QF ROOM_lounge (exp0): 0
=== SUCCESS CRITERIA ===
md TBD=1, html class=tbd=1, ###4.1=1, ###8.4=1, h3 both=1, #13-17 both=5, §0 rows both files present, enum6=6, meeting=0, ROOM_lounge=0 everywhere, HANDOFF MVP-0=1 NAV_wp_lobby=1 (in MVP-2 bullet) — ALL PASS
=== VERBATIM DECISIONS ===
A/B/C/D/E diffed against plan text: identical (incl. (tetap) rows preserved: 'T-pose atau A-pose (untuk rigging)', 'parts sederhana')
=== UNTOUCHED SECTIONS ===
§1,2,3,6,7,9,10 leakage grep (Playful Pastel|face_blink|#F4EFE6|8.4|4.1|Cinematic|NAV_wp_|HemisphereLight): all 0
```

F1 VERDICT: APPROVE — all acceptance, QA-happy, QA-failure, success-criteria values match plan.
