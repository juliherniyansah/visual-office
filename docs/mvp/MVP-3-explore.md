# MVP-3 — Menjelajah Kantor (Helicopter + FPV + Minimap)

**Goal:** kantor bisa dijelajah seperti game: pilih lantai, fokus ruangan, jalan first-person, minimap.
**Demo:** klik lantai → terisolasi; klik ruangan → kamera fokus; toggle FPV → WASD jalan dari lobby naik tangga; minimap live.
**Butuh:** MVP-2 (`hq.glb` dengan ROOM_/COL_/NAV_), MVP-0 (§8.4 Game Feel).
**Handoff:** store kamera/mode + sistem interaksi → MVP-5 (tekan E di desk, klik task board).

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-3 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §1, §3,
§6, §8.4 Game Feel), docs/mvp/README.md, docs/mvp/HANDOFF.md (daftar nama ROOM_/COL_/NAV_
dari MVP-2). Guide = sumber kebenaran; konflik → guide menang.
Saya mengizinkan implementasi untuk scope MVP-3 ini saja.
Load skill: 3d-router, threejs-react, threejs-camera, threejs-performance, 3d-visual-qa.
Physics: raycast/capsule saja (guide §3). Rapier HANYA jika terbukti perlu — tanya saya dulu.
Jangan tambah dependency tanpa izin (three-mesh-bvh boleh diusulkan, minta izin).

Referensi pola (jangan salin aset): Nexus HQ (zones), Huddly (WASD, Tab toggle UI, E
interaksi), Aura Plan (PointerLockControls + collision), bruno-simon.com (map, game feel).

GOAL MVP-3 (3 fase, checkpoint demo di antara fase):

FASE 1 — Helicopter view:
1. Zustand store tunggal (ikuti pola store yang ada): mode ('helicopter'|'fpv'), activeFloor,
   focusedRoom.
2. Floor switching: klik FLOOR_<n> / FloorSelector → lantai lain fade/hide, kamera transisi
   smooth ke lantai itu.
3. Room selection: hover ROOM_* → highlight sesuai §8.4 (juice level dari MVP-0); klik →
   kamera fokus ke bounding box + label nama ruangan (drei Html). Tombol reset view.
4. Opening experience sesuai §8.4 (helicopter langsung / cinematic intro / FPV).
   ⏸ CHECKPOINT: screenshot tiap state, tunggu persetujuan saya.

FASE 2 — FPV:
5. Toggle mode → FPV spawn di NAV_spawn_lobby. PointerLockControls + Esc keluar + hint
   "WASD bergerak · Esc keluar" (hilang 5 detik).
6. WASD + mouse-look, ~1.4 m/s, eye height 1.6 m. Collision capsule/raycast vs COL_*
   (COL_* tetap invisible). Tangga Floor 1 → 2 bisa dinaiki.
7. Ukur fps sebelum/sesudah collision. Target ≥ 50 fps. ⏸ CHECKPOINT: demo ke saya.

FASE 3 — Minimap:
8. Minimap pojok bawah (orthographic top-down kedua ATAU canvas 2D dari ROOM_* — pilih
   lebih murah, ukur). Style ikut §4 (flat, aksen merah).
9. Marker posisi player / fokus kamera + indikator lantai aktif. Klik minimap → kamera pindah.

Verifikasi (bukti, bukan klaim): Playwright test minimal: (a) klik lantai 1 → lantai lain
hidden, (b) masuk FPV → kamera di spawn. Screenshot tiap fitur. Laporkan fps & draw calls.

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: struktur store, cara komponen lain
menambah "interactable" (untuk MVP-5: tekan E dekat TASK_desk_*, klik TASK_board), fps.

Batasan: tidak ubah GLB/Blender (jika naming kurang → catat di HANDOFF, jangan edit).
Tidak integrasi task/agent. Jangan commit git kecuali saya minta.
Definition of Done: 3 fase berfungsi, test lulus, fps ≥ 50, HANDOFF ter-update.
```
