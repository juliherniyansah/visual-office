# Redhunter HQ — MVP Handoff Log

Append-only. Setiap MVP menambah satu bagian di akhir sesi: apa yang selesai, file/nama yang
tersedia untuk MVP berikutnya, keterbatasan. MVP berikutnya WAJIB membaca file ini.

<!-- Format:
## MVP-N — <judul> (YYYY-MM-DD)
- Selesai: ...
- Output untuk MVP berikutnya: ...
- Keterbatasan / catatan: ...
-->

## MVP-0 — Visi Terkunci (2026-10-17)
- Selesai: 15 keputusan visi diwawancarai & ditulis ke guide §4.1 Atmosfer, §5.1 (tanpa TBD), §8.4 Game Feel, §11 #13–#17; .html sinkron.
- Output untuk MVP berikutnya: MVP-2 (P0) → §4.1 palet, exterior taman+jalan, HemisphereLight + DirectionalLight PCFSoft 2048; naming tambahan di hq.glb: 1 empty `NAV_wp_<room_id>` per `ROOM_*` (contoh `NAV_wp_lobby`, `NAV_wp_meeting_a`, `NAV_wp_workstation_a`) + area sofa di `ROOM_lobby`. MVP-3 (P1–P2) → §4.1 day-night 4 fase; §8.4 cinematic intro ≤ 4 s, juice sedang. MVP-4 (P3) → §5.1 humanoid 1.7 m, 7 clip, shape key face_blink/face_smile/face_talk di tiap CHAR_FACE_<id>, ≤ 8k tris, ring AI 0.25 m; demo `walk` sepanjang `NAV_wp_*` tanpa data backend — mapping dipasang di MVP-5. MVP-5 (P4) → §8.4 mapping `AGENT_STATUSES` → ruangan/clip, XP/level/badge backend, ambient bubble idle non-status + prop bergerak.
- Keterbatasan / catatan: tidak ada kode/Blender/git di MVP-0. Day-night = 4 setup lighting; disarankan (bukan keharusan) MVP-2 render QA minimal fase siang + malam. Shape key bergantung output Meshy; fallback manual Blender. §5.1 menggantikan daftar clip §7.2 (idle/walk/sit/type → 7 clip).

## MVP-1 — Fondasi Web 3D Rapi (2026-10-17)
- Selesai: deps react-three dideklarasikan + `OfficeCanvas.tsx` (monolith 417 LOC) dipecah jadi 13 file di `apps/web/src/components/office/` tanpa perubahan visual, dijaga gate Playwright screenshot.
  - Deps di `apps/web/package.json`: `dependencies` → `three ^0.186.1`, `@react-three/fiber ^9.8.1`, `@react-three/drei ^10.7.9`; `devDependencies` → `@types/three ^0.186.0`. Resolved sebelum (`01-resolved-versions.txt`): three 0.186.1, fiber 9.8.1, drei 10.7.9, @types/three 0.186.0. Sesudah (`23-resolved-versions-after.txt`): sama, kecuali fiber 9.8.2 (patch drift, diizinkan oleh range `^`). Delta `bun.lock`: `+108 -0` (`21-lock-diff-stat.txt`). Duplikat nested `stats-gl/three@0.170.0` dan `tunnel-rat/zustand@4.5.7` = transitif, wajar.
  - File baru (`34-loc-new-files.txt`, total 478 LOC vs monolith 417; selisih = import + header `'use client'`):

    | File | LOC |
    |---|---|
    | `OfficeCanvas.tsx` (root) | 60 |
    | `Building.tsx` | 10 |
    | `FloorPlane.tsx` | 19 |
    | `DeskMarkers.tsx` | 32 |
    | `Agent.tsx` | 60 |
    | `CameraRig.tsx` | 45 |
    | `FloorSelector.tsx` | 52 |
    | `Lighting.tsx` | 20 |
    | `WebGLErrorBoundary.tsx` | 49 |
    | `Scene.tsx` | 55 |
    | `constants.ts` | 40 |
    | `focusContext.ts` | 16 |
    | `deskLayout.ts` | 20 |

  - `apps/web/src/components/OfficeCanvas.tsx` lama dihapus; `apps/web/src/app/dashboard/page.tsx:7` sekarang import `@/components/office/OfficeCanvas` (ubah 1 baris).
  - `BUILDING_MODEL_URL` ada di `apps/web/src/components/office/Building.tsx:5` (`export const BUILDING_MODEL_URL = '/models/building.glb';`), satu-satunya kemunculan `/models/building.glb` di `apps/web/src`.
  - Perubahan non-mekanis hanya dua: const `BUILDING_MODEL_URL` di `Building.tsx`, dan `<Lighting />` menggantikan ambient + directional inline di posisi tree yang sama dalam `Scene.tsx`. Sisanya byte-identik kecuali `export`/import (bukti: `30-diff-support.txt`, `31-diff-wave2a.txt`, `32-diff-wave2b.txt`, `33-diff-wave3.txt`).
  - Screenshot: `.omo/evidence/mvp-1-foundation/10-dashboard-before.png`, `.omo/evidence/mvp-1-foundation/10-dashboard-after.png`; baseline snapshot `apps/web/e2e/dashboard-office.e2e.ts-snapshots/dashboard-office-linux.png` (29439 B, md5 `a273b6d34ea3689d65a817f6b125e15c`, tidak berubah setelah split).
  - Command Playwright (persis seperti dijalankan, dari root repo): `rm -rf apps/web/.next/dev` lalu `(cd apps/web && MVP1_PHASE=<phase> bunx playwright test e2e/dashboard-office.e2e.ts --output ../../.omo/evidence/mvp-1-foundation/pw-output)`. Port :3100 harus kosong (config `reuseExistingServer:false`). Baseline dibuat sekali dengan `--update-snapshots` SEBELUM split; tidak pernah di-generate ulang sesudahnya.
  - Setelan spec `apps/web/e2e/dashboard-office.e2e.ts`: locator target `main` (header tidak ikut), `maxDiffPixelRatio 0.01`, `animations: 'disabled'`, tunggu 3000 ms (`waitForTimeout`), badge dev Next disembunyikan via `nextjs-portal{display:none!important}`, flag SwiftShader (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`), viewport 1280x800, `colorScheme: 'dark'`. Renderer (`14-renderer-before.txt` = `14-renderer-after.txt`): `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
  - `ALLOWLIST` = kosong; console error before/after sama-sama `[]` (`11-console-before.json`, `11-console-after.json`).
  - Hasil gate: run after-split pass (`51-playwright-after.txt`); negatif dengan `FLOOR_HEIGHT=5` gagal di `toHaveScreenshot` (22234 px, ratio 0.03, `56-playwright-negative-after.txt`) jadi gate menggigit; negatif fase before (`PW_NEG=1` invert, ratio 0.97, `13-playwright-negative.txt`) juga gagal sesuai rencana; rerun pass (`57-playwright-after-rerun.txt`); web `bun run typecheck` EXIT=0 (`52-typecheck-final.txt`).
- Output untuk MVP berikutnya:
  - MVP-2 cukup mengedit `BUILDING_MODEL_URL` di `Building.tsx:5`, `Lighting.tsx` (guide §4.1: HemisphereLight + DirectionalLight PCFSoft 2048), dan file GLB. Tidak perlu menyentuh file `office/` lain.
  - Spec Playwright `apps/web/e2e/dashboard-office.e2e.ts` = gate regresi visual. Perubahan visual yang disengaja di MVP-2 WAJIB regenerate snapshot secara eksplisit dengan `--update-snapshots` dan dicatat di bagian HANDOFF berikutnya.
  - Peta `office/`: `OfficeCanvas.tsx` (root Canvas + error boundary), `Scene.tsx` (komposisi scene), `Building.tsx` (GLB gedung), `FloorPlane.tsx`, `DeskMarkers.tsx` + `deskLayout.ts` (posisi meja), `Agent.tsx` (karakter agent), `CameraRig.tsx`, `FloorSelector.tsx` (UI lantai), `Lighting.tsx`, `WebGLErrorBoundary.tsx`, `constants.ts` (konstanta + `AgentStatuses`), `focusContext.ts` (context fokus kamera).
- Keterbatasan / catatan:
  - Instruksi user (MVP-1: pecah `OfficeCanvas.tsx`) meng-override guide §1 MUST NOT 7 untuk MVP ini; §1 item 7 sudah diperbarui. Tidak ada commit (user: "Jangan commit git kecuali saya minta").
  - 5 diagnostik biome pre-existing, tidak diperbaiki (disetujui user: murni pindah), lokasi sesudah pindah (`53-biome-lint-final.txt`): `CameraRig.tsx:13:30 noExplicitAny`, `Agent.tsx:26:7 noStaticElementInteractions`, `DeskMarkers.tsx:28:24 noArrayIndexKey`, `FloorSelector.tsx:29:11 useButtonType`, `dashboard/page.tsx:38:9 useButtonType`.
  - `bun run lint` repo-wide masih exit 1 (4071 error format pre-existing; default biome double-quote vs kode single-quote). `biome format` sengaja TIDAK dijalankan karena akan menulis ulang quote dan merusak klaim byte-identik. Gate yang dipakai = `biome lint` per file.
  - Hook self-check negatif `PW_NEG` di spec dipertahankan (3 baris sebelum assertion screenshot).
  - File yang ditulis ulang tooling, sudah dirty sebelum MVP-1 dan tetap dirty: `apps/web/next-env.d.ts`, `apps/web/test-results/.last-run.json`.
  - Warning browser (bukan error, tidak dikumpulkan): `THREE.Clock` deprecated (pakai `THREE.Timer`), `PCFSoftShadowMap` sudah dihapus lalu fallback ke `PCFShadowMap`. Pre-existing, kandidat dibereskan di MVP berikutnya (relevan untuk lighting MVP-2).
  - Deviasi dari plan: (a) path `EVIDENCE_DIR` di plan `../../.omo/...` salah (`__dirname` = `apps/web/e2e`); spec memakai `../../../.omo/...`. Bug laten yang sama ada di `landing.e2e.ts` (membuat folder untracked pre-existing `apps/.omo/evidence/`), dibiarkan. (b) `AgentStatuses` diekspor dari `constants.ts`. (c) Patch drift fiber 9.8.2. (d) Root `bun run --filter '*' typecheck` merah pre-existing: belasan error TS di `apps/api` seputar properti `owner` (mis. `src/seed/seed.test.ts(134/141)` TS2769, `src/index.ts(24)` dan `src/seed/cli.ts(17)` TS2339 `'owner'` tidak ada di `SeedResult`; lihat `02b-typecheck-root-before.txt`), tidak terkait MVP-1.
  - `docs/redhunter-hq-brainstorming-guided.html` belum disinkron ulang; masih memuat teks lama (§1 MUST NOT 7 dan fakta §9).

## Koreksi — Penomoran MVP (2026-10-17)

- Bagian "Output untuk MVP berikutnya" di laporan MVP-1 masih memakai **penomoran lama**. Roadmap sudah ditulis ulang (lihat `docs/mvp/README.md`):
  - **MVP-2 = Blender Lab**, murni Blender. **DILARANG** menyentuh `apps/web`, `apps/api`, `packages/*`, `apps/web/public/models/`. Abaikan instruksi "MVP-2 cukup edit `BUILDING_MODEL_URL` / `Lighting.tsx`".
  - Pekerjaan web yang disebut di laporan MVP-1 (`BUILDING_MODEL_URL` di `Building.tsx:5`, `Lighting.tsx` sesuai guide §4.1, swap GLB, regenerate snapshot Playwright `--update-snapshots` + dicatat) pindah ke **MVP-3 Integrasi Web**.
  - Fakta teknis lain dari laporan MVP-1 (peta `office/`, gate Playwright, diagnostik pre-existing) tetap berlaku.
- `docs/redhunter-hq-brainstorming-guided.html` sudah disinkron dengan `.md` (§1 MUST NOT 7, §9 Repo).

## MVP-2 — Blender Visual Lab (2026-10-18)
- Selesai: gedung 4 lantai + exterior + Floor 1 lengkap dibangun 100% headless lewat `bpy` (idempotent, `--check` self-check), uji kit Meshy vs bpy, karakter Meshy rigged + idle, verdict user = **Level 2** lalu kit v2 Meshy (4K PBR) dipasang di SEMUA lantai. Tidak ada perubahan di `apps/web`, `apps/api`, `packages/*`; tidak ada commit.
  - Script (`apps/assets/blender/`): `build_hq.py` (entry), `hq_lib.py` (koleksi, `CAM_TARGETS`, `count_tris`, self-check registry, viewport `diffuse_color`), `hq_massing.py`, `hq_floor1.py`, `hq_furniture.py`, `hq_lighting.py` (LIGHTING + CAMERAS, fase day/night), `hq_kit_room.py` (room uji kit v1 + verdict stage), `hq_kit2.py` (BARU: import/normalize kit v2, ganti 221 objek polos dengan instance kit v2, `snap_character_to_tiles`, `CAM_kit2_closeup`), `normalize_kit.py`, `import_character.py`, `render_hq.py`; test: `tests/test_furniture.py`, `tests/test_normalize_kit.py`, `tests/test_viewport_colors.py` (semua EXIT=0, `65c-regression.txt`).
  - Flag `build_hq.py` yang benar-benar ada (argparse manual): `--save <path>`, `--check`, `--with-kit`, `--with-character`, `--with-verdict-stage` (wajib bareng `--with-kit --with-character`, kalau tidak `SystemExit`), `--kit-source bpy|meshy|meshy2` (default `bpy`), hook negatif `--inject-bad-col`, `--inject-missing-nav`. Catatan: `--kit-source meshy` lolos validasi tapi TIDAK punya cabang sendiri di `main()` (berperilaku sama dengan `bpy`); kit v1 dimuat lewat `--with-kit`. Hanya `meshy2` yang mengubah build.
  - Versi `.blend` (`apps/assets/blender/`):

    | File | Checkpoint | Isi | md5 | Ukuran |
    |---|---|---|---|---|
    | `hq_v01.blend` | 2a (approve "1 setuju") | bpy murni, 387 obj, 6.630 tris | `29a9335853af9bc029aea4eb88445110` | 0,2 MB |
    | `hq_v02.blend` | 2b (approve "lanjut A") | + kit v1 room uji, 463 obj, 57.604 tris | `559159834244a82a3d996a783675774a` | 4,5 MB |
    | `hq_v03.blend` | 2c (approve) | + karakter rigged, 465 obj, 77.103 tris; versi pertama dengan fix viewport `diffuse_color` | `8845bc7eadbbb6566f66ece44ea8a837` | 8,3 MB |
    | `hq_v04.blend` | 2d + Level 2 | FINAL: kit v2 semua lantai, 1.794 obj, 1.127.156 tris | `edc83c06afbc3e2b416e08947931bbf6` | 93,3 MB |

    `hq_v04` pre-L2 (verdict stage, 514 obj, 138.933 tris, md5 `143be11694c44c4791262bcd8b88a001`) sudah DITIMPA build kit2; render `hq_v04_verdict.png` disimpan sebagai arsip. Backup sementara `/tmp/hq_v04_preL2.blend` dan `/tmp/hq_v04_bpy.blend` (bukti fallback bpy, `65b`) bukan bagian repo.
  - Render PNG (`apps/assets/blender/renders/`, 1280x720 EEVEE, semua gate STATS PASS kecuali night yang `--no-gate`): `hq_v01_iso.png`, `hq_v01_lobby.png`, `hq_v01_workstation.png`, `hq_v01_iso_night.png`, `hq_v01_cutaway_iso.png`; `hq_v02_meeting_bpy.png`, `hq_v02_meeting_kit.png`, `hq_v02_kit_compare.png`; `hq_v03_lobby.png`, `hq_v03_iso.png`, `hq_v03_character_closeup.png`; `hq_v04_verdict.png` (stage pre-L2); `hq_v04_kit2_iso.png`, `hq_v04_kit2_lobby.png`, `hq_v04_kit2_workstation.png`, `hq_v04_kit2_closeup.png`. Data: `kit_metrics.json` (kit v1), `character_mode.txt` (`rigged`). Render per piece kit v2: `.omo/evidence/mvp-2-blender-lab/64-render-KIT2_*.png`. Scratch, boleh dihapus: `hq_scratch_t6_iso.png`, `hq_scratch_t6_iso_night.png`, `hq_r3_r3a_*.png`, `hq_r3_r3b_*.png`, `hq_v01_r1_*.png`, `hq_v01_r2_*.png`, `hq_v02_r1_*.png`.
  - Verdict (`61-verdict-answer.md`, kutipan user): Level 2 = potongan kit dari Meshy, `bpy` yang merakit; furniture kompleks = Meshy (a); lingkup = semua lantai; gaya "realistic tapi style poly", 4K, remesh boleh. Cap kredit MVP dinaikkan user 300 ke 450 (2026-10-18). Caveat item-g: verdict furniture hanya bersandar pada kualitas karakter + kit, BELUM ada sampel furniture Meshy. Furniture Meshy belum dibuat; butuh otorisasi kredit terpisah.
  - Karakter: armature `CHAR_BASE` (24 bone, scale 0,0103 efektif dari import 0,01) + mesh `CHAR_BASE_mesh` 19.499 tris, tinggi 1,70 m, kaki di atas tile (feet_z 0,005). Action `idle` (Meshy action_id 0 "Idle", 96 frame, gerak halus ~1 cm di hips), slot ter-assign. Rig task `01a14d22-2671-70fa-b382-21aa910c2328`, idle task `01a14d23-6cf3-76c6-bd63-5802c870ea97`. `char_walk.glb` + `char_run.glb` (gratis dari rig) sudah diunduh, BELUM di-import. Pose dasar A-pose (lengan ~10-15 derajat di bawah horizontal), bukan T-pose murni.
  - Meshy: mode Pro via MCP tools (tidak ada fallback REST; plugin Meshy Blender tidak didukung di Linux, jadi jembatan = download GLB manual ke `apps/assets/raw/meshy/`). Dedupe: 1 percobaan refine ditolak validasi 400 tanpa task/biaya (ledger 8a); tidak ada task ganda. Model gambar `nano-banana-2` (6 kr/gambar). Model 3D: kit v1 + karakter `meshy-t2.5` smart-topology (instruksi user), kit v2 `meshy-7.1` image-to-3d + remesh quad + retexture. Lisensi: Meshy Pro = hak komersial; CC BY 4.0 tidak berlaku (tidak ada aset pihak ketiga).
  - Kredit (`meshy-ledger.md`, dicek ulang): baseline 4100, saldo akhir **3748** (dicek `meshy_check_balance` saat laporan ini). Total MVP **352 / cap 450**. Per fase: style ref 12 (2x6), kit v1 80 (6 preview x5 + 5 refine x10), karakter 28 (preview 5+5, refine 10, rig 5, idle 3), kit v2 212 (7 gambar x6 = 42, 5 image-to-3d x30 = 150, 4 remesh x5 = 20) + retexture 20 (2x10) = 232. 12+80+28+232 = 352 = 4100-3748.
- Output untuk MVP berikutnya (MVP-3 Integrasi Web):
  - Buka `apps/assets/blender/hq_v04.blend` (final). Build ulang dari nol: `(cd "$R" && timeout 900 blender -b --python-exit-code 1 -P apps/assets/blender/build_hq.py -- --save apps/assets/blender/hq_v04.blend --check --with-kit --with-character --with-verdict-stage --kit-source meshy2)` (log `65-build-v04-kit2.txt`: `SELF_CHECK OK 1794 objects 1127156 tris`, EXIT=0). Fallback tanpa kit v2: flag sama dengan `--kit-source bpy` dan `--save /tmp/hq_v04_bpy.blend` (`SELF_CHECK OK 514 objects 138933 tris`, EXIT=0). Build polos v01: `... build_hq.py -- --save <path> --check` (387 obj, 6.630 tris, nama identik v01).
  - Render: `(cd "$R" && blender -b apps/assets/blender/hq_v04.blend --python-exit-code 1 -P apps/assets/blender/render_hq.py -- --views iso,lobby,workstation --out apps/assets/blender/renders --tag kit2)` dan `--views kit2_closeup` tanpa tag; opsi lain `--phase day|night`, `--res 1280x720`, `--samples 32`, `--hide COLL1,COLL2`, `--no-gate`. Nama file = `<blend_stem>[_<tag>]_<view>[_night].png`; view = `CAM_<view>` yang ada: `iso`, `lobby`, `workstation`, `meeting_bpy`, `meeting_kit`, `kit_compare`, `character_closeup`, `verdict`, `kit2_closeup`. Render tidak pernah menyimpan blend. Waktu ~5-7 menit/frame (32 sample), jalankan detached.
  - Objek per prefix §6 (dump headless `70-final-blend-dump.txt`):

    | Prefix | Jumlah | Nama |
    |---|---|---|
    | `FLOOR_<n>` | 4 koleksi (0 objek) | koleksi `FLOOR_1`..`FLOOR_4` |
    | `ROOM_` | 4 | `ROOM_lobby`, `ROOM_meeting_a`, `ROOM_workstation_a`, `ROOM_meeting_a_kit` (room uji) |
    | `COL_` | 26 | `COL_counter`, `COL_desk_1..8`, `COL_slab_floor_1..4`, `COL_sofa_1/2`, `COL_stair`, `COL_table_meeting`, `COL_wall_{n,e,s,w}`, `COL_wall_meeting_{x8,y8}`, + 3 varian `_kit` |
    | `NAV_` | 8 | `NAV_spawn_lobby`, `NAV_wp_lobby`, `NAV_wp_meeting_a`, `NAV_wp_workstation_a`, `NAV_wp_meeting_a_kit`, `NAV_cam_iso`, `NAV_cam_floor1`, `NAV_cam_workstation` |
    | `TASK_` | 10 | `TASK_board`, `TASK_board_kit`, `TASK_desk_1..8` |
    | `CHAR_` | 3 | `CHAR_BASE` (armature), `CHAR_BASE_mesh`, `CHAR_BASE_stage` (salinan beku di verdict stage) |
    | `KIT_` | 9 | lihat tabel kit |
    | `KIT2_` (non-§6) | 6 | `KIT2_meshy_{wall_1m,window_1m,wall_door,floor_1m,pillar}`, `KIT2_glass_pane` |

    Objek lain tanpa prefix §6: `tile_*` 1.120, `window_*` 268, `wall_*` 171, `column_*` 36, `chair_*` 22, `slab_*` 16, `stair_*` 16, furnitur/eksterior kecil, `CAM_*` 9, `LIGHT_*`/`SUN`, `TGT_*` 9. Shape key: 0.
  - Kit (sumber + tris per piece, `count_tris`; "pakai" = jumlah objek yang berbagi mesh):

    | Objek | Sumber | Koleksi | Tris | Pakai |
    |---|---|---|---|---|
    | `KIT_wall_1m`, `KIT_wall_door`, `KIT_floor_1m`, `KIT_pillar`, `KIT_wall_glass_1m` | bpy | `KIT_BPY` | 12 / 48 / 12 / 12 / 12 | 2 / 2 / 1 / 1 / 28 |
    | `KIT_meshy_wall_1m`, `KIT_meshy_wall_door`, `KIT_meshy_floor_1m`, `KIT_meshy_pillar` | Meshy kit v1 (t2.5, 1024 tex) | `KIT_MESHY` | 1.500 / 1.407 / 1.082 / 1.290 | 5 / 3 / 73 / 1 |
    | `KIT2_meshy_wall_1m`, `_window_1m`, `_wall_door`, `_floor_1m`, `_pillar` | Meshy kit v2 (7.1, 4096 PBR) | `KIT_MESHY_V2` | 1.200 / 2.500 / 2.500 / 400 / 1.499 | 139 / 135 / 4 / 1.049 / 37 |

    Instance kit v2 di lantai (`CHECK_KIT_V2`): wall_1m 138, window_1m 134, wall_door 3, floor_1m 1.048 tile, pillar 36.
  - Polycount per koleksi (final `hq_v04`): `FLOOR_1` 231.732, `FLOOR_2` 251.456, `FLOOR_3` 251.456, `FLOOR_4` 251.480, `EXTERIOR` 522, `CHARACTERS` 19.499, `FLOOR_1_KIT_TEST` 45.695 (termasuk `KIT_TEST_CEILING` 12), `VERDICT_STAGE` 61.830, `KIT_BPY` 96, `KIT_MESHY` 5.279, `KIT_MESHY_V2` 8.111 (tiga koleksi sumber kit `hide_render`), `LIGHTING`/`CAMERAS` 0. Scene 1.127.156. Pembanding: v01 per koleksi di `23-polycount-v01.txt`, kit v1 di `42-kit-metrics.md`, karakter di `53-qa-v03.md`. Ada koleksi kosong `glTF_not_exported` sisa importer glTF.
  - Export ke GLB: KECUALIKAN `FLOOR_1_KIT_TEST` (+ `KIT_TEST_CEILING`), `VERDICT_STAGE` (masih ada di blend final), `KIT_BPY`, `KIT_MESHY`, `KIT_MESHY_V2` (koleksi sumber; instance di lantai harus di-bake/merge dulu sebelum export), `CAMERAS`, `LIGHTING`, `glTF_not_exported`. Karakter: `CHAR_BASE` + action `idle`; abaikan action sisa `Armature|clip0|baselayer` (1 frame). Lighting R3F tetap nilai §4.1 guide (tidak diubah MVP-2).
  - Aset raw (`apps/assets/raw/meshy/`, ukuran dari `stat`, detail `70b-asset-sizes.txt`): `PROMPTS.md`, `README.md`, `style_reference_kit.png` 0,8 MB, `style_reference_character.png` 0,9 MB, `char_base_raw.glb` 3,4 MB, `char_base_raw_base_color.png` 4,5 MB, `char_base_rigged.glb` 4,1 MB, `char_idle.glb` 4,1 MB, `char_walk.glb` 4,1 MB, `char_run.glb` 4,1 MB; `kit/KIT_{wall_1m,wall_door,floor_1m,pillar}.glb` 1,7-2,0 MB + `*_base_color.png` 2,9-4,3 MB; `kit_v2/KIT2_*_design.png` 0,2-0,6 MB. **> 10 MB, jangan masuk git:** `kit_v2/KIT2_floor_1m.glb` 34,7 MB, `KIT2_floor_1m_hi.glb` 25,5 MB, `KIT2_wall_1m.glb` 19,1 MB, `KIT2_wall_1m_hi.glb` 17,3 MB, `KIT2_window_1m.glb` 10,9 MB, `KIT2_window_1m_hi.glb` 23,6 MB, `KIT2_window_1m_tex1.glb` 24,7 MB, `KIT2_wall_door.glb` 10,7 MB, `KIT2_wall_door_hi.glb` 19,4 MB, `KIT2_wall_door_tex1.glb` 23,3 MB, `KIT2_pillar.glb` 13,4 MB, dan `apps/assets/blender/hq_v04.blend` 93,3 MB. `*_hi.glb` (pra-remesh) dan `*_tex1.glb` (pra-retexture) = backup, tidak dipakai build.
- Keterbatasan / catatan:
  - Berat untuk web: 1,13 jt tris dan tekstur ~0,6-0,7 GiB tanpa kompresi (estimasi, bukan ukur). MVP-3 WAJIB decimate/LOD/merge + KTX2/downscale sebelum `hq.glb`.
  - Kit v2: daun pintu jadi abu-teal setelah retexture (bukan teal brief); dinding jendela sedikit abu dingin dibanding saudaranya; tonjolan ornamen jendela masih ada sebagai geometri. Semua piece Meshy (v1 dan v2) di-stretch non-uniform ke ukuran metrik. Lantai kit v1 kontras rendah.
  - Furniture masih kotak bpy datar; objek non-kit hanya material palet bpy tanpa tekstur. `FURNITURE_STUB` sudah dihapus (tidak ada di kode maupun blend).
  - Interior terlihat berkabut lewat kaca. `hq_v01`/`hq_v02` tampil abu di viewport Solid (tekan Z, pilih Material Preview); fix `diffuse_color` mulai `hq_v03` (opsi A user).
  - Render hanya headless; night hanya satu view (`hq_v01_iso_night.png`). Tidak ada shape key (`face_blink/smile/talk`) dan baru 1 clip (`idle`) dari 7 clip §5.1; walk/run belum di-import.
  - Sesi Blender MCP live hanya dipakai untuk cek paritas, bukan sumber build. Plugin Meshy Blender tidak bisa dipakai di Linux.
  - Bukti lengkap: `.omo/evidence/mvp-2-blender-lab/` (QA `22`, `41`, `53`, `64`; checkpoint `25`, `45`, `55`; verdict `61`; ledger `meshy-ledger.md`; dump final `70`).

## Koreksi — Strategi Render MVP-3 (2026-10-18)
- Catatan MVP-2 "MVP-3 WAJIB decimate/LOD/merge + KTX2/downscale" **dibatalkan** oleh keputusan user #21 (guide §7.5): "rendernya per 1 lantai gak langsung 1 gedung ... saya gk mau ngurangi kualitas karakter scenery dll".
- Pengganti: GLB per lantai `floor_1..4.glb` lazy-load + `hq_shell.glb` eksterior; helicopter = cutaway lantai aktif; instancing + meshopt + KTX2 tanpa downscale (≤ 2048²); TANPA decimate karakter/furniture/scenery; angka renderer.info per lantai = info. Lantai berat → instancing/culling dulu, decimate hanya dengan izin user.
