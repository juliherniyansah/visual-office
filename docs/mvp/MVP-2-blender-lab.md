# MVP-2 — Blender Visual Lab (pure Blender, tanpa kode web)

**Goal:** semua keputusan visual 3D dibuktikan di Blender dulu: gedung + Floor 1 (bpy), uji Kit Meshy vs bpy untuk dinding/lantai, karakter Meshy — dalam satu scene, dinilai berdampingan.
**Demo:** buka `apps/assets/blender/hq_vNN.blend` di Blender desktop Anda + render PNG iso & eye-level yang sudah Anda setujui.
**Butuh:** MVP-0 (visi terkunci di guide). **Tidak butuh MVP-1** — tidak menyentuh `apps/web`, aman paralel.
**Persiapan manual:** Blender desktop terbuka + addon MCP aktif (port 9876). Meshy saja (Sloyd ditunda, guide §3):
- **Meshy Free** (100 kredit/bulan, web saja, TANPA API, CC BY 4.0): Anda generate di web meshy.ai, download GLB, taruh di `apps/assets/raw/meshy/` (kit → `apps/assets/raw/meshy/kit/`).
- **Meshy Pro** ($20, 1.000 kredit, ada API): isi `MESHY_API_KEY` di `.env` lokal → agent generate otomatis.

**Handoff:** `build_hq.py`, `.blend` approved, aset Meshy mentah, verdict Level 1 vs Level 2 → dipakai MVP-3.

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-2 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §1, §3
termasuk baris 'Hybrid Meshy' + 'Langganan', §4 + §4.1 Atmosfer, §5 + §5.1, §6 Naming termasuk
KIT_*, §7.1 langkah 6a, §7.2, §9 quirk Blender 5), docs/mvp/README.md, docs/mvp/HANDOFF.md.
Guide = sumber kebenaran; konflik → guide menang.
Saya mengizinkan implementasi untuk scope MVP-2 ini saja.

SCOPE KERAS: murni Blender + aset. DILARANG menyentuh apps/web, apps/api, packages/*,
dan apps/web/public/models/. Tidak ada export ke web di MVP ini (itu MVP-3). Sloyd TIDAK dipakai.

Prasyarat (cek dulu, STOP & pandu saya bila gagal):
- blender_get_addon_status OK (Blender 5.0.1, server MCP 127.0.0.1:9876).
- Mode Meshy: ada MESHY_API_KEY di .env (Pro, otomatis via API) ATAU tidak ada (Free, manual):
  mode manual → beri saya prompt Meshy siap-tempel (style preset §4 + reference image sama),
  tunggu saya taruh GLB di apps/assets/raw/meshy/, baru lanjut. Jangan coba API tanpa key.
- Quirk Blender 5 (guide §9): engine 'BLENDER_EEVEE'; screenshot viewport tidak andal →
  render Eevee ke file PNG lalu Read; scene tidak persist → save .blend tiap iterasi.

FASE 2a — Gedung + Floor 1 (procedural bpy, baseline):
1. Tulis apps/assets/blender/build_hq.py = sumber kebenaran, idempotent (hapus & bangun
   ulang collection-nya), bisa jalan via MCP dan headless `blender -b -P build_hq.py`.
2. Massing 4 lantai (footprint & tinggi lantai sesuai guide §4), lantai 2–4 shell saja.
3. Floor 1 detail: ROOM_lobby, ROOM_meeting_a, ROOM_workstation_a, koridor, tangga.
   Kit modular bpy (dinding 1m, kolom, kaca, pintu) via linked duplicates. Furniture procedural
   (desk, kursi, monitor, meja meeting). Palet & lighting dari §4.1.
4. Naming kontrak §6: FLOOR_n, ROOM_<id>, COL_* (hidden render), NAV_spawn_lobby,
   NAV_cam_floor1, TASK_board (meeting), TASK_desk_<n> (workstation).
5. Render Eevee: iso (helicopter) + eye-level lobby + eye-level workstation → PNG.
   Save apps/assets/blender/hq_v01.blend.
   ⏸ CHECKPOINT: tunjukkan render + checklist QA §4, iterasi sampai saya approve.

FASE 2b — Uji Kit Meshy (Level 2) vs bpy:
6. Siapkan 3–4 potongan kit Meshy, satu objek per generate: KIT_wall_1m (panel 1×3.2m),
   KIT_wall_door (dinding+pintu atau kaca), KIT_floor_1m, opsional pilar/kusen. Prompt preset
   + reference image sama untuk semua potongan. Simpan di apps/assets/raw/meshy/kit/.
7. Normalisasi via bpy (guide §7.1 langkah 6a): skala ke grid 1m, pivot di dasar, Remesh
   (0 kredit) bila perlu, rapikan seam tepi, fallback vertex color bila tekstur bentrok §4.
8. Jahit SATU ruangan contoh (ROOM_meeting_a duplikat, mis. ROOM_meeting_a_kit) via snap +
   instancing di posisi terpisah. COL_*/NAV_*/ROOM_/TASK_ tetap dari bpy.
9. Render side-by-side: ruangan full bpy vs ruangan Kit Meshy (sudut & lighting identik).
   Catat polycount, kredit terpakai, masalah seam/celah/skala. Save hq_v02.blend.
   ⏸ CHECKPOINT: saya nilai. Maks 6 generate kit tanpa izin ulang.

FASE 2c — Karakter Meshy:
10. Generate 1 karakter (prompt dari §5.1, low-poly sesuai §4) → apps/assets/raw/meshy/.
    API (Pro): poll job, download GLB. Manual (Free): saya yang taruh GLB. Catat kredit.
11. Import ke scene, skala ±tinggi §5.1, taruh di NAV_spawn_lobby. Rig + animasi idle via
    Meshy (Rigging/Animate 0 kredit) bila tersedia di paket; tidak bisa → catat, jangan dipaksa.
12. Render lobby dengan karakter. Save hq_v03.blend.
    ⏸ CHECKPOINT: approve karakter / revisi prompt (maks 3 generate tanpa izin ulang).

FASE 2d — Verdict:
13. Render perbandingan: furniture bpy vs kit Meshy vs karakter Meshy dalam satu frame.
    Nilai konsistensi satu bahasa visual (§3 'Konsistensi style', §4 'Konsistensi interior').
14. Rekomendasikan: dinding/lantai final Level 1 (bpy) atau Level 2 (Kit Meshy); furniture
    kompleks Meshy atau bpy. Tanya saya, lalu tulis keputusan ke guide §3 + §11 changelog,
    sync .html. Bila Level 2 dipilih: update build_hq.py agar memakai KIT_* untuk Floor 1.

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: path build_hq.py, .blend final,
render PNG, daftar objek per naming §6 (termasuk KIT_*), path aset raw, polycount per objek,
kredit Meshy terpakai, mode Meshy (Free manual / Pro API), verdict Level 1/2, keterbatasan.

Batasan: socket MCP hanya localhost, jangan expose. Jangan commit git atau .env kecuali
saya minta. Aset raw >10MB jangan masuk git (catat di HANDOFF). Aset Meshy Free = CC BY 4.0,
catat atribusi di HANDOFF.
Definition of Done: .blend + render approved, verdict tertulis di guide, HANDOFF ter-update.
```
