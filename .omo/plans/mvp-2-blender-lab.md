# mvp-2-blender-lab - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->

**What you'll get:** Gedung Redhunter HQ 4 lantai (Floor 1 lengkap: lobby + sofa, meeting kaca, 8 workstation, koridor, tangga merah, taman + jalan di luar) dibangun ulang dari script Blender modular yang bisa dijalankan kapan saja, tersimpan sebagai empat versi `.blend` (satu per gerbang persetujuan, tidak pernah ditimpa) dan render PNG (isometrik, eye-level lobby, workstation, malam) yang lulus pemeriksaan angka objektif (kecerahan, porsi merah, variasi warna) sebelum Anda melihatnya. Di samping itu: 3–4 potongan kit dinding/lantai dari Meshy dijahit jadi satu ruangan pembanding, satu karakter kantor Meshy 1,7 m yang sudah di-rig dengan animasi idle berdiri di lobby, satu render perbandingan, verdict Level 1 vs Level 2 ditulis ke guide, dan laporan handoff untuk MVP-3.

**Why this approach:** Script = sumber kebenaran (bisa rebuild, tidak bergantung scene Blender yang hilang saat restart). Meshy dipakai lewat MCP dengan mesin Smart Topology t2.5 (mesh bersih mid-poly langsung, ±15 kredit/objek) + satu gambar referensi style yang sama untuk semua objek supaya kit dan karakter satu bahasa visual. Render dilakukan headless ke PNG lalu dibaca, bukan screenshot viewport yang tidak andal. Anda memegang 4 gerbang persetujuan (setelah gedung, setelah kit, setelah karakter, saat verdict).

**What it will NOT do:** Tidak menyentuh kode web/API/packages, tidak export GLB ke web (itu MVP-3). Tidak pakai Sloyd/Tripo. Tidak membuat shape key wajah, 7 clip animasi, atau avatar DIY (MVP-4). Tidak commit git, tidak mengedit atau menampilkan `.env`. Dinding/furniture bpy tetap warna palet tanpa tekstur bitmap di MVP ini — tekstur hanya pada objek Meshy; benturan/klopnya justru dinilai di verdict.

**Effort:** Large (19 todo, 8 wave, 4 gerbang user)
**Risk:** Medium — kualitas output Meshy tidak deterministik (dibatasi 300 kredit / 6 kit / 3 karakter, lalu tanya); Blender 5 API rename ditangani dengan guard; render headless sudah teruji.
**Decisions to sanity-check:** (1) style guide diubah ke "mid-poly stylized bertekstur tajam" di semua baris yang menyebut flat/low-poly (§1, §3, §4, §4.1, §5.1), karakter ≤ 20k tris tekstur ≤ 2048² (Meshy refine 2k), kit ≤ 1,5k tris tekstur ≤ 1024²; (2) harga rig 5 / animate 3 kredit dari MCP menggantikan "0 kredit" di guide §10; (3) lisensi output = Meshy Pro komersial, bukan CC BY; (4) cap 300 kredit, gambar referensi style dibuat baru SETELAH Anda approve gedung (bukan sebelum) supaya tidak terbuang; (5) tes = self-check assert saat build headless + stat render objektif; (6) dinding bpy tetap warna palet (tanpa tekstur) di MVP ini; (7) model gambar referensi nano-banana-2 (12 kr) dikonfirmasi ke Anda di checkpoint 2a sebelum dipakai.

Your next move: plan ini sudah melewati dual high-accuracy review bila bagian review di draft menunjukkan APPROVE; jalankan `$start-work mvp-2-blender-lab`. Full execution detail follows below.

---

> TL;DR (machine): Large / Medium risk — build_hq.py + normalize_kit.py + render_hq.py, hq_v01..v03.blend, Meshy kit+character (Pro MCP, cap 300 cr), verdict in guide, HANDOFF.

## Scope

### Must have
- Guide style revision (mid-poly + textures) written to `docs/redhunter-hq-brainstorming-guided.md` + `.html` BEFORE any modeling (todo 1).
- `apps/assets/blender/build_hq.py`: idempotent (deletes and rebuilds its own collections), runs via MCP `execute_blender_code` AND headless `blender -b -P apps/assets/blender/build_hq.py`; `-- --check` self-check mode exits non-zero on contract violation.
- 4-floor massing footprint 20×14 m, floor height 3.2 m, column grid 4 m; floors 2-4 shell only (slab + perimeter walls + windows), Floor 1 detailed: `ROOM_lobby` (reception + sofa area), `ROOM_meeting_a` (glass walls, `TASK_board`), `ROOM_workstation_a` (8 desks `TASK_desk_1..8`, chair + monitor each), corridor, stairs (red core `#E53935`).
- Exterior §4.1: ground 80×80 m `#A5D6A7` (guide §4.1 value, unchanged; the verdict stage in todo 17 adds its own `ground_verdict` plate south of it), road 6 m `#9E9E9E`, sidewalk `#CFCFCF`, 8-12 trees, 1-2 cars; collection `EXTERIOR`.
- Lighting siang: Sun `#FFFFFF` (guide R3F intensity 1.4 → Blender `energy = 4.0` W/m²) + World sky gradient `#BFE3F7`→`#E3F4FC` + one AREA light per Floor-1 room (`LIGHT_area_lobby/_meeting/_workstation`, 4×4 m, 150 W, `#FFF8F0`) so interiors under the Floor-2 slab pass the luminance gate; glass casts transparent shadows; Eevee soft shadows; night variant (Sun `#5C6BC0` energy 0.7, sky `#1A237E`→`#0D1B2A`, window emissive `#FFF3C4`) for 1 iso render.
- Naming §6 complete: collections `FLOOR_1..4`, `EXTERIOR`; objects `ROOM_lobby`, `ROOM_meeting_a`, `ROOM_workstation_a` (floor-area meshes), `COL_*` (hide_render=True), `NAV_spawn_lobby`, `NAV_cam_floor1`, `NAV_cam_iso`, `NAV_wp_lobby`, `NAV_wp_meeting_a`, `NAV_wp_workstation_a` (empties), `TASK_board`, `TASK_desk_1..8`, `KIT_*` (bpy kit sources `KIT_<piece>` in collection `KIT_BPY`; normalized Meshy pieces `KIT_meshy_<piece>` in `KIT_MESHY` — object names are global in Blender, so the two sets MUST differ), `CHAR_BASE`.
- `apps/assets/blender/render_hq.py`: headless render of camera list → `apps/assets/blender/renders/hq_vNN_<view>.png` (1280×720, Eevee, 32 samples).
- Meshy via MCP (`meshy_*` tools), REST fallback with `MESHY_API_KEY` only on MCP tool error: 2 style reference images (kit sheet + character), 3-4 `KIT_*` pieces, 1 character (t-pose, rig, idle). Credit cap 300 for the whole MVP; max 6 kit generations, max 3 character generations without re-asking.
- `apps/assets/blender/normalize_kit.py`: import GLB → scale to target bbox → origin at base-centre → apply transforms → edge clean-up (`remove_doubles` + snap edge vertices to bbox planes) → Decimate if > 1500 tris → auto-smooth 30° → texture ≤ 1024² or palette-material fallback → rename `KIT_meshy_<piece>`.
- `ROOM_meeting_a_kit`: duplicate of meeting room built from Meshy KIT_* instances at offset (x+30 m), bpy colliders/NAV/TASK kept.
- Renders: iso + eye-level lobby + eye-level workstation (v01); side-by-side bpy vs kit (v02); lobby with character (v03); comparison frame (v03/final).
- 4 user checkpoints (after 2a, 2b, 2c, verdict question in 2d) implemented as STOP todos: worker presents renders + checklist and waits.
- Verdict written to guide §3 (Hybrid Meshy row + Style row if needed), §10 Meshy price correction, §11 rows; `.html` mirrored; if Level 2 chosen, `build_hq.py` Floor 1 uses `KIT_MESHY` instances.
- `docs/mvp/HANDOFF.md` appended with the full MVP-2 report.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- MUST NOT edit anything under `apps/web/`, `apps/api/`, `packages/`, `apps/assets/scripts/`, `apps/assets/models/`, root `package.json`, `bun.lock`, `.env`, `.gitignore`.
- MUST NOT export GLB for the web, create `apps/web/public/models/*`, or run `gltf-transform` (MVP-3).
- MUST NOT use Sloyd, Tripo, Hyper3D, Hunyuan, Poly Haven/Sketchfab addon libraries, or Blender MCP `generate_3d`/`import_asset`.
- MUST NOT generate a whole room/building as one Meshy mesh (§1 MUST NOT 3) — one kit piece or one character per task.
- MUST NOT exceed 300 Meshy credits total, 6 kit generations, 3 character generations without a new explicit user authorization in that turn. Every paid call is preceded by a balance read and logged.
- MUST NOT use REST API when the MCP tool succeeded; MUST NOT print, echo, or copy `MESHY_API_KEY`; MUST NOT expose `127.0.0.1:9876`.
- MUST NOT run `git commit/add/stash/checkout <branch>/push/branch`; read-only git allowed. MUST NOT touch the 31 pre-existing modified / 74 untracked files except the three docs in scope.
- MUST NOT rely on viewport screenshots or `look` for QA verdicts (numpy absent, viewport dark) — render PNG + `read` only. MUST NOT claim a render passed without reading the PNG.
- MUST NOT add bitmap textures or vertex-colour layers to bpy-built geometry in this MVP: bpy geometry = flat shading + Principled Base Color from `PALETTE` only. Auto-smooth (`set_sharp_from_angle` 30°) applies ONLY to imported Meshy objects.
- MUST NOT create face shape keys, the 7 animation clips, avatar DIY parts, or the AI ring mesh on the character (MVP-4) — only rig + idle.
- MUST NOT edit guide sections other than: §1 MUST NOT 4; §3 rows Style, Konsistensi style, Hybrid Meshy; §4 rows Gaya, Shading, Material, Tekstur bitmap, Batas bawah, the "Tolak" paragraph and the "Konsistensi interior" block; §4.1 Vibe cell; §5.1 rows Bentuk, Polycount; §10 Meshy row; §11 append. MUST NOT renumber existing §11 rows.
- MUST NOT overwrite a checkpointed `.blend`: `hq_v01` frozen after 2a, `hq_v02` after 2b, `hq_v03` after 2c; the verdict stage and any Level-2 switch save as `hq_v04.blend`. `save_version = 0` (no `.blend1` litter).
- MUST NOT auto-detect raw assets: Meshy kit/character are included ONLY with explicit `--with-kit` / `--with-character` flags; a plain rebuild must reproduce v01 exactly.
- MUST NOT run `main()` at module level (double-run hazard); MUST NOT have import-time side effects in any module `render_hq.py` imports.
- MUST NOT retry a Meshy create call after a timeout/network/5xx error without first `meshy_list_tasks` dedupe (a task may already exist and be charged).
- MUST NOT run the MCP parity exec against a live Blender file that is named and dirty (user work) — only against an unsaved/default or the project's own `hq_vNN.blend`.

## Verification strategy
> Zero human intervention — all verification is agent-executed. User checkpoints are approval gates, not verification.
- Test decision: **tests-after**, framework-less. `blender -b -P apps/assets/blender/build_hq.py -- --check` runs `self_check()` (assert-based) after build; exit code ≠ 0 on any failed assertion. Plus `python3 -c "import ast;ast.parse(open('apps/assets/blender/build_hq.py').read())"` syntax gate.
- Shell discipline (always): bash cwd persists; every command `R=$(git rev-parse --show-toplevel)` then subshell `(cd "$R" && …)`. Evidence `…/NN-file` = `"$R/.omo/evidence/mvp-2-blender-lab/NN-file"`. Every long command redirects `> …/NN.txt 2>&1; echo EXIT=$? >> …/NN.txt`.
- **Blender exit codes (always):** `blender -b` exits 0 even when the Python script raises, unless `--python-exit-code 1` is given BEFORE `-P`/`--python-expr`. Every headless invocation in this plan (BL_BUILD, BL_RENDER, every `--python-expr` probe, `test_furniture.py`, `normalize_kit.py` CLI) MUST pass `--python-exit-code 1`; an EXIT≠0 expectation is meaningless without it.
- **Blender stdout capture (always):** background Blender prints `Blender quit` as its last line, so `| tail -1` captures that, never the value. Every `--python-expr` print uses a sentinel: `print('OUT', repr(x))`, captured with `| grep '^OUT ' | sed 's/^OUT //'`; an empty capture = FAIL. Never `tail -1` on Blender output.
- Blender headless invocation macro **BL_BUILD(path, flags)**: `(cd "$R" && timeout 600 blender -b --python-exit-code 1 -P apps/assets/blender/build_hq.py -- --save <path> --check <flags>)` where `<flags>` ⊆ `--with-kit --with-character --with-verdict-stage --kit-source bpy|meshy`. Scratch builds use `/tmp/hq_scratch_t<N>.blend` (per todo, never shared, never under `apps/`). **BL_RENDER(blend, views, extra)**: `(cd "$R" && timeout 600 blender -b <blend> --python-exit-code 1 -P apps/assets/blender/render_hq.py -- --views <comma-list> --out apps/assets/blender/renders [--phase day|night] [--tag rK] [--hide FLOOR_2,FLOOR_3,FLOOR_4,KIT_TEST_CEILING])`. Output name `<blendstem>[_<tag>]_<view>[_night].png`. `--hide` accepts collection names only; an unknown name → `sys.exit(2)`. There is no `ROOF` collection: `roof_top` lives in `FLOOR_4`.
- **Protected-path fingerprint (always):** `PROTECTED="apps/web apps/api packages package.json bun.lock .gitignore apps/assets/scripts apps/assets/models"`; `protected_sha()` = `(cd "$R" && (git diff -- $PROTECTED; git ls-files -o --exclude-standard -- $PROTECTED | sort | xargs -r sha256sum) | sha256sum)`. Todo 2 records it to `…/00e-protected.sha`; todo 19 and F4 recompute and require equality (the worktree is already dirty in those paths, so `git status`/`git diff --stat` emptiness can never be the gate).
- **Checkpoint integrity (always):** a start-work continuation, Stop-hook prompt, ralph/boulder loop message or any non-human turn is NOT a user reply. `USER_APPROVED_2A/2B/2C` and `VERDICT:` tokens may be written only after a human turn whose verbatim text is quoted in the checkpoint file.
- Paths: all scripts resolve against `REPO_ROOT = Path(__file__).resolve().parents[3]` (file lives at `apps/assets/blender/x.py`); MCP exec passes `__file__` explicitly. Never rely on cwd.
- Render stats (objective, no numpy): `render_hq.py` reloads each PNG via `bpy.data.images.load`, samples every 16th pixel, prints `STATS <view> mean_lum=<0-1> red_ratio=<0-1> unique_colors=<n>`. Gates: `0.15 < mean_lum < 0.9`; `red_ratio < 0.08` (pixels within ΔRGB 0.12 of `#E53935`) backs the "aksen merah tidak dominan" row; `unique_colors > 200` backs "not flat/black". Stats are appended to the QA file; a QA row may only read PASS when its stat gate passes. Exception: `--phase night` renders (`--no-gate`) gate only `unique_colors > 200` (see `render_hq.py`, todo 6).
- Render QA (always): after BL_RENDER, `read` each PNG, then write `…/NN-qa-vNN.md` with the §4 checklist per view (siluet iso+eye-level, no blur/noise, red accent not dominant, 1.7 m human scale vs door/desk, naming §6 complete) each row PASS/FAIL + one-line reason + the STATS line. A FAIL → iterate (max 3 rounds per checkpoint, `--tag r1..r3`) before presenting to the user.
- Meshy ledger (always): `…/meshy-ledger.md` table `| # | tool | task_id | credits_before | credits_after | delta | asset path | notes |` — one row per paid call, `meshy_check_balance` before and after; per-row reconcile `before − after == delta` (refund rows allowed with note). Running total ≤ 300. Header notes: `image model nano-banana-2 = announced default under cap; user may veto at 2a`.
- Meshy dedupe (always): on a create-call timeout, network error, or 5xx → `meshy_list_tasks(task_type=<type>, limit=5)` and match by prompt/created_at; if found, resume that `task_id`; REST fallback (`curl -H @<(printf 'Authorization: Bearer %s\n' "$MESHY_API_KEY")`, key read inside a subshell as `MESHY_API_KEY=$(grep -m1 '^MESHY_API_KEY=' "$R/.env" | cut -d= -f2-)` — never `source`/`.` the file, never `set -x`, never echoed) only when the MCP tool returns a schema/auth error AND `meshy_list_tasks` shows no new task. REST endpoints: `POST https://api.meshy.ai/openapi/v2/text-to-3d` (`mode: "preview"` / `mode: "refine"` with `preview_task_id`, `texture_image_url`), `GET …/text-to-3d/<id>`.
- Reference image freshness: before every refine, `meshy_get_task_status(<ref task_id>)` to get a current image URL; if unavailable → use `texture_prompt` only and ledger note `REF_URL_EXPIRED`.
- Doc-edit discipline: todo 1 snapshots the three docs to `…/00c-pre/` BEFORE its first edit (todo 2 only records mtimes afterwards); doc diffs use `diff -u …/00c-pre/<f> <f>`; before each doc edit compare mtime with the snapshot — if it changed outside this session → STOP (another session is editing). Doc acceptance = reviewer-agent read (`…/NN-guide-review.md`, one row per edited cell, md==html text, PASS/FAIL) + minimal machine checks (row `| 19 |` / `| 20 |` once, `.html` parses with `python3 -c "import html.parser as h;p=h.HTMLParser();p.feed(open('docs/redhunter-hq-brainstorming-guided.html').read())"`).
- MCP parity: run `blender_execute_blender_code` with `exec(open(p).read(), {"__name__": "__main__", "__file__": p})` ONLY in todo 8 and F3, and only after `blender_get_scene_info(fields=["settings"])` shows the live file is unsaved/default or one of this project's `hq_vNN.blend`; otherwise STOP and ask. `user_prompt` = the user's verbatim words. Headless exit code is the gate.
- Checkpoint files must quote the user's verbatim reply, not only the token.
- Evidence root: `.omo/evidence/mvp-2-blender-lab/` (create in todo 2). Git status snapshots use raw `git status --porcelain=v1` (not rtk).
- Gates at the end: BL_BUILD of the final version EXIT=0; all renders present and QA'd; ledger total ≤ 300; `git status --porcelain=v1` diff vs `00` shows new paths only under `apps/assets/blender/`, `apps/assets/raw/`, `.omo/**`; the three docs were already ` M` before; `protected_sha()` unchanged vs `00e`.

## Execution strategy

### Parallel execution waves
- **Module layout (one file per todo, so Wave 1 can run in parallel without collisions):** `apps/assets/blender/hq_lib.py` (todo 3: constants, `REPO_ROOT`, palette, `hex_to_rgba`, `get_material`, `get_collection`, `clear_project_collections`, `reset_startup_scene`, `make_box`, `CAM_TARGETS`, `CHARACTER_SPAWN`, `KIT_UNUSED_OK`, `self_check` registry) · `hq_massing.py` (todo 3) · `hq_floor1.py` (todo 4) · `hq_furniture.py` (todo 5) · `hq_lighting.py` (todo 6: lights, world, cameras — reads `CAM_TARGETS` from `hq_lib`, never NAV objects) · `build_hq.py` (todo 3 skeleton; todo 8 wires everything) · `render_hq.py` (todo 6) · `normalize_kit.py` (11) · `import_character.py` (15) · `tests/test_furniture.py` (5). Todo 4 imports `make_desk/make_chair/make_monitor/make_meeting_table/make_whiteboard/make_plant/make_sofa` from `hq_furniture` by the signatures fixed in todo 5's header; until todo 5 lands, todo 4 may stub them locally in a `_stub_furniture()` block that todo 8 removes.
- **Wave 0 (sequential):** 1 (guide style revision) → 2 (pre-state, API probe, doc snapshots).
- **Wave 1a (sequential):** 3 (`hq_lib.py` + `hq_massing.py` + `build_hq.py` skeleton) — it owns the helpers every other module imports, so its acceptance must be green (`…/10-build-t3.txt` EXIT=0) first.
- **Wave 1b (parallel after 3; disjoint files):** 4 (`hq_floor1.py`) ∥ 5 (`hq_furniture.py` + test) ∥ 6 (`hq_lighting.py` + `render_hq.py`). Authoring may start after 2, but each acceptance run imports `hq_lib`/`hq_massing` and therefore runs only after 3 is accepted.
- **Wave 2 (sequential):** 8 (wire modules in `build_hq.py`, self_check, v01 renders) → 9 ⏸ CHECKPOINT 2a.
- **Wave 3 (after 9):** 7 (style reference images, paid — after 2a so a style revision cannot waste credits) ∥ 11 (`normalize_kit.py`, no Meshy); 10 (kit pieces) after 7.
- **Wave 4 (sequential):** 12 (normalize + `ROOM_meeting_a_kit` + v02 renders + metrics) → 13 ⏸ CHECKPOINT 2b.
- **Wave 5 (sequential):** 14 (character generate + refine) → 15 (rigged import, idle, v03 render) → 16 ⏸ CHECKPOINT 2c.
- **Wave 6 (sequential):** 17 (verdict stage → `hq_v04.blend`, question ⏸) → 18 (guide verdict + optional KIT switch, `hq_v04`) → 19 (HANDOFF).

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 2 | — |
| 2 | 1 | 3 | — |
| 3 | 2 | 4,5,6 | — |
| 4 | 2 (authoring), 3 (verification run) | 8 | 5,6 |
| 5 | 2 (authoring), 3 (verification run) | 8 | 4,6 |
| 6 | 2 (authoring), 3 (verification run) | 8 | 4,5 |
| 7 | 9 | 10,14 | 11 |
| 8 | 3,4,5,6 | 9 | — |
| 9 | 8 | 7,10,11 | — |
| 10 | 7 | 12 | 11 |
| 11 | 9 | 12 | 7,10 |
| 12 | 10,11 | 13 | — |
| 13 | 12 | 14 | — |
| 14 | 7,13 | 15 | — |
| 15 | 14 | 16 | — |
| 16 | 15 | 17 | — |
| 17 | 16 | 18 | — |
| 18 | 17 | 19 | — |
| 19 | 18 | F1-F4 | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. Guide style revision: mid-poly + crisp textures written to `.md` and `.html`

**What to do**
- Step 0 (prompt line "LANGKAH PERTAMA WAJIB"): read `docs/redhunter-hq-brainstorming-guided.md` in full, `docs/mvp/README.md`, `docs/mvp/HANDOFF.md`, `docs/mvp/MVP-2-blender-lab.md`; record `…/00a-docs-read.txt` listing each path + line count.
- Edit `docs/redhunter-hq-brainstorming-guided.md` (anchor-based edits, never line numbers):
  - §1 MUST NOT 4: replace `**MUST NOT** pakai smooth shading, tekstur blur, atau bentuk "meleleh" (lihat §4).` with `**MUST NOT** pakai tekstur blur/noise, bentuk "meleleh", atau smooth shading di luar auto-smooth ≤ 30° (lihat §4).`
  - §3 Style row: replace cell `**Low-poly flat-shaded ala bruno-simon.com, kualitas tinggi** (bukan dark glass realistis)` with `**Mid-poly stylized bertekstur tajam** (siluet low-poly ala bruno-simon.com + tekstur hand-painted bersih; bukan dark glass foto-realistis)`; reason cell → `Achievable via bpy + Meshy t2.5, ringan, konsisten; user m0019 MVP-2`.
  - §4 table: Shading → `Auto-smooth ≤ 30° (sudut tajam tetap tajam). Flat untuk geometri bpy`; Material → `Tekstur hand-painted tajam (Meshy) atau vertex colors/palet (bpy); 1 shared material/atlas per objek bila bisa`; Tekstur bitmap → `Diizinkan; wajib tajam di kamera dekat, ≤ 2048² karakter, ≤ 1024² kit/prop, tanpa noise/blur`; Batas bawah kualitas → `Setara output Meshy t2.5 + refine 2k/4k`.
  - §4 "Tolak" paragraph: replace `campuran objek realistis/PBR-bertekstur dengan objek low-poly dalam satu scene` with `campuran objek foto-realistis PBR dengan objek stylized dalam satu scene`.
  - §3 "Konsistensi style" row cell → `**Satu bahasa visual untuk SEMUA objek**: exterior, interior, furniture, karakter, props = mid-poly stylized, siluet tegas, tekstur hand-painted tajam atau palet flat. Tidak ada campuran foto-realistis/PBR`.
  - §4 "Gaya" row → `Mid-poly stylized, playful, gamified, **clean & tajam**`.
  - §4 "Konsistensi interior" block: `bukan tekstur` → `bukan tekstur foto-realistis`; `tetap flat-shaded` → `tetap §4 shading`.
  - §4.1 Vibe cell: `tetap §4 flat-shaded` → `tetap §4`.
  - §5.1 Bentuk row → `Humanoid mid-poly stylized, proporsi realistis-stylized`.
  - §5.1 Polycount row → `≤ 20.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 2048². Budget scene: 10 agents ≈ 200k tris`.
  - §10 Meshy row cost cell: replace `rig/animate/remesh 0` with `rig 5, animate 3/aksi, remesh 5, convert/resize 1 (harga live MCP 2026-10-17)`.
  - §11 append row `| 19 | Mid-poly stylized + tekstur tajam (bukan flat vertex-color murni); karakter ≤ 20k tris, tekstur ≤ 2048² | "mid poly aja saya butuh texture juga walau poly" (MVP-2) |` after row 18.
- Mirror every change into `docs/redhunter-hq-brainstorming-guided.html` at the matching `<tr>`/`<li>` found by grep string (never line numbers): `Pakai smooth shading`, `Low-poly flat-shaded ala bruno`, `Satu bahasa visual`, `Low-poly flat-shaded, playful`, `Smooth hanya jika`, `Vertex colors / palet`, `Tekstur bitmap`, `Setara output Meshy`, `bukan tekstur`, `tetap flat-shaded`, `tetap §4 flat-shaded`, `Humanoid low-poly`, `8.000 tris`, `rig/animate/remesh 0`, the §11 row containing `Kit Meshy (Level 2)`. Keep existing markup classes.
- Record diff vs snapshot (todo 2 runs AFTER this todo, so take the snapshot here first): `mkdir -p …/00c-pre && cp docs/redhunter-hq-brainstorming-guided.md docs/redhunter-hq-brainstorming-guided.html docs/mvp/HANDOFF.md …/00c-pre/` BEFORE editing; after editing `diff -u …/00c-pre/redhunter-hq-brainstorming-guided.md docs/redhunter-hq-brainstorming-guided.md > …/01-guide-md.diff; diff -u …/00c-pre/redhunter-hq-brainstorming-guided.html docs/redhunter-hq-brainstorming-guided.html > …/01-guide-html.diff`.
- Reviewer read: spawn a read-only reviewer (`task(subagent_type="explore")`; if the task tool is unavailable, the worker fills the rows itself from grep-extracted md/html cell text with literal equality) that reads both diffs and writes `…/01-guide-review.md`: one row per replacement listed above (17 rows: §1 ×1, §3 Style ×2 cells, §3 Konsistensi ×1, §4 table ×4, §4 Tolak ×1, §4 Gaya ×1, §4 Konsistensi interior ×2, §4.1 ×1, §5.1 ×2, §10 ×1, §11 ×1), columns `cell | md text | html text | equal? | matches intent?`, ending `RESULT: PASS|FAIL`.

**Must NOT do**
- No edits to other §; no renumbering; no new sections; no .md/.html drift (every .md change has an .html twin). No edit to `docs/mvp/*`.

**Parallelization:** Wave 0, first. Blocks 2.

**References**
- `docs/redhunter-hq-brainstorming-guided.md` §1 MUST NOT 4 (L58), §3 rows Style L89 / Konsistensi style L94 / Hybrid Meshy L96, §4 L113-129 (Gaya, Shading, Material, Tekstur bitmap, Batas bawah, Konsistensi interior, Tolak), §4.1 Vibe L142, §5.1 Bentuk L160 / Polycount L165, §10 Meshy L330, §11 row 18 L358; `.html` grep anchors above.

**Acceptance criteria**
- `…/01-guide-review.md` ends `RESULT: PASS` with 17 rows all `equal? yes`; `grep -c '| 19 |' docs/redhunter-hq-brainstorming-guided.md` = 1; `.html` parses (python html.parser one-liner from Verification strategy exits 0); `grep -c '8.000 tris' docs/redhunter-hq-brainstorming-guided.md docs/redhunter-hq-brainstorming-guided.html` → 0 in both; `grep -c 'Low-poly flat-shaded ala bruno' …md …html` → 0 in both.

**QA scenarios**
- Happy: `…/01-guide-md.diff` touches only lines inside §1, §3, §4, §4.1, §5.1, §10, §11 (reviewer confirms via section headers surrounding each hunk).
- Failure: reviewer finds an md/html mismatch → fix the html cell, rerun reviewer; `RESULT: FAIL` blocks todo 2.

**Commit:** none unless asked; suggested `docs(guide): style → mid-poly textured (MVP-2 user decision)`.

- [x] 2. Pre-state + skeleton: evidence dir, raw dirs, ledger, Blender/Meshy baselines

**What to do**
- `mkdir -p "$R/.omo/evidence/mvp-2-blender-lab" "$R/apps/assets/blender/renders" "$R/apps/assets/blender/tests" "$R/apps/assets/raw/meshy/kit"`.
- `git status --porcelain=v1 > …/00-git-status-before.txt` (raw git, not rtk); `git rev-parse HEAD > …/00b-head.txt` (expect `49ea580…`); `stat -c '%Y %n' docs/redhunter-hq-brainstorming-guided.md docs/redhunter-hq-brainstorming-guided.html docs/mvp/HANDOFF.md .env > …/00d-doc-mtimes.txt` (mtime guard for later doc edits + `.env` untouched proof for F4); `protected_sha() > …/00e-protected.sha` and the per-file list `(cd "$R" && (git diff -- $PROTECTED | sha256sum; git ls-files -o --exclude-standard -- $PROTECTED | sort | xargs -r sha256sum)) > …/00e-protected.list` (Verification strategy "Protected-path fingerprint"; MVP-1 may run in a parallel session and touch these paths — on a later mismatch, diff the lists and ask the user whether another session authored the change BEFORE marking FAIL).
- `blender --version | head -1 > …/02-blender-version.txt` (expect `Blender 5.0.1`); engine enum probe appended: `blender -b --python-exit-code 1 --python-expr "import bpy;print('OUT',[i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])" 2>&1 | grep '^OUT ' | sed 's/^OUT //' >> …/02-blender-version.txt` (expect `['BLENDER_EEVEE']`).
- **API probe** (gates todos 3/6/11/15 — builders use only names that print `True`): `blender -b --python-exit-code 1 --python-expr "import bpy;T=bpy.types;print('OUT',repr({'Mesh.set_sharp_from_angle':hasattr(T.Mesh,'set_sharp_from_angle'),'Mesh.shade_smooth':hasattr(T.Mesh,'shade_smooth'),'Mesh.shade_flat':hasattr(T.Mesh,'shade_flat'),'Material.surface_render_method':hasattr(T.Material,'surface_render_method'),'Material.blend_method':hasattr(T.Material,'blend_method'),'Material.use_transparent_shadow':hasattr(T.Material,'use_transparent_shadow'),'SceneEEVEE.use_shadows':hasattr(T.SceneEEVEE,'use_shadows'),'SceneEEVEE.use_gtao':hasattr(T.SceneEEVEE,'use_gtao'),'SceneEEVEE.taa_render_samples':hasattr(T.SceneEEVEE,'taa_render_samples'),'Light.use_shadow_jitter':hasattr(T.Light,'use_shadow_jitter'),'AnimData.action_slot':hasattr(T.AnimData,'action_slot'),'Action.slots':hasattr(T.Action,'slots'),'view_transforms':[i.identifier for i in T.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items],'gltf_import':hasattr(bpy.ops.import_scene,'gltf'),'fbx_import':hasattr(bpy.ops.import_scene,'fbx')}))" 2>&1 | grep '^OUT ' | sed 's/^OUT //' > …/02b-api-probe.txt`. Record which of `view_transform` values `Standard`/`AgX` exist.
- `blender_get_addon_status` → paste raw JSON to `…/03-mcp-addon-status.json`; PASS if it reports `blender_version` `5.0.1` and contains no `outdated`/`update required` warning text.
- `blender_get_scene_info(fields=["settings"])` → `…/03b-live-scene.txt` (record whether live file is unsaved/default; used by the MCP-parity rule).
- `meshy_check_balance` → create `…/meshy-ledger.md` with header note (`image model nano-banana-2 = announced default under cap; user may veto at 2a`), table header, row `| 0 | balance | — | <bal> | <bal> | 0 | — | baseline |`.
- Create `apps/assets/raw/meshy/README.md` (3 lines): source = Meshy Pro via MCP, licence = Meshy paid-plan commercial licence (owner: this account), files >10 MB not for git.
- Do NOT create any `.py` yet.

**Must NOT do**
- No Blender scene changes. No paid Meshy call. No `.gitignore` edit.

**Parallelization:** Wave 0, after 1. Blocks 3 (and authoring of 4-6).

**References**
- Global AGENTS.md "Git Mutation Consent Gate"; `.omo/plans/mvp-1-foundation.md` todo 1 (evidence pattern); Blender 4.1+ removed `use_auto_smooth` (replaced by `set_sharp_from_angle` + `shade_smooth`), EEVEE Next renamed shadow/AO options — hence the probe.

**Acceptance criteria**
- Files `00, 00b, 00d, 00e, 02, 02b, 03, 03b, meshy-ledger.md` exist; `test -d apps/assets/raw/meshy/kit`; `test -d apps/assets/blender/renders`; `grep -c 'BLENDER_EEVEE' …/02-blender-version.txt` ≥ 1; `…/02b-api-probe.txt` is a Python dict literal with ≥ 15 keys (non-empty — an empty file means the sentinel capture failed).

**QA scenarios**
- Happy: `python3 -c "import ast;d=ast.literal_eval(open('$R/.omo/evidence/mvp-2-blender-lab/02b-api-probe.txt').read().strip());assert d['gltf_import']"` exit 0.
- Failure: `03` shows a warning/outdated text → STOP, report "addon outdated: run `uvx mcp-for-blender install-addon`" and wait.

**Commit:** none.

- [x] 3. `hq_lib.py` (shared helpers, constants, self_check registry) + `hq_massing.py` (4-floor shell + exterior) + `build_hq.py` skeleton

**What to do**
- Create `apps/assets/blender/hq_lib.py` (English identifiers, ≤ 300 LOC, no import-time side effects):
  - `REPO_ROOT = Path(__file__).resolve().parents[3]`; `BLENDER_DIR = REPO_ROOT / "apps/assets/blender"`; `RAW_MESHY_DIR = REPO_ROOT / "apps/assets/raw/meshy"`; `RENDER_DIR = BLENDER_DIR / "renders"`.
  - Constants: `FOOTPRINT_X = 20.0`, `FOOTPRINT_Y = 14.0`, `FLOOR_HEIGHT = 3.2`, `FLOOR_COUNT = 4`, `COLUMN_GRID = 4.0`, `WALL_THICKNESS = 0.15`, `SLAB_THICKNESS = 0.2`, `BUILDING_CENTER = (10.0, 7.0)`, `PALETTE = {"exterior": "#F4EFE6", "interior": "#FFF8F0", "floor": "#D9D4CB", "orange": "#FFB74D", "teal": "#4DB6AC", "red": "#E53935", "ground": "#A5D6A7", "road": "#9E9E9E", "sidewalk": "#CFCFCF", "glass": "#BFE3F7", "wood": "#8D6E63", "leaf": "#66BB6A", "desk_top": "#EFE6DA", "dark": "#263238", "screen": "#BFE3F7"}`; `CAM_TARGETS = {"iso": ((34, -22, 26), (10, 7, 2), "ORTHO", 44), "lobby": ((4, 2, 1.6), (12, 8, 1.2), "PERSP", 35), "workstation": ((8.5, 0.8, 1.6), (14, 5, 0.9), "PERSP", 28), "meeting_bpy": ((7, 7, 1.6), (11, 11, 1.0), "PERSP", 28), "meeting_kit": ((37, 7, 1.6), (41, 11, 1.0), "PERSP", 28), "kit_compare": ((26, -22, 14), (26, 11, 1), "PERSP", 24), "character_closeup": ((5.7, 4.25, 1.5), (7, 6, 1.4), "PERSP", 50), "verdict": ((3, -46, 4.0), (3, -27, 1.0), "PERSP", 28)}` (`kit_compare` is centred on x=26, the midpoint between the bpy room centre x=11 and the kit room centre x=41, wide enough at 24 mm to frame both; `verdict` at 28 mm from 19 m frames the full plate span x −6..12; `character_closeup` sits 2.2 m in front of the character's face, on the same side as the lobby camera); `CHARACTER_SPAWN = ((7.0, 6.0, 0.0), radians(-37))` (location, rotation_z — Blender's glTF importer maps glTF +Z forward to local −Y, so an unrotated character faces −Y; rotating −37° turns local −Y toward the lobby camera at (4,2), i.e. forward ≈ (−0.6, −0.8); inside the lobby camera's view cone; the sofa group at x 5.6-7.6, y 1.15-4.05 does not overlap the spawn or the `CAM_lobby`→`CHARACTER_SPAWN` sightline); `KIT_UNUSED_OK = {"KIT_floor_1m", "KIT_pillar", "KIT_meshy_pillar"}`; `NAME_PREFIX_RE = r"^(FLOOR|ROOM|COL|NAV|TASK|KIT|CHAR|SIGN|EXT|CAM|SUN|LIGHT|STAIR|TGT)_"`; `NAME_PART_RE = r"^(wall|slab|column|window|roof|tree|car|ground|road|sidewalk|desk|chair|monitor|table|sofa|stair|door|plant|whiteboard|counter|coffee_table|tile)_"` (`tile` covers Level-2 Floor 1 instances `tile_f1_<i>` placed in `FLOOR_1`); `EXEMPT_COLLECTIONS = {"KIT_MESHY", "CHARACTERS", "VERDICT_STAGE", "FLOOR_1_KIT_TEST", "KIT_TEST_CEILING"}`; `TRIS_BUDGET_BUILDING = 150000`.
  - `srgb_to_linear(c)`: `c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4`; `hex_to_rgba(hex) -> (r,g,b,1.0)` applies it per channel.
  - `get_material(name, hex, *, emission_hex=None, emission_strength=0.0, glass=False)`: cached by name; Principled node via `n.type == "BSDF_PRINCIPLED"`; Base Color linear; Roughness 0.8; glass → Alpha 0.35, `mat.surface_render_method = 'BLENDED'` if the probe said it exists else `mat.blend_method = 'BLEND'`, and `mat.use_transparent_shadow = True` when the probe lists it (blended glass otherwise casts opaque shadows in EEVEE Next and darkens the interiors).
  - `get_collection(name, parent=None)`: get-or-create, NEVER clears (used by every builder, so todo 4's `build_floor_1` can add to `FLOOR_1` without deleting the slab that `build_massing` put there). `clear_project_collections()` is the ONLY clearing path: it unlinks + deletes every object (and orphan mesh/material data with 0 users) of every collection in `PROJECT_COLLECTIONS = ["EXTERIOR","FLOOR_1","FLOOR_2","FLOOR_3","FLOOR_4","KIT_BPY","KIT_MESHY","CHARACTERS","FLOOR_1_KIT_TEST","KIT_TEST_CEILING","VERDICT_STAGE","LIGHTING","CAMERAS"]` and removes the collections. `reset_startup_scene()`: if `bpy.app.background and not bpy.data.filepath` → `bpy.ops.wm.read_homefile(use_empty=True)` (headless `-P` loads the default startup file with `Cube`, `Camera`, `Light` and collection `Collection`, which would fail the name checks); else delete objects named exactly `Cube`, `Camera`, `Light` and the collection `Collection` only when it is empty afterwards.
  - `make_box(name, size, location, material, collection)`: `bpy.data.meshes.new` + `bmesh.ops.create_cube` scaled (no `bpy.ops`, so it works with any selection/context), origin at base-centre, `mesh.shade_flat()`; `make_cylinder`, `make_icosphere`, `make_cone` likewise via bmesh; `make_empty(name, location, rotation, collection, display='ARROWS')`; `link_duplicate(src, name, location, rotation_z, collection)` = `bpy.data.objects.new(name, src.data)`.
  - `self_check(scene)`: registry pattern — modules append check functions to `SELF_CHECKS` list; `run_self_checks()` runs all, counts objects and tris (via `obj.evaluated_get(bpy.context.evaluated_depsgraph_get())`), prints `SELF_CHECK OK <objects> objects <tris> tris` or raises `AssertionError` with the failing check name. Base checks: `REPO_ROOT/"docs/redhunter-hq-brainstorming-guided.md"` exists; every `COL_*` has `hide_render` True; every object outside `EXEMPT_COLLECTIONS` matches `NAME_PREFIX_RE` or `NAME_PART_RE`; tris of `FLOOR_1..4` + `EXTERIOR` ≤ `TRIS_BUDGET_BUILDING`.
  - `count_tris(objects)`, `count_tris_by_collection() -> dict`.
- Create `apps/assets/blender/hq_massing.py`: `build_massing()` → collections `FLOOR_1..FLOOR_4` (FLOOR_1 gets only its slab here; interior in todo 4): per floor n: slab 20×14×0.2 named `slab_floor_<n>` with its TOP flush at z=(n-1)*3.2, i.e. box location z = (n-1)*FLOOR_HEIGHT − SLAB_THICKNESS (so Floor 1 furniture at z=0 stands on the slab, not inside it); floors 2-4 slab is 4 boxes around a 3×4 m stair void at x 16-19, y 9-13 (`slab_floor_<n>_w` x 0-16 full depth, `_e` x 19-20 full depth, `_s` x 16-19 y 0-9, `_n` x 16-19 y 13-14 — the void is interior, so 2 boxes cannot leave it open; no boolean); floors 2-4: 4 perimeter walls (`exterior`, 0.15 thick, 3.2 high) named `wall_f<n>_<side>`; window glass boxes 0.02 thick, 1.2 m high at z+1.0, every 2 m, placed 0.085 m outward of the wall centreline (proud of the facade, so visible and emissive at night) named `window_f<n>_<i>` with material `glass`; columns 0.3×0.3×3.2 on the 4 m grid inside named `column_f<n>_<i>`; roof slab `roof_top` at z=4*3.2; `SIGN_redhunter` box 4×0.2×0.8 `red` centred at (10, -0.1, 3*3.2+2.0) on the front facade (front = y=0 face, toward the road). `COL_slab_floor_<n>` wire box per slab (hide_render True, `display_type='WIRE'`). `build_exterior()` → collection `EXTERIOR` centred at `BUILDING_CENTER`: ground 80×80×0.05 named `ground_main` (spans x −30..50, y −33..47 — guide §4.1 "ground plane 80×80 m", do NOT enlarge; the verdict camera's extra ground south of y −33 is `ground_verdict` in `VERDICT_STAGE`, todo 17; the road x −30..50 ends exactly at the ground edge, which is intended) with top at z=−0.01 (location z −0.06, so the building slab top, kit tiles and verdict plates — all at z 0..+0.005 — never z-fight with it; the 1 cm step at the building edge is invisible at scene scale); road 6 m wide along y=-12 from x=-30..50 named `road_main`, top at z 0.01; sidewalks 2 m named `sidewalk_n` / `sidewalk_s` on both road sides, top at z 0.02 (staggered tops avoid z-fighting); trees `tree_<i>` (i 1..10) at `TREE_POSITIONS = [(-6,4),(-6,12),(-4,22),(4,24),(14,24),(24,22),(26,6),(-14,-4),(30,-4),(-20,14)]` in `hq_lib.py` — all inside `ground_main`, outside the building footprint, the road band y −17..−7, the kit room x 37..45 y 7..15 and the verdict stage x −8..14 y −32..−22, with ≥ 1.5 m clearance for the r1.2 crowns; re-check iso framing after the first v01 render (5 round: trunk cylinder r0.15 h1.0 `wood` + icosphere subdiv 1 r1.2 `leaf` at z 1.8; 5 cone: trunk + cone r1.2 h2.5; one mesh object per tree); 2 cars `car_1` / `car_2` 4×1.8×1.2 (`teal` at (-8,-12), `orange` at (28,-12)). Every exterior name ends in `_<something>` so it matches `NAME_PART_RE`. Registers `check_massing` (slab TOP z per floor ± 0.01, 4 floors, roof present, sign present).
- Create `apps/assets/blender/build_hq.py` skeleton: `sys.path.insert(0, str(Path(__file__).resolve().parent))`; `parse_args(argv)` for tokens after `--`: `--save <path>`, `--check`, `--with-kit`, `--with-character`, `--with-verdict-stage`, `--kit-source bpy|meshy` (default `bpy`), `--inject-bad-col`, `--inject-missing-nav` (test hooks); `main(argv=None)`: `reset_startup_scene(); clear_project_collections()`; set `scene.render.engine = 'BLENDER_EEVEE'` in `try/except TypeError`; `scene.view_settings.view_transform = 'Standard'` in try/except (enum read first); `if bpy.app.background: bpy.context.preferences.filepaths.save_version = 0` (never touch the user's preferences from the MCP run); call `build_exterior(); build_massing()` (todo 8 adds the rest); `run_self_checks()` if `--check`; `bpy.ops.wm.save_as_mainfile(filepath=str(path))` if `--save`. Guard: ONLY `if __name__ == "__main__": main()` — no module-level call.
- BL_BUILD(`/tmp/hq_scratch_t3.blend`) → `…/10-build-t3.txt` EXIT=0; run twice → `…/10b-build-t3-rerun.txt`.
- Negative: BL_BUILD(`/tmp/hq_scratch_t3n.blend`, `--inject-bad-col`) → `…/12-selfcheck-negative.txt` EXIT≠0.

**Must NOT do**
- No Floor 1 interior/furniture/lighting here (todos 4/5/6). No textures, no vertex-colour layers, no subdivision/bevel. No `bpy.ops.mesh.primitive_*` (context-dependent) — bmesh only. No absolute home paths. No module-level `main()`.

**Parallelization:** Wave 1a — sequential, first. Blocked by 2. Blocks 4,5,6 (their acceptance runs import these modules).

**References**
- Guide §4 L111-121 (grid, floor height), §4.1 L144 palette, L148 exterior, §6 naming, §7.1 L209-219, §9 L294-305; `…/02b-api-probe.txt` (which attrs exist); Blender API: `bmesh.ops.create_cube`, `Mesh.shade_flat`, `Object.hide_render`, `ColorManagedViewSettings.view_transform`, `PreferencesFilePaths.save_version`.

**Acceptance criteria**
- `…/10-build-t3.txt` EXIT=0 with `SELF_CHECK OK`; `10b` object/tris counts identical to `10` (idempotent); `…/12-selfcheck-negative.txt` EXIT≠0 containing `AssertionError`; `python3 -c "import ast;[ast.parse(open(f).read()) for f in ['apps/assets/blender/hq_lib.py','apps/assets/blender/hq_massing.py','apps/assets/blender/build_hq.py']]"` exit 0; `grep -c 'if __name__ == "__main__"' apps/assets/blender/build_hq.py` = 1 and `grep -cE '^main\(' apps/assets/blender/build_hq.py` = 0; `wc -l` each file ≤ 500.

**QA scenarios**
- Happy: `blender -b /tmp/hq_scratch_t3.blend --python-exit-code 1 --python-expr "import bpy;print('OUT',sorted(c.name for c in bpy.data.collections))" | grep '^OUT ' | sed 's/^OUT //'` contains `EXTERIOR, FLOOR_1, FLOOR_2, FLOOR_3, FLOOR_4` and no `Collection`/`Cube`/`Camera`/`Light`.
- Failure: `…/12-selfcheck-negative.txt` lacks `AssertionError` → self_check does not bite → fix before done.

**Commit:** none unless asked; suggested `feat(assets): hq_lib + massing + exterior`.

- [x] 4. `hq_floor1.py`: bpy modular kit, Floor 1 rooms, corridor, stairs, colliders, NAV/TASK empties

**What to do**
- Create `apps/assets/blender/hq_floor1.py` importing helpers from `hq_lib` and furniture builders from `hq_furniture` (signatures fixed in todo 5: `make_desk(name, location, rotation_z, collection)`, `make_chair(...)`, `make_monitor(...)`, `make_meeting_table(...)`, `make_whiteboard(name, location, rotation_z, collection, width=3.0)`, `make_plant(...)`, `make_sofa(...)`, `make_counter(...)`, `make_coffee_table(...)`); if `hq_furniture` is not importable yet, a `_stub_furniture()` fallback makes plain boxes of the same footprint and prints `FURNITURE_STUB` (todo 8 removes the stub).
- `build_kit_bpy()` → collection `KIT_BPY` (collection `hide_render = True`): sources `KIT_wall_1m` (1.0×0.15×3.2 `interior`), `KIT_wall_glass_1m` (1.0×0.05×3.2 `glass`), `KIT_wall_door` (frame = two side posts 0.05 wide + lintel above 2.1 m, door leaf box 0.9×0.04×2.1 `orange` — no boolean), `KIT_floor_1m` (1×1×0.1 `floor`), `KIT_pillar` (0.3×0.3×3.2 `exterior`). Sources sit at (0,-5,0) in a hidden collection.
- `place_kit(kit_name, position, rotation_z, collection, name)` → `link_duplicate`.
- `build_floor_1()` (origin = building corner (0,0); +X 20 m; +Y 14 m; front = y=0 toward road):
  - Perimeter: `KIT_wall_1m` instances `wall_f1_<side>_<i>` every 1 m, with `KIT_wall_glass_1m` instead at window positions (every 2 m, skipping door), main door `KIT_wall_door` at (4, 0) rotation 0 (front), second door at (0, 7) rotation 90°.
  - `ROOM_lobby`: x 0-8, y 0-14; area mesh = plane 8×14×0.01 named `ROOM_lobby` material `floor` at z 0.011. `make_counter` (3×0.8×1.1 `teal`) at (2, 6); sofa area: `sofa_1` at (6.6, 1.6) rotation 0 (faces +Y), `sofa_2` at (6.6, 3.6) rotation 180°, `make_coffee_table` at (6.6, 2.6) — the whole group (x 5.6-7.6, y 1.15-4.05) stays east of the `CAM_lobby` (4,2) → `CHARACTER_SPAWN` (7,6) sightline (at y 4.05 that line is at x 5.54 < sofa edge 5.6), so the 0.85 m sofa backs never hide the character's legs in the lobby render; 2 `make_plant` at (0.6, 0.6) and (7.4, 13.4).
  - `ROOM_meeting_a`: x 8-14, y 8-14; glass walls (`KIT_wall_glass_1m`) along x=8 (y 8..14) and y=8 (x 8..14), `KIT_wall_door` at (8, 9) rotation 90°; area mesh `ROOM_meeting_a` 6×6; `make_meeting_table` at (11, 11); 6 `make_chair` around it; `make_whiteboard` on y=13.9 centred x=11 + `TASK_board` empty at (11, 13.9, 1.5).
  - `ROOM_workstation_a`: x 8-20, y 0-8; area mesh 12×8; 8 `make_desk` at x=9.5+2.5*i (i 0..3), y=2 (rotation 0) and y=6 (rotation 180°), each with `make_chair` and `make_monitor`; `TASK_desk_<n>` empty at desk centre z 0.75 (n = 1..8, row y=2 first).
  - Corridor x 14-20, y 8-14 open; `STAIR_core`: 16 step boxes `stair_step_<i>` 3×0.25×0.2 (x 16-19) rising from y=9 along +Y, step i (1..16) at y = 9 + 0.25·(i−1), top at z = 0.2·i, so the run ends at y=13, z=3.2 exactly inside the 3×4 m slab void (x 16-19, y 9-13) from todo 3; core wall `wall_stair_core` `red` 3×0.15×3.2 centred at y=13.075 (just beyond the last step, inside the corridor, no overlap); Floor 1 only.
  - Colliders in `FLOOR_1`: `COL_wall_<side>` one box per straight perimeter run, `COL_wall_meeting_x8`, `COL_wall_meeting_y8`, `COL_desk_<n>`, `COL_counter`, `COL_sofa_<i>`, `COL_stair` (ramp box), `COL_table_meeting` — all `hide_render=True`, `display_type='WIRE'`. Every furniture collider box = exactly the furniture's footprint × height (e.g. `COL_sofa_<i>` 2.0×0.9×0.85 at the sofa's location/rotation, `COL_desk_<n>` 1.6×0.8×0.77 — the desk top is 1.6×0.8 and the desk is 0.77 m tall, todo 5), never padded — padding would put `COL_sofa_2` on the lobby sightline (todo 15 ray_cast skips `COL_` hits, but keep them tight anyway).
  - Empties: `NAV_spawn_lobby` at `CHARACTER_SPAWN` = (7, 6, 0) rotation_z radians(−37) (inside the lobby camera's cone; forward = local −Y after glTF import, rotated to face the lobby camera — prompt step 12 "render lobby dengan karakter" needs the character visible and its face readable); `NAV_cam_floor1` at `CAM_TARGETS["lobby"][0]`; `NAV_cam_iso` at `CAM_TARGETS["iso"][0]`; `NAV_cam_workstation` at `CAM_TARGETS["workstation"][0]`; `NAV_wp_lobby` (7,6,0), `NAV_wp_meeting_a` (11,11,0), `NAV_wp_workstation_a` (14,4,0).
  - All Floor 1 objects use `get_collection("FLOOR_1")` (never a clearing call — the slab from `build_massing` must survive).
- Register `check_floor1`: names above exist; `TASK_desk_*` = 8; 3 `NAV_wp_*`; every `KIT_*` in `KIT_BPY` has `obj.data.users ≥ 2` unless in `KIT_UNUSED_OK`; negative hook: `check_floor1` reads `os.environ.get("HQ_INJECT_MISSING_NAV") == "1"` and deletes `NAV_wp_lobby` before the checks (`build_hq --inject-missing-nav` just sets that env var; `hq_lib` is not edited here).
- Standalone test (after todo 3 accepted): `(cd "$R" && blender -b --python-exit-code 1 --python-expr "import sys;sys.path.insert(0,'apps/assets/blender');import hq_lib,hq_massing,hq_floor1;hq_lib.reset_startup_scene();hq_lib.clear_project_collections();hq_massing.build_exterior();hq_massing.build_massing();hq_floor1.build_kit_bpy();hq_floor1.build_floor_1();hq_lib.run_self_checks();import bpy;bpy.ops.wm.save_as_mainfile(filepath='/tmp/hq_scratch_t4.blend')") > …/13-build-t4.txt 2>&1; echo EXIT=$? >> …/13-build-t4.txt`.

**Must NOT do**
- No Meshy. No unique mesh per repeated wall (linked duplicates mandatory). No boolean modifiers. No names outside the regexes. Do not edit `hq_lib.py`/`hq_massing.py` (owned by todo 3); if a helper is missing, add it to `hq_floor1.py` and flag for todo 8.

**Parallelization:** Wave 1b — authoring parallel with 5,6 after 2; acceptance run only after 3 (`…/10-build-t3.txt` EXIT=0). Blocks 8.

**References**
- Guide §4 L119 grid, §6 L192-203, §7.3 P0 L234, §7.4 L243-245; HANDOFF.md L15 (`NAV_wp_<room_id>`, sofa area); §4.1 red accent L144; todo 3 `CAM_TARGETS`/`CHARACTER_SPAWN`/helpers; todo 5 signatures.

**Acceptance criteria**
- `…/13-build-t4.txt` EXIT=0 with `SELF_CHECK OK`; `blender -b /tmp/hq_scratch_t4.blend --python-exit-code 1 --python-expr "import bpy;print('OUT',sorted(o.name for o in bpy.data.objects if o.name.startswith(('ROOM_','NAV_','TASK_','COL_','KIT_'))))" | grep '^OUT ' | sed 's/^OUT //' > …/14-names.txt` (non-empty) contains each of `ROOM_lobby ROOM_meeting_a ROOM_workstation_a NAV_spawn_lobby NAV_cam_floor1 NAV_cam_iso NAV_cam_workstation NAV_wp_lobby NAV_wp_meeting_a NAV_wp_workstation_a TASK_board TASK_desk_1 … TASK_desk_8 KIT_wall_1m KIT_wall_glass_1m KIT_wall_door KIT_floor_1m KIT_pillar` exactly once.

**QA scenarios**
- Happy: `blender -b /tmp/hq_scratch_t4.blend --python-exit-code 1 --python-expr "import bpy;print('OUT',bpy.data.objects['KIT_wall_1m'].data.users)" | grep '^OUT ' | sed 's/^OUT //'` ≥ 10.
- Failure: same standalone command with the env var INSIDE the subshell — `(cd "$R" && HQ_INJECT_MISSING_NAV=1 blender -b --python-exit-code 1 --python-expr "…")` (an env assignment cannot prefix a `( … )` subshell in bash) → EXIT≠0 with `AssertionError` (`…/15-selfcheck-nav-negative.txt`).

**Commit:** none unless asked; suggested `feat(assets): Floor 1 layout, bpy kit, colliders, NAV/TASK`.

- [x] 5. `hq_furniture.py`: desk, chair, monitor, meeting table, whiteboard, plant, sofa, counter, coffee table + headless test

**What to do**
- Create `apps/assets/blender/hq_furniture.py` (imports `hq_lib` only). Each builder signature `make_<item>(name, location, rotation_z, collection, **kw) -> bpy.types.Object`, builds parts with bmesh into ONE mesh (single object, multiple material slots), flat shaded, origin at base-centre:
  - `make_desk`: top 1.6×0.8×0.04 `desk_top` at z 0.73; 4 legs 0.05×0.05×0.73 `wood`. ≤ 60 tris.
  - `make_chair`: seat 0.45×0.45×0.06 `teal` at z 0.45; back 0.45×0.06×0.45 at z 0.51; column cylinder r0.03 h0.42 `dark`; 5-spoke base = cylinder r0.25 h0.03 (8 segments) `dark`. ≤ 120 tris.
  - `make_monitor`: panel 0.55×0.03×0.33 `dark` at z 1.0 centred; stand cylinder r0.02 h0.2; foot 0.2×0.15×0.02; screen plane 0.5×0.28 on the front face material `screen` with emission strength 0.3. ≤ 60 tris.
  - `make_meeting_table`: top 2.4×1.2×0.04 `desk_top` at z 0.73; 2 pedestal cylinders r0.15 h0.73 `dark`. ≤ 80 tris.
  - `make_whiteboard(width=3.0)`: board width×0.05×1.2 `#FFFFFF` (add `"white": "#FFFFFF"` locally via `get_material`) at z 0.9-2.1; frame bars `dark`. ≤ 40 tris.
  - `make_plant`: pot cylinder r0.2 h0.35 (8 seg) `wood`; foliage icosphere subdiv 1 r0.35 `leaf` at z 0.6. ≤ 120 tris.
  - `make_sofa`: seat 2×0.9×0.45 `orange`; back 2×0.2×0.4 at rear (total height 0.85); 2 arms 0.2×0.9×0.6; footprint 2.0 (x) × 0.9 (y) centred on `location`, rear (back) on the −Y side at rotation 0. ≤ 48 tris.
  - `make_counter`: 3×0.8×1.1 `teal` + top slab 3.1×0.9×0.04 `desk_top`. ≤ 24 tris.
  - `make_coffee_table`: 1×0.6×0.04 top at z 0.4 `wood` + 4 legs. ≤ 60 tris.
- Create `apps/assets/blender/tests/test_furniture.py` (headless): imports modules, builds one of each into a scratch collection, asserts per item: bbox z-min within ±0.005 of 0, heights (desk 0.70-0.78, chair 0.85-1.0, monitor top 1.15-1.4, table 0.70-0.78, whiteboard top 2.0-2.2, plant 0.8-1.1, sofa 0.8-0.9, counter 1.1-1.2, coffee table 0.38-0.44), tris ≤ 400 each, exactly one object per builder; env `HQ_TEST_BREAK_DESK=1` makes the desk 1.5 m tall (negative hook); prints `FURNITURE OK` or raises.

**Must NOT do**
- No bevel/subsurf/boolean; no textures; no `bpy.ops` primitives; no Meshy furniture; do not edit other modules.

**Parallelization:** Wave 1b — authoring parallel with 4,6 after 2; acceptance run only after 3. Blocks 8.

**References**
- Guide §4 L113-121 (props snap 0.8-1 m), §4.1 L142 (fun props), §8.2 L263 (whiteboard/desk anchors); todo 3 helpers (`make_box` etc.; if todo 3 is not merged yet, implement a private `_box()` via bmesh and reconcile in todo 8).

**Acceptance criteria**
- `(cd "$R" && blender -b --python-exit-code 1 -P apps/assets/blender/tests/test_furniture.py) > …/16-furniture-test.txt 2>&1; echo EXIT=$? >> …/16-furniture-test.txt` → EXIT=0 and `FURNITURE OK`; `(cd "$R" && HQ_TEST_BREAK_DESK=1 blender -b --python-exit-code 1 -P apps/assets/blender/tests/test_furniture.py)` (env var inside the subshell) → `…/17-furniture-negative.txt` EXIT≠0.

**QA scenarios**
- Happy: `grep -c 'FURNITURE OK' …/16-furniture-test.txt` = 1.
- Failure: `grep -c AssertionError …/17-furniture-negative.txt` ≥ 1.

**Commit:** none unless asked; suggested `feat(assets): procedural furniture builders + test`.

- [x] 6. `hq_lighting.py` (sun, world, cameras) + `render_hq.py` headless renderer with objective stats

**What to do**
- Create `apps/assets/blender/hq_lighting.py` (imports `hq_lib` only; no NAV lookups):
  - `build_lighting(phase="day")` → collection `LIGHTING`: Sun `SUN_main` (day: color `#FFFFFF`, `energy = 4.0` — comment: guide intensity 1.4 is the R3F value, Blender W/m² mapping chosen so mid-grey reads ~0.5 lum; `angle = radians(2)`; rotation (radians(50), 0, radians(35)); `use_shadow_jitter = True` if probe says it exists); interior fill: one AREA light per Floor-1 room — `LIGHT_area_lobby` at (4, 7, 2.9), `LIGHT_area_meeting` at (11, 11, 2.9), `LIGHT_area_workstation` at (14, 4, 2.9) (z 2.9 — 10 cm below the Floor-2 slab underside at z 3.0, never flush with it), each `shape='SQUARE'`, `size=4.0`, `energy=150` W, colour `#FFF8F0`, pointing −Z (the eye-level views sit under the Floor-2 slab and would otherwise fail the `mean_lum > 0.15` gate; night: energy 40); World nodes: `Texture Coordinate(Generated) → Separate XYZ(Z) → ColorRamp(pos0 = bottom hex, pos1 = top hex) → Background(strength 1.0)`; day ramp `#E3F4FC`→`#BFE3F7`; night: sun `#5C6BC0` energy 0.7, ramp `#0D1B2A`→`#1A237E`, and `get_material("glass")` emission `#FFF3C4` strength 2.0 (day: emission 0). Eevee: `scene.eevee.taa_render_samples = 32`; `use_shadows = True` / `use_gtao = True` each guarded by `hasattr`.
  - `build_cameras()` → collection `CAMERAS`: for each key in `CAM_TARGETS`: camera `CAM_<key>` at position, type `ORTHO` with `ortho_scale` or `PERSP` with `lens` mm, aimed by a `TRACK_TO` constraint to empty `TGT_<key>` at target (`track_axis='TRACK_NEGATIVE_Z'`, `up_axis='UP_Y'`). `scene.camera = CAM_iso`. Register `check_lighting` (`SUN_main` + 3 `LIGHT_area_*` exist, all `CAM_*` from `CAM_TARGETS` exist).
- Create `apps/assets/blender/render_hq.py`: args after `--`: `--views a,b,c`, `--out <dir>` (resolved against `REPO_ROOT` if relative), `--phase day|night` (default day; calls `build_lighting(phase)` — rebuilds only `LIGHTING` collection + world), `--res 1280x720`, `--samples 32`, `--tag <str>` (optional), `--hide COLL1,COLL2` (sets `hide_render=True` on those collections for this run only; never saves). For each view: assert `CAM_<view>` exists else print `unknown view <view>` and `sys.exit(2)`; set `scene.camera`, `filepath = <out>/<blendstem>[_<tag>]_<view>[_night].png`, `bpy.ops.render.render(write_still=True)`, then reload the PNG with `img = bpy.data.images.load(path)`, copy the buffer ONCE (`px = array.array('f', bytes(4*w*h*4)); img.pixels.foreach_get(px)` — per-element `img.pixels[i]` copies the whole buffer on every access and would blow the 600 s timeout), stride every 16th pixel over the flat RGBA array, values are display sRGB floats 0-1 (byte PNG, not linearised): `mean_lum` (0.2126R+0.7152G+0.0722B), `red_ratio` (pixels with |RGB − (0.898,0.224,0.208)| each < 0.12), `unique_colors` (8-bit quantised set size); then `bpy.data.images.remove(img)`. Print `RENDER OK <path>` and `STATS <view> mean_lum=<x:.3f> red_ratio=<y:.3f> unique_colors=<n>`. Exit 1 if any gate fails (`0.15 < mean_lum < 0.9`, `red_ratio < 0.08`, `unique_colors > 200`) — gates can be relaxed per view via `--no-gate` only for diagnostic runs (never for QA evidence). Exception: `--phase night` renders may use `--no-gate` as QA evidence provided the QA file asserts `unique_colors > 200` from the STATS line (night `mean_lum` is legitimately < 0.15).
- Smoke (after todo 3 accepted): build scratch with todo 3 + this (`python-expr` like todo 4 but `hq_lib.reset_startup_scene(); hq_lib.clear_project_collections(); hq_massing.build_exterior(); hq_massing.build_massing(); hq_lighting.build_lighting("day"); hq_lighting.build_cameras()` — `build_cameras()` is mandatory, otherwise BL_RENDER exits 2 on `unknown view iso` — with `--python-exit-code 1`) → `/tmp/hq_scratch_t6.blend`; BL_RENDER(`/tmp/hq_scratch_t6.blend`, iso) → `…/18-render-smoke.txt` EXIT=0; `read apps/assets/blender/renders/hq_scratch_t6_iso.png` and note "scene visible" in `…/18-qa-iso.md` with the STATS line.

**Must NOT do**
- No Cycles. No viewport screenshot. No `look`. No import of `build_hq` (import-time rebuild hazard). No saving in `render_hq.py`. No per-element `Image.pixels` indexing.

**Parallelization:** Wave 1b — authoring parallel with 4,5 after 2; smoke/acceptance only after 3. Blocks 8.

**References**
- Guide §4.1 L145-147, §9 L298-300; HANDOFF.md L16; `…/02b-api-probe.txt`; probe: headless Eevee OK; Blender API: `TrackToConstraint`, `Image.pixels` (sequence of floats, RGBA).

**Acceptance criteria**
- `…/18-render-smoke.txt` EXIT=0 with `RENDER OK` and a `STATS iso` line within gates; `file apps/assets/blender/renders/hq_scratch_t6_iso.png` → `PNG image data, 1280 x 720`; `…/19-render-negative.txt` from BL_RENDER(…, `nonexistent`) EXIT=2 with `unknown view`.

**QA scenarios**
- Happy: `grep -E 'STATS iso mean_lum=0\.[1-8]' …/18-render-smoke.txt` → 1 match.
- Failure: render with `--phase night --no-gate` → STATS mean_lum < 0.15 expected (proves stats respond to lighting), recorded in `…/18b-render-night-smoke.txt`.

**Commit:** none unless asked; suggested `feat(assets): lighting, cameras, headless render script`.

- [x] 7. Meshy style reference images (2 paid calls) + prompt preset file

**What to do**
- Write `apps/assets/raw/meshy/PROMPTS.md`: `STYLE_PRESET = "stylized mid-poly 3D game asset, clean hand-painted textures, sharp edges, no noise, no blur, pastel office palette (#FFF8F0 walls, #D9D4CB floor, #FFB74D orange and #4DB6AC teal accents, small #E53935 red details), soft daylight, white background, single object centered"`; piece prompts: `KIT_wall_1m` = `"modular office wall panel 1 m wide 3.2 m tall 0.15 m thick, flat front and back, pastel cream, " + STYLE_PRESET`; `KIT_wall_door` = `"modular office wall panel 1 m wide 3.2 m tall with a closed orange wooden door and thin frame, " + STYLE_PRESET`; `KIT_floor_1m` = `"square modular office floor tile 1 m by 1 m, 0.1 m thick, light grey stylized carpet texture, " + STYLE_PRESET`; `KIT_pillar` = `"square structural pillar 0.3 m by 0.3 m, 3.2 m tall, cream, " + STYLE_PRESET`; `CHARACTER` = `"friendly adult office worker, humanoid, realistic-stylized proportions, 1.7 m tall, T-pose, short hair, teal shirt, dark trousers, sneakers, expressive face with modeled eyes and mouth, " + STYLE_PRESET`.
- Ledger before. Call 1: `meshy_text_to_image(ai_model="nano-banana-2", prompt="style sheet: " + STYLE_PRESET + ", showing a wall panel, a floor tile and a door side by side", aspect_ratio="16:9")` (6 cr) → `meshy_get_task_status(wait=true)` → `meshy_download_model(task_id, save_to="<R>/apps/assets/raw/meshy/style_reference_kit.png")` (image tasks save their own file; `format` ignored). Call 2: `meshy_image_to_image(ai_model="nano-banana-2", input_task_id=<call 1 id>, prompt="only the office worker character in the same style, full body, T-pose, white background", aspect_ratio="1:1")` (6 cr) → wait → save `style_reference_character.png`. Record both `task_id`s in `PROMPTS.md` (`REF_KIT_TASK_ID=`, `REF_CHAR_TASK_ID=`) — URLs are fetched fresh from `meshy_get_task_status` at use time: the image URL is the FIRST element of its `image_urls` list (Verification strategy "Reference image freshness"). Ledger after (delta ≤ 12). Precondition: `…/25-checkpoint-2a.md` contains `IMAGE_MODEL_CONFIRMED: nano-banana-2` (or the model the user named) — the 2a message asks this explicitly (MCP Rule 1).
- `read` both PNGs; if photo-realistic/noisy (fails §4), ONE regenerate allowed per image (6 cr each, within cap); note in ledger.

**Must NOT do**
- No 3D generation here. No REST unless the MCP call returns a schema/auth error and dedupe shows no task.

**Parallelization:** Wave 3 — after checkpoint 2a (todo 9), parallel with 11. Blocks 10, 14.

**References**
- Meshy MCP cost table (`meshy_text_to_image`, `meshy_image_to_image` nano-banana-2 = 6 cr); guide §4.1 palette; draft "Scope change" params; MCP Rule 1 (model announced as default in ledger header, todo 2).

**Acceptance criteria**
- `test -s apps/assets/raw/meshy/style_reference_kit.png && test -s apps/assets/raw/meshy/style_reference_character.png`; `grep -c 'REF_KIT_TASK_ID=' apps/assets/raw/meshy/PROMPTS.md` = 1 and `REF_CHAR_TASK_ID=` = 1; ledger rows for both calls with `before − after == delta`; cumulative ≤ 24 for this todo.

**QA scenarios**
- Happy: `file apps/assets/raw/meshy/style_reference_*.png | grep -c PNG` = 2.
- Failure: a task returns FAILED → ledger notes refund, retry once; second failure → STOP and report.

**Commit:** none (raw assets; sizes noted in HANDOFF).

- [x] 8. Assemble Floor 1 end-to-end, final `self_check`, `hq_v01.blend`, v01 renders + QA

**What to do**
- Wire modules in `build_hq.py` `main()`: `reset_startup_scene(); clear_project_collections(); build_exterior(); build_massing(); build_kit_bpy(); build_floor_1(); build_lighting("day"); build_cameras()`; remove `_stub_furniture()` from `hq_floor1.py`; reconcile any duplicated private helpers into `hq_lib.py`; ensure every module registers its checks in `SELF_CHECKS`.
- BL_BUILD(`apps/assets/blender/hq_v01.blend`) → `…/20-build-v01.txt` EXIT=0, `SELF_CHECK OK`. Record the live scene state (`blender_get_scene_info(fields=["settings"])` → `…/21a-live-before.txt`); if unsaved/default or an `hq_vNN.blend`: MCP parity `blender_execute_blender_code(code="p='<abs>/build_hq.py'; exec(open(p).read(), {'__name__':'__main__','__file__':p})", user_prompt=<user verbatim>)` then `blender_get_scene_info(fields=["details","hidden"], root="FLOOR_1", limit=60)` → `…/21-mcp-floor1.txt` (the MCP run has no `--save`, so `hq_v01.blend` is written only by headless). Else STOP and ask.
- BL_RENDER(`hq_v01.blend`, `iso,lobby,workstation`) day → `…/22a-render-v01-day.txt`, 3 PNGs + STATS; BL_RENDER(`hq_v01.blend`, `iso`, `--phase night`) → `…/22b-render-v01-night.txt`, `hq_v01_iso_night.png` (night gate: only `unique_colors > 200`; `mean_lum` may be < 0.15 — pass `--no-gate` and record STATS).
- `read` all 4 PNGs; write `…/22-qa-v01.md` with the §4 checklist per day view (5 rows × 3) + STATS lines + night note. Iterate (fix builder → BL_BUILD → BL_RENDER with `--tag r<k>`) up to 3 rounds until all PASS; keep each round's PNGs.
- Polycount per collection: `blender -b apps/assets/blender/hq_v01.blend --python-exit-code 1 --python-expr "import sys;sys.path.insert(0,'apps/assets/blender');import hq_lib;print('OUT',repr(hq_lib.count_tris_by_collection()))" | grep '^OUT ' | sed 's/^OUT //' > …/23-polycount-v01.txt` (non-empty).
- Reproducibility: BL_BUILD(`/tmp/hq_v01_repro.blend`); define `NAMES(blend)` = `blender -b <blend> --python-exit-code 1 --python-expr "import bpy;print('OUT',sorted(o.name for o in bpy.data.objects))" | grep '^OUT ' | sed 's/^OUT //'`; `NAMES(apps/assets/blender/hq_v01.blend) > …/24a-names-v01.txt; NAMES(/tmp/hq_v01_repro.blend) > …/24b-names-repro.txt; diff …/24a-names-v01.txt …/24b-names-repro.txt > …/24-repro-diff.txt` → empty AND `test -s …/24a-names-v01.txt` (an empty capture would make the diff trivially empty).

**Must NOT do**
- No Meshy objects in v01 (no `--with-kit`). No manual edits saved into the `.blend` that are not in the scripts. Do not overwrite `hq_v01.blend` after checkpoint 2a approval.

**Parallelization:** Wave 2, after 3-6. Blocks 9.

**References**
- Guide §4 checklist L131-136, §1 MUST 4-6, §7.1 steps 3-6; todo 3-6 outputs; Verification strategy (MCP parity rule, STATS gates).

**Acceptance criteria**
- `test -s apps/assets/blender/hq_v01.blend`; 4 PNGs 1280×720; `…/22-qa-v01.md` final round: 15 PASS, 0 FAIL, every PASS row cites a STATS value where a gate exists; `…/20-build-v01.txt` EXIT=0; `…/24-repro-diff.txt` empty with `24a` non-empty; `grep -c FURNITURE_STUB …/20-build-v01.txt` = 0; `md5sum apps/assets/blender/hq_v01.blend > …/24c-v01-md5.txt` (frozen reference for F4).

**QA scenarios**
- Happy: `grep -c PASS …/22-qa-v01.md` ≥ 15 and final-section `grep -c FAIL` = 0; `grep -E 'STATS (iso|lobby|workstation) ' …/22a-render-v01-day.txt` → 3 lines within gates.
- Failure: any FAIL after 3 rounds → STOP, present to the user at checkpoint 2a with the failing rows named (do not silently continue).

**Commit:** none unless asked; suggested `feat(assets): hq_v01 Floor 1 baseline`.

- [x] 9. ⏸ CHECKPOINT 2a — present v01 renders + QA checklist, wait for user approval

**What to do**
- Message to user (Indonesian): paths of the 4 PNGs (and say they can be opened), the `22-qa-v01.md` checklist summary, polycount from `23`, credits used so far (ledger), and the explicit questions: `Approve hq_v01 untuk lanjut FASE 2b? (approve / revisi: <apa>)` AND `FASE 2b akan pakai model gambar nano-banana-2 untuk 2 gambar referensi style (6 kr/gambar, + maks 2 regenerate = ≤ 24 kr), lalu Meshy t2.5 untuk kit (5 kr preview + 10 kr refine per potongan). Setuju model gambar nano-banana-2, atau ganti (nano-banana 3 kr / nano-banana-pro 9 kr)?` (MCP Rule 1 — the paid image model must be confirmed by the user before todo 7).
- STOP. Do not start todo 7/10/11 until the user's reply in a HUMAN turn contains approval (`approve`, `ok`, `lanjut`, `setuju`) or revision requests (then loop todo 8 with the requested change, re-present). Record `IMAGE_MODEL_CONFIRMED: <model>` from the reply (silence on the model = `nano-banana-2` ONLY if the reply approves 2b overall; otherwise ask again).

**Must NOT do**
- No Meshy generation before approval. No assumption of approval.

**Parallelization:** Wave 2, sequential. Blocks 7, 10, 11.

**References**
- MVP-2 prompt step 5 "⏸ CHECKPOINT: tunjukkan render + checklist QA §4, iterasi sampai saya approve"; Meshy MCP Rule 1.

**Acceptance criteria**
- `…/25-checkpoint-2a.md` records the presented message and, after reply, the user's verbatim approval line + timestamp + `IMAGE_MODEL_CONFIRMED: <model>`.

**QA scenarios**
- Happy: `grep -c 'USER_APPROVED_2A' …/25-checkpoint-2a.md` = 1 (worker writes this token only after approval).
- Failure: user asks revision → file gets `REVISION_REQUESTED: <text>`; todo 8 reopened; token absent until re-approval.

**Commit:** none.

- [x] 10. Generate 3-4 Meshy kit pieces (Smart Topology t2.5 + refine, shared reference) → `apps/assets/raw/meshy/kit/`

**What to do**
- For each piece in order `KIT_wall_1m`, `KIT_wall_door`, `KIT_floor_1m`, then `KIT_pillar` only if ledger total after 3 pieces ≤ 200:
  1. `meshy_check_balance` → ledger row (before).
  2. **Preview first:** `meshy_text_to_3d(prompt=<piece prompt from PROMPTS.md>, model_type="smart-topology", ai_model="meshy-t2.5", target_polycount=1500, origin_at="bottom", target_formats=["glb"], alpha_thumbnail=true)` (5 cr) → `meshy_get_task_status(wait=true)` → `curl -s -o …/30-thumb-<piece>-preview.png <thumbnail_url>` → `read`. Reject (not a flat panel/tile, ornaments, wrong proportions) → regenerate the PREVIEW only (5 cr, counts toward 6 kit generations). Accept → step 3.
  3. Fresh ref URL: `meshy_get_task_status(<REF_KIT_TASK_ID>)` → first element of `image_urls`. `meshy_text_to_3d_refine(preview_task_id=<id>, texture_image_url=<fresh url>, texture_resolution="2k", enable_pbr=false, target_formats=["glb"])` (10 cr; no `texture_prompt` alongside; if the ref URL is unavailable → `texture_prompt=STYLE_PRESET` and ledger `REF_URL_EXPIRED`) → wait.
  4. `meshy_download_model(task_id=<refine id>, format="glb", save_to="<R>/apps/assets/raw/meshy/kit/<piece>.glb", include_textures=true)`; thumbnail → `…/30-thumb-<piece>.png`.
  5. `meshy_check_balance` → ledger row (after). Append to `…/30-kit-tasks.md`: piece, preview id, refine id, reported polycount, file size, generation count so far.
- Definition: one "kit generation" = one `meshy_text_to_3d` PREVIEW call (accepted or rejected); refines do not count. Stop conditions: ledger total > 300 OR kit generation count > 6 → STOP, ask the user.
- Error handling per Verification strategy (dedupe via `meshy_list_tasks` before any retry; REST only on schema/auth error). Texture downscale to ≤ 1024² happens in `normalize_kit.py` (todo 11), not here.

**Must NOT do**
- No image-to-3d, no meshy-7.1, no 4k/8K for kit, no PBR, no auto_size. No kit piece imported into the scene here (todo 12). No `.blend` change. No refine of a rejected preview.

**Parallelization:** Wave 3 — after 7, parallel with 11. Blocks 12.

**References**
- Meshy MCP cost table + `meshy_text_to_3d`/`_refine` schemas (system prompt); guide §3 Hybrid Meshy L96 (kit pieces list), §7.1 6a L216; `apps/assets/raw/meshy/PROMPTS.md` (todo 7); draft decisions (kit sizes).

**Acceptance criteria**
- 3 or 4 files `apps/assets/raw/meshy/kit/KIT_*.glb` each > 10 KB; `…/30-kit-tasks.md` rows = files; ledger total ≤ 300 and kit generations ≤ 6; `ls -la apps/assets/raw/meshy/kit > …/31-kit-files.txt`.

**QA scenarios**
- Happy: `ls apps/assets/raw/meshy/kit/*.glb | wc -l` ∈ {3,4}; each `python3 -c "import struct,sys;f=open(sys.argv[1],'rb');assert f.read(4)==b'glTF'" <file>` exit 0.
- Failure: task status FAILED → ledger notes refund, retry once; second FAILED for the same piece → skip piece, continue with the rest, flag in HANDOFF.

**Commit:** none (raw assets).

- [x] 11. `normalize_kit.py`: import, scale-to-grid, pivot, remesh/auto-smooth, material fallback, rename

**What to do**
- Create `apps/assets/blender/normalize_kit.py` with `normalize_kit_piece(glb_path, piece_name, target_size, collection_name="KIT_MESHY") -> (bpy.types.Object, dict)`; `piece_name` is the Meshy-side name `KIT_meshy_<piece>` (never the bpy source name `KIT_<piece>` — object names are global and the bpy source already exists):
  - Headless `bpy.ops` need explicit context: before the import record `set(bpy.data.objects)`; after import the new objects = difference; `bpy.ops.object.select_all(action='DESELECT')`, `select_set(True)` on each new mesh, `bpy.context.view_layer.objects.active = first`; then `bpy.ops.object.join()` (if > 1 mesh) and `bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)`; delete leftover non-mesh imports (empties/lights/cameras from the glTF).
  - Scale: compute bbox dims; uniform scale factor = `target_size.z / dims.z` for walls/pillar, `target_size.x / dims.x` for floor; apply; then non-uniform snap: if any dim deviates > 5 % from target, set that axis scale so dims == target (record `nonuniform=True`).
  - Pivot: origin to bbox bottom-centre (x,y centre, z min) and move object to (0,0,0).
  - Edge clean-up (prompt step 7 "rapikan seam tepi"): bmesh `bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)`; then every vertex within 2 mm of a bbox face plane (x = ±target.x/2, y = ±target.y/2, z = 0 or target.z) is snapped exactly onto that plane so tiles/panels butt without gaps; record `snapped_verts`.
  - Topology: if tris > 1500 → Decimate modifier `COLLAPSE` (keeps UVs) to ratio `1500/tris`, apply (modifier apply needs the object active — same selection setup); voxel Remesh is allowed ONLY when `fallback=True` (texture already dropped). Smoothing: `mesh.shade_smooth()` then `mesh.set_sharp_from_angle(angle=radians(30))` (names per `02b-api-probe.txt`; if absent, leave flat and record `smooth=False`).
  - Texture: find image nodes in the imported materials; if the base-colour image exists and is ≥ 512² → keep, and if > 1024² → `img.scale(1024, 1024); img.pack()`, then verify by `img.reload()`-free check `tuple(img.size) == (1024, 1024)` and `img.packed_file is not None`; record `texture_size`. Else create a palette material via `get_material` from `hq_lib` and set `fallback=True` (palette material, never vertex colours).
  - Rename object + mesh to `piece_name`; link to collection `KIT_MESHY` (collection `hide_render=True` for sources). Return `(object, {"tris": n, "dims": [...], "nonuniform": bool, "fallback": bool, "smooth": bool, "texture_size": [w,h], "snapped_verts": n})`; the caller writes `apps/assets/blender/renders/kit_metrics.json`.
- CLI: `blender -b --python-exit-code 1 -P apps/assets/blender/normalize_kit.py -- --glb <path> --name KIT_meshy_wall_1m --size 1,0.15,3.2 --save /tmp/kit_test.blend` prints `NORMALIZE OK <json>`; missing file → `FileNotFoundError`, exit ≠ 0.
- Test with the pre-existing `apps/assets/models/building.glb` as a stand-in (read-only input; scale to 1×0.15×3.2) → `…/32-normalize-test.txt` EXIT=0 (validates the pipeline only; real pieces in todo 12).

**Must NOT do**
- No edits to `apps/assets/models/*`. No Meshy calls. No smoothing > 30°. No voxel remesh on textured pieces.

**Parallelization:** Wave 3 — parallel with 7 and 10. Blocked by 9. Blocks 12.

**References**
- Guide §7.1 6a L216; §4 texture rules (todo 1 revision: kit ≤ 1024²); `…/02b-api-probe.txt`; Blender API: `bpy.ops.import_scene.gltf`, `Mesh.shade_smooth`, `Mesh.set_sharp_from_angle`, `DecimateModifier`, `Image.scale`, `Image.pack`.

**Acceptance criteria**
- `…/32-normalize-test.txt` EXIT=0 and `NORMALIZE OK` with `"dims": [1.0, 0.15, 3.2]` (±0.01) and z-min 0.

**QA scenarios**
- Happy: `grep -c 'NORMALIZE OK' …/32-normalize-test.txt` = 1.
- Failure: `--glb /nonexistent.glb` → EXIT≠0 with a clear `FileNotFoundError` (`…/33-normalize-negative.txt`).

**Commit:** none unless asked; suggested `feat(assets): normalize_kit.py for Meshy kit pieces`.

- [x] 12. Normalize real kit, stitch `ROOM_meeting_a_kit`, side-by-side render, metrics, `hq_v02.blend`

**What to do**
- New module `apps/assets/blender/hq_kit_room.py`: `build_kit_meshy()` (runs ONLY with explicit `--with-kit`; no auto-detect): for each expected piece file `RAW_MESHY_DIR/kit/KIT_<piece>.glb` call `normalize_kit_piece(path, "KIT_meshy_<piece>", size)` with sizes wall 1×0.15×3.2, door 1×0.15×3.2, floor 1×1×0.1, pillar 0.3×0.3×3.2 → objects `KIT_meshy_wall_1m`, `KIT_meshy_wall_door`, `KIT_meshy_floor_1m`, `KIT_meshy_pillar` in `KIT_MESHY`; write `RENDER_DIR/kit_metrics.json` keyed by piece with both names. Missing file → that piece falls back to the bpy kit source and is listed as `MISSING` in metrics.
- `build_room_meeting_kit()` → collection `FLOOR_1_KIT_TEST` at offset `(+30, 0, 0)`: a faithful copy of the meeting room's context so lighting/occlusion match — the same perimeter walls/windows around x 8-14 / y 8-14 shifted (+30), the same `LIGHT_area_meeting` duplicate (`LIGHT_area_meeting_kit`), and a ceiling slab `slab_kit_ceiling` 20×14×0.2 with its TOP at z 3.2 (location z 3.0, so its underside sits at z 3.0 exactly like `slab_floor_2` over the bpy room — identical lighting per prompt step 9) shifted (+30) placed in a CHILD collection `KIT_TEST_CEILING` (so `--hide KIT_TEST_CEILING` can lift it for the top-down compare render; `hide_render` False when saved); the room itself where ONLY solid walls, the door and the floor come from `KIT_MESHY` (`KIT_meshy_floor_1m` 6×6 = 36 tiles placed at location z −0.095 so their TOP is at z +0.005 — above the ground top (z −0.01) and above any slab/plate top (z 0), never coplanar — and furniture at z 0 stands on them with an invisible 5 mm sink; `KIT_meshy_wall_1m` for solid runs, `KIT_meshy_wall_door` at (38, 9)); glass sides stay bpy `KIT_wall_glass_1m` in BOTH rooms (there is no glass kit piece). Same furniture via bpy builders; area mesh `ROOM_meeting_a_kit` with `hide_render = True` (navigation/area marker only — at z 0.011 it would otherwise cover the Meshy tiles and the `meeting_kit`/`kit_compare` renders would show the bpy floor instead of the kit floor); `TASK_board_kit`; `COL_*_kit`; `NAV_wp_meeting_a_kit`.
- Cameras already exist from `CAM_TARGETS` (`meeting_bpy`, `meeting_kit`, `kit_compare` at (26,−22,14) → (26,11,1), 24 mm, centred between the two rooms); the `kit_compare` render passes `--hide FLOOR_2,FLOOR_3,FLOOR_4,KIT_TEST_CEILING` (render-only, not saved; `roof_top` is inside `FLOOR_4`, there is no `ROOF` collection) so both rooms are visible from above.
- BL_BUILD(`apps/assets/blender/hq_v02.blend`, `--with-kit`) → `…/40-build-v02.txt` EXIT=0; `check_kit_room`: every `KIT_meshy_*` dims within 1 % of targets, `ROOM_meeting_a_kit` exists and `ROOM_meeting_a_kit.hide_render is True`, every object in `FLOOR_1_KIT_TEST` whose `data is KIT_meshy_floor_1m.data` (excluding the source object itself, which sits in `KIT_MESHY` at the origin with z-max 0.1) has world z-max within ±0.002 of +0.005, every `KIT_MESHY` piece not in `KIT_UNUSED_OK` has `data.users ≥ 2`, `slab_kit_ceiling` in `KIT_TEST_CEILING`.
- BL_RENDER(`hq_v02.blend`, `meeting_bpy,meeting_kit`) day → `…/40a-render-v02-rooms.txt`, 2 PNGs (identical relative camera pose) + BL_RENDER(`hq_v02.blend`, `kit_compare`, `--hide FLOOR_2,FLOOR_3,FLOOR_4,KIT_TEST_CEILING`) → `…/40b-render-v02-compare.txt`, 1 PNG; `read` each; QA `…/41-qa-v02.md` (§4 rows + STATS + seam/gap/scale notes: gaps between tiles, double walls, texture seams at panel edges, scale vs furniture; the compare PNG must show BOTH rooms — row `both rooms framed` PASS/FAIL; row `kit floor visible` PASS only if the `meeting_kit` PNG shows the Meshy tile texture, not the bpy `floor` colour `#D9D4CB`).
- Metrics `…/42-kit-metrics.md`: per piece tris (raw vs normalized), texture size, fallback/smooth/nonuniform flags; room totals tris bpy vs kit; unique mesh datablocks per room (draw-call proxy); credits used for kit (ledger).

**Must NOT do**
- Do not modify `ROOM_meeting_a` (bpy). Do not change `hq_v01.blend`. Do not let `KIT_MESHY` pieces into `FLOOR_1`. Do not save with hidden collections.

**Parallelization:** Wave 4, after 10 and 11. Blocks 13.

**References**
- MVP-2 prompt steps 7-9 ("sudut & lighting identik"); guide §3 Hybrid Meshy, §4 anti-patterns L129; todo 4 meeting-room coordinates; todo 11 API; `CAM_TARGETS` in `hq_lib.py`.

**Acceptance criteria**
- `test -s apps/assets/blender/hq_v02.blend`; `md5sum apps/assets/blender/hq_v01.blend` equals `…/24c-v01-md5.txt` (write `…/43-v01-md5.txt`); `md5sum apps/assets/blender/hq_v02.blend > …/43b-v02-md5.txt` (frozen reference); 3 PNGs 1280×720 with STATS in gates; `…/41-qa-v02.md` complete incl. `both rooms framed` PASS and `kit floor visible` PASS; `…/42-kit-metrics.md` one row per kit piece + 2 room rows; `…/40-build-v02.txt` EXIT=0; render-only hiding did not leak into the save: `blender -b apps/assets/blender/hq_v02.blend --python-exit-code 1 --python-expr "import bpy;print('OUT',[(c,bpy.data.collections[c].hide_render) for c in ('FLOOR_2','FLOOR_3','FLOOR_4','KIT_TEST_CEILING')])" | grep '^OUT '` → all `False`.

**QA scenarios**
- Happy: `python3 -c "import json;d=json.load(open('apps/assets/blender/renders/kit_metrics.json'));assert all(v['tris']<=1500 for v in d.values())"` exit 0.
- Failure: a piece with `fallback=True` AND tris > 1500 after decimate → metrics row flagged `QUALITY_FAIL`; render still produced; flagged for checkpoint (not silently dropped).

**Commit:** none unless asked; suggested `feat(assets): hq_v02 kit-vs-bpy meeting room test`.

- [x] 13. ⏸ CHECKPOINT 2b — present side-by-side renders + metrics, wait for user verdict input

**What to do**
- Message (Indonesian): 3 PNG paths, `41-qa-v02.md` summary, `42-kit-metrics.md` table (tris, credits, seams/gaps/scale issues), question: `Lanjut FASE 2c karakter? Catatan awal Level 1 vs Level 2 Anda (final di 2d)?`. STOP and wait.
- Record reply in `…/45-checkpoint-2b.md` with token `USER_APPROVED_2B` or `REVISION_REQUESTED: <text>` (revision may trigger ≤ 2 more kit generations within caps → reopen 10/12).

**Must NOT do**
- No character generation before approval.

**Parallelization:** Wave 4, sequential. Blocks 14.

**References**
- MVP-2 prompt step 9 "⏸ CHECKPOINT: saya nilai. Maks 6 generate kit tanpa izin ulang."

**Acceptance criteria**
- `grep -c 'USER_APPROVED_2B' …/45-checkpoint-2b.md` = 1 before todo 14 starts.

**QA scenarios**
- Happy: token present.
- Failure: user asks more kit tries beyond 6 → worker asks for explicit new cap; records `CAP_EXTENDED_TO: <n>` only when the user states a number.

**Commit:** none.

- [x] 14. Generate 1 Meshy character (t2.5 smart-topology, t-pose, ≤ 20k tris) + refine 2k

**What to do**
- Ledger before; **preview first:** `meshy_text_to_3d(prompt=<CHARACTER prompt>, model_type="smart-topology", ai_model="meshy-t2.5", target_polycount=19500 (leaves the guide's 200-tri ring headroom under the 20k budget), pose_mode="t-pose", origin_at="bottom", target_formats=["glb"], alpha_thumbnail=true)` (5 cr) → wait → `curl` `thumbnail_url` + `alpha_thumbnail_url` from `meshy_get_task_status` to `…/50-char-thumb-<n>.png` → `read`; check: humanoid, T-pose, realistic-stylized proportions, face with eyes+mouth. Reject → regenerate the preview only (5 cr; max 3 character generations total). Accept → refine.
- Fresh ref URL = first element of `image_urls` from `meshy_get_task_status(<REF_CHAR_TASK_ID>)`; `meshy_text_to_3d_refine(preview_task_id, texture_image_url=<fresh url>, texture_resolution="2k", enable_pbr=false, target_formats=["glb"])` (10 cr; guide after todo 1: character texture ≤ 2048², so 2k not 4k) → wait → `meshy_download_model(format="glb", save_to="<R>/apps/assets/raw/meshy/char_base_raw.glb")`.
- Ledger after; `…/51-char-tasks.md` with ids, reported polycount, file size, generation count.

**Must NOT do**
- No rigging here (todo 15). No meshy-7.1, no 4k/8k unless the user re-authorizes in a later turn. No > 3 generations. No `multi_view_thumbnails` (not a text-to-3d parameter).

**Parallelization:** Wave 5, after 13. Blocks 15.

**References**
- Guide §5.1 L158-168 (1.7 m, T/A-pose, expressive face, ≤ 20k after todo 1), §7.2 L221-231; `PROMPTS.md` CHARACTER; Meshy MCP `pose_mode` note ("use t-pose when rigging").

**Acceptance criteria**
- `test -s apps/assets/raw/meshy/char_base_raw.glb`; `…/51-char-tasks.md` shows ≤ 3 generations; ledger total ≤ 300.

**QA scenarios**
- Happy: thumbnail `read` note in `51` says "T-pose humanoid, face visible".
- Failure: 3 generations all rejected → STOP, present thumbnails to user, ask for prompt revision (do not spend more).

**Commit:** none (raw asset).

- [x] 15. Import character, scale 1.7 m, place at `NAV_spawn_lobby`, rig + idle via Meshy, `hq_v03.blend`, lobby render

**What to do**
- Rig via Meshy: ledger before; `meshy_rig(input_task_id=<refine id>, height_meters=1.7)` (5 cr, includes walk+run) → wait → `meshy_download_model(task_id=<rig id>, task_type="rigging")` returns URLs → list them in `…/51c-rig-urls.txt`; curl the rigged GLB to `apps/assets/raw/meshy/char_base_rigged.glb` and walk/run GLBs to `char_walk.glb`, `char_run.glb` (FBX only if no GLB). Idle: `meshy_list_animations(search="idle", category="DailyActions")` → save JSON to `…/51b-idle-lookup.json` → pick the entry whose `key == "Idle"` → `meshy_animate(rig_task_id=<rig id>, action_id=<that id>)` (3 cr) → wait → `meshy_download_model(task_type="animation")` → URLs to `…/51c-anim-urls.txt`; curl GLB (or FBX) to `apps/assets/raw/meshy/char_idle.glb|fbx`. Ledger after each.
- `apps/assets/blender/import_character.py` (importable + CLI): `import_character(rigged_path, anim_path=None)`: import the RIGGED file with `bpy.ops.import_scene.gltf` (or `.fbx` when FBX), tracking new objects by set difference; do NOT join and do NOT apply transforms on a skinned rig; rename the armature object `CHAR_BASE`, its mesh child(ren) `CHAR_BASE_mesh` (join only if > 1 mesh and no shape keys, with explicit selection/active setup as in todo 11). Idle clip: import `anim_path` separately (Meshy animation GLBs normally include mesh + armature, so this would otherwise leave a duplicate character): take the imported armature's action (`animation_data.action`, else the first NLA strip's action), assert `set(bone names)` equals `CHAR_BASE`'s, set `CHAR_BASE.animation_data_create().action = act`, and — Blender 4.4+/5 slotted actions, probe key `AnimData.action_slot` — `if hasattr(ad, "action_slot") and act.slots: ad.action_slot = act.slots[0]` (without the slot the armature holds the action but does not move); then delete EVERY object the anim import created (and orphan armature/mesh data); rename the action `idle`; `scene.frame_end = int(act.frame_range[1])`; `mesh.shade_smooth(); mesh.set_sharp_from_angle(angle=radians(30))`; place the ARMATURE at `CHARACTER_SPAWN` (= `NAV_spawn_lobby` location/rotation; forward = local −Y after glTF import); link to collection `CHARACTERS`. Facing proof: `check_character` computes `fwd = (CHAR_BASE.matrix_world.to_3x3() @ Vector((0,-1,0))).normalized()` and `to_cam = (CAM_lobby.location − CHAR_BASE.location).normalized()` (xy only) and asserts `fwd.dot(to_cam) > 0.5` (the character faces the lobby camera; "wajah terbaca" cannot pass otherwise). Height: evaluate world bbox of `CHAR_BASE_mesh.evaluated_get(depsgraph)` at frame 1; if outside 1.65-1.75 → set `armature.scale` uniformly (not applied) and record. Tris of the mesh ≤ 20000 (if more: Decimate COLLAPSE to 19500 on the mesh, keep armature modifier first in the stack, note). Texture: assert base-colour image ≤ 2048² (downscale + pack if larger, verify size as in todo 11). Motion proof: `check_character` compares `CHAR_BASE.pose.bones[<hips/root bone>].matrix` at frame 1 vs the middle frame — must differ (unless `RIG_UNAVAILABLE`).
- Fallback: if rig/animate fails (non-biped/error): record `RIG_UNAVAILABLE: <reason>` in `…/51-char-tasks.md` and write `apps/assets/blender/renders/character_mode.txt` = `static` (rigged path writes `rigged`); `import_character(char_base_raw.glb)` static path: join allowed, apply transforms allowed, scale to 1.70 m, origin at feet, then set location/rotation to `CHARACTER_SPAWN` (unapplied, same facing rule); the single object is named `CHAR_BASE` (type MESH) and its own data is the height/tris/texture subject; continue (prompt step 11).
- `build_hq.py`: `build_characters()` when `--with-character`; `check_character`: `CHAR_BASE` exists, mesh height 1.65-1.75 (evaluated), tris ≤ 20000, armature/mesh location == `NAV_spawn_lobby` ± 0.01, action `idle` present + hips bone moves between frame 1 and mid frame unless `RIG_UNAVAILABLE`, `CHARACTERS` contains exactly one armature + one mesh (rigged mode, `character_mode.txt` = `rigged`) or exactly one mesh `CHAR_BASE` (static mode, `character_mode.txt` = `static`); height/tris checks use `CHAR_BASE_mesh` in rigged mode and `CHAR_BASE` in static mode; facing dot-product > 0.5 toward `CAM_lobby` applies in both modes (see `import_character.py`); before any transform read: `bpy.context.view_layer.update()` then `depsgraph = bpy.context.evaluated_depsgraph_get()` (the `CAM_lobby` TRACK_TO constraint and the character's `matrix_world` are set in the same run and are stale until the update); line of sight: `scene.ray_cast(depsgraph, CAM_lobby.location, (spawn + (0,0,0.9)) − CAM_lobby.location)` (hips height — NOT 0.3 m, where the ray can pass between the legs) and the same with `(spawn + (0,0,1.5))` — the first NON-`COL_` hit object of both rays is the character mesh, compared by name: `hit_obj.name in {"CHAR_BASE", "CHAR_BASE_mesh"}` (ray_cast returns evaluated copies, never compare object identity) (`COL_*` boxes are `hide_render` but still in the depsgraph: when `hit_obj.name.startswith("COL_")`, re-cast from `hit_loc + direction.normalized()*0.01` and continue; cap at 8 re-casts); nothing — sofa, counter, plant — stands between the lobby camera and the character. Mode file guard: `check_character` runs only with `--with-character`; `apps/assets/blender/renders/character_mode.txt` missing or not in {`rigged`,`static`} → `AssertionError` (never default to a mode); todo 15 rewrites that file on EVERY import run (rigged or static) so it can never be stale. Feet in frame: `bpy_extras.object_utils.world_to_camera_view(scene, CAM_lobby, Vector(spawn)).y > 0.02`.
- BL_BUILD(`apps/assets/blender/hq_v03.blend`, `--with-kit --with-character`) → `…/52-build-v03.txt`; BL_RENDER(`hq_v03.blend`, `lobby,iso,character_closeup`) day → `…/52a-render-v03.txt`, 3 PNGs + STATS; `read`; QA `…/53-qa-v03.md` (§4 rows + "karakter terlihat di frame lobby", "wajah terbaca", "tekstur tajam di closeup", "skala 1.7 m vs pintu 2.1 m"); `md5sum apps/assets/blender/hq_v03.blend > …/54-v03-md5.txt` AFTER the final 2c-approved build (frozen reference).

**Must NOT do**
- No Mixamo (needs browser), no manual weight painting, no face shape keys, no 7 clips, no ring mesh. No `transform_apply`/join on the rigged import. No guessed `action_id`.

**Parallelization:** Wave 5, after 14. Blocks 16.

**References**
- Guide §5.1, §6 `CHAR_BASE`, §7.2; HANDOFF MVP-0 L15 (clips deferred to MVP-4); Meshy MCP `meshy_rig`/`meshy_animate`/`meshy_list_animations` (planner's lookup on 2026-10-17 showed key `Idle` = action_id 0, DailyActions — re-verify at run time); `CAM_TARGETS["character_closeup"]`.

**Acceptance criteria**
- `test -s apps/assets/blender/hq_v03.blend`; `…/52-build-v03.txt` EXIT=0 with `SELF_CHECK OK`; 3 PNGs with STATS in gates; `53` all rows filled; `…/51b-idle-lookup.json` exists; ledger total ≤ 300.

**QA scenarios**
- Happy: `blender -b apps/assets/blender/hq_v03.blend --python-exit-code 1 --python-expr "import bpy;o=bpy.data.objects['CHAR_BASE'];print('OUT',o.type, o.animation_data.action.name if o.animation_data and o.animation_data.action else None, len([x for x in bpy.data.objects if x.type=='ARMATURE']))" | grep '^OUT ' | sed 's/^OUT //'` → `ARMATURE idle 1` (or `MESH None 0` with `RIG_UNAVAILABLE` recorded).
- Failure: evaluated height outside range → `check_character` EXIT≠0 → fix scale in `import_character.py`, rerun.

**Commit:** none unless asked; suggested `feat(assets): hq_v03 Meshy character in lobby`.

- [x] 16. ⏸ CHECKPOINT 2c — present character renders, wait for approval / prompt revision

**What to do**
- Message: 3 PNG paths, `53-qa-v03.md` summary, tris, texture size, rig/idle status, credits, question `Approve karakter? (approve / revisi prompt: <teks>, maks 3 generate total)`. STOP.
- Record `…/55-checkpoint-2c.md` with `USER_APPROVED_2C` or `REVISION_REQUESTED` (→ reopen 14/15 within caps).

**Must NOT do**
- No verdict render before approval.

**Parallelization:** Wave 5, sequential. Blocks 17.

**References**
- MVP-2 prompt step 12.

**Acceptance criteria**
- `grep -c 'USER_APPROVED_2C' …/55-checkpoint-2c.md` = 1.

**QA scenarios**
- Happy: token present. Failure: revision → loop with generation counter checked against 3.

**Commit:** none.

- [x] 17. ⏸ Verdict render (bpy furniture vs Meshy kit vs Meshy character in one frame) + Level 1/2 question

**What to do**
- `build_verdict_stage()` in `hq_kit_room.py` (collection `VERDICT_STAGE`, runs only with `--with-verdict-stage`): Meshy plate = 6×6 tiles of `KIT_meshy_floor_1m` covering x −6..0, y −30..−24 (tiles at location z −0.095, top at +0.005 above the ground top z −0.01); bpy plate = 6×6×0.1 slab `slab_verdict_bpy` covering x 6..12, y −30..−24 (top z 0); on each plate: 1 bpy desk+chair+monitor, and behind it (y −24.1) one `KIT_meshy_wall_1m` + one `KIT_meshy_wall_door` instance standing; `CHAR_BASE_stage` = `bpy.data.objects.new("CHAR_BASE_stage", <mesh data>)` where mesh data = `CHAR_BASE_mesh.data` (rigged path) or `CHAR_BASE.data` (`RIG_UNAVAILABLE` path), located at (3, −27, 0) with `matrix_world` scale = `(CHAR_BASE_mesh.matrix_world if rigged else CHAR_BASE.matrix_world).to_scale()` — the MESH object's world scale, which already includes the armature parent's unapplied scale plus any scale Meshy left on the mesh child itself (copying only the armature's scale would miss the latter) and a static pose (no armature modifier); `ground_verdict` 40×28×0.05 box, material `ground`, top z −0.01 (location z −0.06), covering x −17..23, y −61..−33 — it abuts `ground_main`'s south edge (y −33) with NO overlap, so no z-fight, and gives the verdict camera (frame bottom meets z=0 at y ≈ −38.8) solid ground below the plates; it lives in `VERDICT_STAGE` so it is excluded from any later export with the rest of the stage (thin world-background wedges at the far left/right horizon of the verdict frame are cosmetic and accepted); camera `CAM_verdict` already in `CAM_TARGETS` ((3,−46,4.0) → (3,−27,1.0), 28 mm — half-width ≈ 11.5 m at 19 m, so the full plate span x −6..12 (±9 m) is framed with margin) frames both plates.
- BL_BUILD(`apps/assets/blender/hq_v04.blend`, `--with-kit --with-character --with-verdict-stage`) → `…/60-build-v04.txt` (v03 stays frozen as approved at 2c) → BL_RENDER(`hq_v04.blend`, `verdict`) day → `hq_v04_verdict.png`; `read`.
- Write `…/60-verdict-analysis.md` against §3 "Konsistensi style" + §4 "Konsistensi interior": (a) texture language match kit ↔ character, (b) bpy flat colour vs Meshy textured clash level (none / mild / strong) with STATS, (c) seams/gaps/scale from `42`, (d) credits & wall-clock per kit piece vs bpy cost 0, (e) polycount delta, (f) MVP-3 export implications (unique meshes, textures → KTX2, draw calls), (g) explicit note: no Meshy furniture was generated in MVP-2, so the complex-furniture recommendation rests on character/kit texture quality only. Recommendation with reason: walls/floor = Level 1 (bpy) or Level 2 (Kit Meshy); complex furniture = Meshy or bpy.
- Present to the user: PNG path + the recommendation (+ item g caveat) + explicit question: `Pilih: (1) Level 1 bpy dinding/lantai, (2) Level 2 Kit Meshy; furniture kompleks: (a) Meshy, (b) bpy. Jawab mis. "2a".` STOP; record the verbatim answer in `…/61-verdict-answer.md` plus `VERDICT: level=<1|2> furniture=<meshy|bpy>`.

**Must NOT do**
- Do not write to the guide before the user answers. Do not pick for the user. Do not overwrite `hq_v03.blend`.

**Parallelization:** Wave 6, after 16. Blocks 18.

**References**
- MVP-2 prompt steps 13-14; guide §3 L94 Konsistensi style, §4 L123-129; `CAM_TARGETS["verdict"]`.

**Acceptance criteria**
- `test -s apps/assets/blender/renders/hq_v04_verdict.png`; `md5sum apps/assets/blender/hq_v01.blend hq_v02.blend hq_v03.blend > …/60b-frozen-md5.txt` equals `24c`, `43b`, `54` respectively; `…/60-verdict-analysis.md` has sections a-g + Recommendation; `…/61-verdict-answer.md` has the verbatim reply and a `VERDICT: level=` line before todo 18 starts.

**QA scenarios**
- Happy: `grep -cE 'VERDICT: level=[12] furniture=(meshy|bpy)' …/61-verdict-answer.md` = 1.
- Failure: user answer ambiguous → ask one clarifying line, do not proceed.

**Commit:** none.

- [x] 17b. Kit v2 (user scope addendum 2026-10-18, see …/61-verdict-answer.md): Meshy-generated realistic-4K single panels, bpy assembles on ALL floors

**What to do**
- Pieces (one each): `KIT2_wall_1m` (solid wall panel), `KIT2_window_1m` (window wall panel: frame/mullions only, pane stays bpy glass), `KIT2_floor_1m` (floor tile), `KIT2_wall_door` (wall panel with door), `KIT2_pillar`. Image route: nano-banana-2 design image per piece → meshy_image_to_3d ai_model meshy-7.1, texture_resolution 4k, enable_pbr true, target_formats glb; meshy_remesh only if tris > 8,000 (target ≤ 8,000, quad). Raw files under `apps/assets/raw/meshy/kit_v2/`.
- Normalize with normalize_kit.py (texture size up to 4096 kept, PBR maps kept) into collection `KIT_MESHY_V2`; build_hq `--kit-source meshy2` assembles ALL four floors (perimeter solid walls, window panels with bpy glass pane, door walls, floor tiles, pillars); `--kit-source bpy` stays default and unchanged. Rebuild `hq_v04.blend` (v01-v03 frozen), renders iso/lobby/workstation + 1 close-up of each piece → `…/64-qa-kit2.md`.
- Credits: MVP cap 450 (USER_APPROVED_CAP_450), kit v2 spend ≤ 330 total, max 2 tries per piece. Meshy furniture: verdict=meshy recorded, generation NOT in this todo (needs new authorization).

**Acceptance**: 5 GLB in kit_v2/, ledger reconciles, build EXIT=0 with `--kit-source meshy2`, fallback `--kit-source bpy` EXIT=0, frozen md5 v01-v03 unchanged, renders read and QA rows PASS.

- [x] 18. Write verdict to guide §3 + §11 (+ §10 note), sync `.html`; if Level 2 switch `build_hq.py` Floor 1 to `KIT_MESHY`

**What to do**
- mtime guard: compare `stat -c '%Y'` of the three docs with `…/00d-doc-mtimes.txt` (recorded in todo 2, after todo 1's edits); if changed by another session → STOP.
- Guide `.md`: §3 row `Hybrid Meshy (conditional)` → replace `Aktif hanya jika uji MVP-2 fase 2b lolos §4 + disetujui user` with `**Hasil uji MVP-2 (YYYY-MM-DD): Level <1|2> dipilih untuk dinding/lantai; furniture kompleks = <Meshy|bpy>.** Alasan: <1 kalimat dari 60-verdict-analysis.md>`. §11 append row `| 20 | Verdict MVP-2: Level <n> dinding/lantai, furniture kompleks <x> | "<user answer verbatim>" |`. Mirror to `.html` (anchors: row containing `Hybrid Meshy (conditional)`, after the §11 row containing `mid poly aja`).
- Reviewer read → `…/63-guide-review.md` (2 rows, md==html, `RESULT: PASS`).
- If `level=2`: `hq_floor1.py` `build_floor_1(kit_source="bpy"|"meshy")` — with `meshy`, perimeter/interior solid walls, doors and floor tiles come from `KIT_meshy_*` in `KIT_MESHY` (glass stays bpy; floor tile instances named `tile_f1_<i>` in `FLOOR_1` at location z −0.095 so tops sit at +0.005 above `slab_floor_1` top and furniture is not visibly raised; every `ROOM_*` area mesh gets `hide_render = True` in Level 2 so the tiles are visible); `build_hq.py` passes `--kit-source` (default `bpy`; `meshy` requires `--with-kit` and existing files, else exits 2 with a clear message). BL_BUILD(`apps/assets/blender/hq_v04.blend`, `--with-kit --with-character --with-verdict-stage --kit-source meshy`) → `…/62-build-v04-L2.txt`; BL_RENDER(`hq_v04.blend`, `iso,lobby,workstation`) → PNGs; `read`; QA `…/62-qa-L2.md`. Fallback proof: BL_BUILD(`/tmp/hq_v04_bpy.blend`, `--kit-source bpy`) EXIT=0. If `level=1`: no script change; note in `…/62-qa-L2.md`.
- `diff -u …/00c-pre/redhunter-hq-brainstorming-guided.md docs/redhunter-hq-brainstorming-guided.md > …/63-guide-md-final.diff` (and html).

**Must NOT do**
- No other guide sections. Do not remove `KIT_BPY` (fallback). Do not touch `hq_v01/v02/v03`.

**Parallelization:** Wave 6, after 17. Blocks 19.

**References**
- Guide §3 Hybrid Meshy row, §11 rows 19 (todo 1) / 20; `.html` anchors; todo 17 outputs; Verification strategy "Doc-edit discipline".

**Acceptance criteria**
- `…/63-guide-review.md` ends `RESULT: PASS`; `grep -c '| 20 |' docs/redhunter-hq-brainstorming-guided.md` = 1; `.html` parses; if level=2: `grep -c 'kit_source' apps/assets/blender/hq_floor1.py` ≥ 1, `…/62-build-v04-L2.txt` EXIT=0, fallback build EXIT=0.

**QA scenarios**
- Happy: reviewer row for `Hybrid Meshy` shows md text == html text.
- Failure: level=2 and the `--kit-source bpy` fallback build fails → fix before marking done.

**Commit:** none unless asked; suggested `docs(guide): MVP-2 verdict Level <n>` + `feat(assets): Floor 1 kit source switch`.

- [x] 19. HANDOFF report for MVP-2 (append to `docs/mvp/HANDOFF.md`)

**What to do**
- mtime guard on `docs/mvp/HANDOFF.md` (as in todo 18). Append `## MVP-2 — Blender Visual Lab (YYYY-MM-DD)` with **Selesai / Output untuk MVP berikutnya / Keterbatasan** covering: paths `apps/assets/blender/{build_hq.py,hq_lib.py,hq_massing.py,hq_floor1.py,hq_furniture.py,hq_lighting.py,hq_kit_room.py,normalize_kit.py,import_character.py,render_hq.py,tests/test_furniture.py}`; `.blend` versions v01 (2a), v02 (2b), v03 (2c), v04 (verdict / Level-2 switch) and which one MVP-3 should open (`hq_v04.blend` if it exists else `hq_v03.blend`); every render PNG path; object list per §6 prefix (from a `python-expr` dump of the final `.blend` → table); `KIT_*` list with source (bpy/meshy); polycount per collection and per kit piece + character (from `23`, `42`, `53`); raw asset paths + sizes (flag > 10 MB "jangan masuk git"); licence (Meshy Pro commercial; CC BY 4.0 not applicable); Meshy mode (Pro via MCP; REST fallback used? y/n; dedupe events); credits used (ledger total, per phase, final balance); verdict Level 1/2 + furniture + item-g caveat; rig/idle status (`idle` action id used); known limitations (no shape keys/7 clips, bpy untextured palette only, night render single view, headless-only renders, `FURNITURE_STUB` removed); exact headless commands (BL_BUILD/BL_RENDER expanded with real flags); MVP-3 pointers (open final `.blend`; exclude collections `FLOOR_1_KIT_TEST`, `VERDICT_STAGE`, `KIT_BPY`, `KIT_MESHY`, `CAMERAS`, `LIGHTING` from export; `CHAR_BASE` armature + `idle` action; §4.1 R3F lighting values unchanged).
- Reviewer read of the HANDOFF section → `…/72-handoff-review.md` (every field above present, `RESULT: PASS`).
- `git status --porcelain=v1 > …/70-git-status-after.txt`; `diff -u …/00-git-status-before.txt …/70-git-status-after.txt > …/71-status-diff.txt` → added lines (`^\+` excluding the `+++` header) only for paths under `apps/assets/blender/`, `apps/assets/raw/`, `.omo/` (boulder / run-continuation / evidence churn is expected); `protected_sha() > …/71b-protected.sha` must equal `…/00e-protected.sha` (the protected paths were already dirty before, so status lines cannot detect edits there — the fingerprint can).

**Must NOT do**
- No edits to other HANDOFF sections. No commit.

**Parallelization:** Wave 6, last. Blocks F1-F4.

**References**
- `docs/mvp/HANDOFF.md` format L6-11, MVP-1 report style L18-59; MVP-2 prompt "Selesai:" paragraph.

**Acceptance criteria**
- `…/72-handoff-review.md` ends `RESULT: PASS`; `grep -c '## MVP-2' docs/mvp/HANDOFF.md` = 1; `grep -E '^\+[^+].*(apps/web|apps/api|packages/|apps/assets/scripts|apps/assets/models|package\.json|bun\.lock)' …/71-status-diff.txt` → empty; `diff …/00e-protected.sha …/71b-protected.sha` → empty.

**QA scenarios**
- Happy: `tail -80 docs/mvp/HANDOFF.md` lists every field above.
- Failure: `diff …/00e-protected.sha …/71b-protected.sha` non-empty → scope breach, STOP and report which protected path changed (`git diff --stat -- $PROTECTED` vs todo 2 is diagnostic only).

**Commit:** none unless asked; suggested `docs: MVP-2 handoff report`.

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
Re-read every todo's Acceptance criteria and verify against `.omo/evidence/mvp-2-blender-lab/` (00-71, meshy-ledger.md, checkpoint files with `USER_APPROVED_2A/2B/2C`, `VERDICT:` line). Any missing file or failed gate → reopen owning todo. Write `F1-compliance.md`: criterion → PASS/FAIL + evidence filename; ends `RESULT: PASS|FAIL`.

- [x] F2. Code quality review
Review `apps/assets/blender/*.py`: English identifiers (global AGENTS.md naming), no `any`-style magic numbers without constants, functions ≤ 50 lines where feasible, no absolute home paths, engine set inside try/except, node lookup by `type`, `hasattr` guards for Blender 5 renamed attrs, idempotent collection rebuild, no `print` of env/key. `python3 -c "import ast;…"` on every file exit 0. Write `F2-review.md` ending `RESULT: PASS|FAIL`.

- [x] F3. Real manual QA
Fresh clone-like run: `rm -f /tmp/hq_f3.blend; (cd "$R" && blender -b --python-exit-code 1 -P apps/assets/blender/build_hq.py -- --with-kit --with-character --check --save /tmp/hq_f3.blend <--kit-source as recorded in 61/62>) > F3-build.txt; echo EXIT=$?` → EXIT=0, `SELF_CHECK OK`; `(cd "$R" && blender -b /tmp/hq_f3.blend --python-exit-code 1 -P apps/assets/blender/render_hq.py -- --views iso,lobby --out /tmp/hq_f3_renders)` → 2 PNGs with STATS in gates; `read` both; compare composition with the latest approved `renders/hq_v0{3,4}_iso.png` / `_lobby.png`. Also plain BL_BUILD (no flags) → EXIT=0 and `NAMES(/tmp/hq_f3_plain.blend)` (sentinel capture, non-empty) equals `…/24a-names-v01.txt` (v01 reproducibility still holds). Also `--kit-source bpy` variant → EXIT=0. MCP parity once (rule in Verification strategy). `meshy_check_balance` → final balance; ledger per-row reconcile passes; total ≤ 300; a total mismatch vs (baseline − final) is reported with explanation (refund/other session), not failed. Write `F3-manual-qa.md` ending `RESULT: PASS|FAIL`.

- [x] F4. Scope fidelity
`git status --porcelain=v1` vs `00-git-status-before.txt`: added lines only under the allowed paths (todo 19). `protected_sha()` → `F4-protected.sha` equals `00e-protected.sha` (the only valid breach detector: those paths were dirty before the session, so `git diff --stat` emptiness is NOT a usable gate); `.env` mtime equals the value in `00d-doc-mtimes.txt`. `grep -rnE 'MESHY_API_KEY=[A-Za-z0-9]' .omo/evidence/mvp-2-blender-lab apps/assets docs` → empty (name may appear, value never). No `apps/web/public/models/hq.glb`. `git rev-parse HEAD` still `49ea580…` unless the user committed. `md5sum hq_v01/v02/v03.blend` equal to `24c`, `43b`, `54`. Write `F4-scope.md` ending `RESULT: PASS|FAIL`.

QA for F1-F4 — Happy: each `F*.md` exists and ends with `RESULT: PASS`. Failure: any `FAIL` → reopen owning todo, re-run its QA, append re-run evidence filename to the `F*.md`; final wave not done until all four read `RESULT: PASS`. Then present to the user and wait for explicit okay before declaring MVP-2 complete.

## Commit strategy

The worker does **not** commit (global Git Mutation Consent Gate; MVP-2 prompt: "Jangan commit git atau .env kecuali saya minta"). Suggested grouping when the user later says "commit": (1) `docs(guide)` style revision + verdict (todos 1, 18) ; (2) `feat(assets)` Blender scripts + `.blend` v01-v04 + renders (todos 3-8, 11, 12, 15, 17, 18); (3) `docs` HANDOFF (todo 19). Raw Meshy assets: list sizes first; any file > 10 MB stays uncommitted (no git-lfs installed) and is listed in HANDOFF. Never stage the pre-existing 31 modified / 74 untracked files outside the plan paths. `.omo/` evidence is committed only if the user asks.

## Success criteria

- `blender -b -P apps/assets/blender/build_hq.py -- --with-kit --with-character --with-verdict-stage --check --save <x>` reproduces the scene from scratch, exit 0, `SELF_CHECK OK`; plain run reproduces v01; MCP `exec` of the same file also works.
- `hq_v01.blend`, `hq_v02.blend`, `hq_v03.blend`, `hq_v04.blend` exist (v01-v03 frozen after their checkpoints); renders iso/lobby/workstation (v01, day + iso night), meeting_bpy/meeting_kit/kit_compare (v02), lobby/iso/character_closeup (v03), verdict (+ L2 views if Level 2) (v04) exist at 1280×720, each read, with STATS gates, and QA'd with the §4 checklist in evidence.
- Naming §6 complete and asserted: `FLOOR_1..4`, `ROOM_lobby/meeting_a/workstation_a`, `COL_*` hidden, `NAV_spawn_lobby`, `NAV_cam_*`, `NAV_wp_lobby/meeting_a/workstation_a`, `TASK_board`, `TASK_desk_1..8`, `KIT_wall_1m/wall_door/floor_1m(/pillar)` (bpy) + `KIT_meshy_wall_1m/wall_door/floor_1m(/pillar)` (Meshy), `CHAR_BASE`.
- 3-4 Meshy kit pieces + 1 character generated via Meshy Pro MCP (REST only on tool error), normalized, within 300 credits / 6 kit / 3 character generations; ledger reconciles with `meshy_check_balance`.
- Three user checkpoints approved (tokens in evidence) and verdict answered by the user; guide §3/§10/§11 + `.html` updated (style → mid-poly textured, prices, verdict); `build_hq.py` switched to `KIT_MESHY` if Level 2 with bpy fallback still green.
- HANDOFF MVP-2 appended; no file touched under `apps/web`, `apps/api`, `packages`, `apps/assets/scripts|models`, root `package.json`, `.env`; no commit.
- `F1-F4` all `RESULT: PASS`.
