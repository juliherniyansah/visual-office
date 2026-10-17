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
