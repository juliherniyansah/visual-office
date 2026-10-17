# MVP-2 — Gedung Low-Poly Baru Tampil di Browser

**Goal:** gedung Redhunter HQ hasil Blender (4 lantai massing + Floor 1 detail) tampil di dashboard.
**Demo:** buka dashboard → gedung low-poly baru, orbit/zoom jalan; render PNG Blender sebagai bukti.
**Butuh:** MVP-0 (Atmosfer/palet), MVP-1 (`BUILDING_MODEL_URL`), Blender desktop + addon MCP aktif.
**Handoff:** `hq.glb` + `build_hq.py` + naming FLOOR_/ROOM_/COL_/NAV_ → MVP-3 & MVP-4.

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-2 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP, docs/mvp/README.md,
dan docs/mvp/HANDOFF.md. Guide = sumber kebenaran; konflik dengan skill/insting → guide menang.
Style WAJIB §4 + sub-bagian "Atmosfer" (palet hex, lighting, sky dari MVP-0) — jangan
improvisasi palet/lighting sendiri. Interior SATU bahasa visual dengan exterior. Naming WAJIB §6.
Jika §4 Atmosfer belum ada (MVP-0 belum jalan) → STOP dan tanya saya.
Saya mengizinkan implementasi untuk scope MVP-2 ini saja.

Tools: MCP "blender" (mcp-for-blender, Blender 5.0.1 desktop, socket 127.0.0.1:9876).
Quirk Blender 5 (guide §9): engine 'BLENDER_EEVEE' (bukan EEVEE_NEXT); viewport screenshot
sering gelap → SELALU render ke PNG lalu baca file; scene hilang saat restart → save .blend
tiap iterasi; cari shader node via n.type == "BSDF_PRINCIPLED".
Load skill: 3d-router, blender2three-export, blender2three-web, 3d-visual-qa.

GOAL MVP-2 (3 fase, checkpoint persetujuan saya di antara fase):

FASE 1 — Massing (apps/assets/blender/build_hq.py = sumber kebenaran, rebuildable via
`blender -b -P build_hq.py`):
1. CONFIG: footprint 20×14 m, 4 lantai, tinggi lantai 3.2 m, grid kolom 4 m.
2. Palet flat dari §4 Atmosfer. Builder modular: make_box, make_wall, make_floor_slab,
   make_column, make_stairs, set_flat_material.
3. Bangun 4 lantai massing (slab, dinding luar + bukaan jendela, core tangga, roof),
   collection FLOOR_1..FLOOR_4. Lingkungan luar sesuai §4 Atmosfer (dunia luar gedung).
4. Save apps/assets/blender/hq_v01.blend. Render isometrik + eye-level → PNG → baca →
   checklist QA §4. Tunjukkan render ke saya. ⏸ CHECKPOINT: tunggu persetujuan saya.

FASE 2 — Floor 1 detail (build_floor_1() di build_hq.py):
5. Lobby (reception, sofa, tanaman), ROOM_meeting_a (kaca), 8 workstation (desk, monitor,
   kursi), koridor, tangga fungsional ke Floor 2. Furniture via builder modular
   (make_desk, make_chair, make_monitor, make_sofa, make_plant), linked duplicates, snap grid.
6. Naming: ROOM_lobby, ROOM_meeting_a, ROOM_workstation_a, COL_* (dinding/furniture besar,
   hidden render), NAV_spawn_lobby, NAV_cam_floor1, TASK_board (di meeting room),
   TASK_desk_<n> (tiap workstation) — anchor kosong untuk MVP-5.
7. Save hq_v02.blend. Render 3 PNG (iso floor-1-isolated, eye-level lobby, eye-level
   workstation) → checklist §4 → revisi bila gagal. ⏸ CHECKPOINT: tunggu persetujuan saya.

FASE 3 — Export & tampil di web:
8. Script apps/assets/blender/export_glb.py: export headless GLB (+Y up). Putuskan & catat:
   COL_* diekspor dengan nama utuh (R3F menyembunyikan & memakai untuk collision di MVP-3).
9. Optimasi gltf-transform (meshopt; KTX2 hanya bila ada tekstur). Inspect: mesh count,
   material count, ukuran, naming utuh. Tampilkan tabel inspect.
10. Simpan apps/web/public/models/hq.glb. Rename building.glb lama → building_legacy.glb.
    Ganti BUILDING_MODEL_URL (dari MVP-1) ke /models/hq.glb. Sembunyikan COL_* saat render.
    Hapus inline material override yang menimpa material GLB.
11. bun run dev → dashboard (Playwright) → screenshot. Orbit/zoom jalan, console bersih.
    Ukur draw calls & fps (renderer.info).

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: versi .blend final, ukuran GLB,
daftar nama ROOM_/COL_/NAV_/TASK_ yang tersedia, draw calls/fps, keterbatasan.

Batasan: Floor 2–4 tetap massing. Tidak pakai Meshy/Sloyd. Tidak ubah logika kamera/floor
selector (itu MVP-3). Jangan commit git kecuali saya minta.
Definition of Done: render disetujui, hq.glb tampil di dashboard, inspect bersih, HANDOFF ter-update.
```
