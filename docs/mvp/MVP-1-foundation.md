# MVP-1 — Fondasi Web 3D Rapi

**Goal:** dashboard lama tetap tampil identik, tapi fondasi kode siap menerima gedung baru.
**Demo:** `bun run dev` → dashboard render seperti sebelumnya, tanpa error; kode 3D terpecah rapi.
**Handoff:** deps 3D dideklarasi + komponen `apps/web/src/components/office/*` → dipakai MVP-3 (MVP-2 Blender tidak butuh ini).

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-1 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §1, §9),
docs/mvp/README.md, dan docs/mvp/HANDOFF.md (jika ada). Guide = sumber kebenaran; konflik → guide menang.
Saya mengizinkan implementasi untuk scope MVP-1 ini saja.

GOAL MVP-1: fondasi web 3D rapi tanpa mengubah tampilan.

Bagian 1 — Deklarasi dependensi:
1. Cek versi ter-resolve sekarang untuk three, @react-three/fiber, @react-three/drei
   (node_modules/<pkg>/package.json). Saat ini ketiganya TIDAK dideklarasi di
   apps/web/package.json (jalan via bun hoisting) — rapuh.
2. Deklarasikan di apps/web/package.json dengan ^<versi ter-resolve>. Jangan upgrade major,
   jangan sentuh paket lain. Tambah @types/three bila typecheck membutuhkan.
3. bun install di root.

Bagian 2 — Pecah monolith:
4. apps/web/src/components/OfficeCanvas.tsx (±417 LOC) berisi Building, FloorPlane,
   DeskMarkers, Agent, CameraRig, FloorSelector, WebGLErrorBoundary, lighting inline.
   Pecah ke apps/web/src/components/office/ (OfficeCanvas.tsx root, Building.tsx,
   FloorPlane.tsx, DeskMarkers.tsx, Agent.tsx, CameraRig.tsx, FloorSelector.tsx,
   Lighting.tsx, WebGLErrorBoundary.tsx).
5. PINDAHKAN kode apa adanya: perilaku, warna, posisi, kamera tidak berubah. Jangan
   "sekalian memperbaiki". Biarkan inline material (dirapikan di MVP-3).
6. Update import di apps/web/src/app/dashboard/page.tsx (dynamic import tetap).
   Hapus file lama setelah semua import pindah.
7. Building.tsx: path GLB jadikan satu konstanta (BUILDING_MODEL_URL) agar MVP-3 cukup ganti
   satu baris.

Verifikasi (wajib bukti, jangan klaim):
- bun run typecheck dan bun run lint lulus (catat error pre-existing terpisah).
- bun run dev → buka dashboard di browser (Playwright) → screenshot → bandingkan dengan
  screenshot SEBELUM refactor (ambil di awal sesi). Console tanpa error baru.

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: versi deps, daftar file baru + LOC,
lokasi konstanta BUILDING_MODEL_URL, screenshot path, error pre-existing bila ada.

Batasan: jangan sentuh Blender, GLB, backend. Jangan commit git kecuali saya minta.
Definition of Done: tampilan identik, typecheck/lint lulus, HANDOFF.md ter-update.
```
