# MVP-3 — Export & Integrasi Web

**Goal:** gedung + karakter yang sudah di-approve di Blender tampil di dashboard web.
**Demo:** `bun run dev` → dashboard menampilkan shell gedung + Floor 1 detail (dimuat per lantai), satu agent beranimasi idle di lobby, kualitas setara render MVP-2.
**Butuh:** MVP-1 (deps + `components/office/*`, konstanta `BUILDING_MODEL_URL`), MVP-2 (`.blend` approved + aset).
**Handoff:** `hq_shell.glb` + `floor_N.glb` + `char_base.glb` live, loader per lantai, loader node `COL_*`/`NAV_*`/`TASK_*` → dipakai MVP-4.

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-3 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §1, §4,
§6, §7 terutama §7.5 render per lantai, §11 #19–#21), docs/mvp/README.md, docs/mvp/HANDOFF.md (hasil MVP-1 & MVP-2). Juga baca
apps/web/AGENTS.md. Guide = sumber kebenaran; konflik → guide menang.
Saya mengizinkan implementasi untuk scope MVP-3 ini saja.

SCOPE: export + tampil di web. Keputusan visual sudah final di MVP-2 — jangan redesign model.
Perubahan model hanya bila export rusak; lakukan di build_hq.py, bukan edit manual .blend.

ATURAN KUALITAS (guide §7.5, keputusan #21):
- Render per lantai, bukan satu gedung. Hanya lantai aktif yang dimuat.
- DILARANG decimate karakter, furniture, scenery demi angka tris. Kualitas MVP-2 dipertahankan.
- Lantai berat → instancing/culling dulu; decimate hanya dengan izin saya.
- renderer.info & FPS = info yang dilaporkan, bukan target pangkas.

FASE 1 — Export per lantai:
1. Script headless apps/assets/blender/export_hq.py: buka .blend final dari HANDOFF, apply
   transforms, export terpisah:
   - apps/web/public/models/hq_shell.glb — eksterior ringan untuk helicopter view.
   - apps/web/public/models/floor_1.glb .. floor_4.glb — isi FLOOR_n (interior, furniture,
     COL_* ditandai invisible, NAV_/TASK_ sebagai empties). Lantai yang belum detail boleh
     berisi blockout saja.
   - extras on, naming §6 utuh.
2. Optimasi gltf-transform: meshopt + tekstur KTX2 (resolusi tetap ≤ 2048², jangan downscale),
   instancing (EXT_mesh_gpu_instancing) untuk kit dinding/lantai & furniture berulang.
3. Verifikasi tiap GLB: daftar node sesuai §6, tris, draw calls estimasi, ukuran file. Catat
   tabel per lantai. Lantai yang terasa berat → laporkan + usulan (instancing/culling), tunggu saya.
   ⏸ CHECKPOINT: tabel ukuran/tris per GLB, tunggu approve.

FASE 2 — Gedung di R3F:
4. Building.tsx (MVP-1, BUILDING_MODEL_URL): ganti ke loader per lantai — hq_shell.glb selalu,
   floor_N.glb lazy-load saat lantai dipilih (FloorSelector), lantai lain di-unload. Helicopter
   view = shell + cutaway lantai aktif saja. Sembunyikan COL_*. Hapus inline material yang
   menimpa material/tekstur GLB. Lighting sesuai §4.1.
5. Helper kecil baca node by prefix (COL_, NAV_, TASK_) untuk dipakai MVP-4/5 — satu file,
   tanpa abstraksi lebih.
6. Ukur renderer.info (calls/triangles) + FPS per lantai di browser; catat sebagai info.
   ⏸ CHECKPOINT: screenshot browser (Playwright) vs render Blender MVP-2 + angka per lantai,
   tunggu approve. Update baseline visual regression MVP-1 bila tampilan berubah sah.

FASE 3 — Karakter:
7. Export karakter Meshy (tanpa decimate) (rig + idle) → apps/web/public/models/char_base.glb (skeleton CHAR_BASE).
8. Tampilkan di NAV_spawn_lobby, AnimationMixer idle. Agent lama (procedural) dibiarkan
   atau diganti — tanya saya.
9. Verifikasi: screenshot, console bersih, FPS dicatat (renderer.info calls/triangles).

Verifikasi wajib: bun run typecheck, bun run lint lulus (pre-existing dicatat terpisah).

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: path script export, tabel per GLB
(ukuran, tris, draw calls, FPS per lantai), nama helper node, screenshot, keterbatasan.

Batasan: jangan sentuh backend. Jangan commit git kecuali saya minta.
Definition of Done: shell + Floor 1 dimuat per lantai, agent tampil, kualitas setara render MVP-2
(tanpa decimate), typecheck/lint lulus.
```
