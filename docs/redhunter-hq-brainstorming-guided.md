---
doc: redhunter-hq-guide
type: ai-rules-and-guide
status: brainstorming — NO implementation approved yet
scope: 3D world, Blender pipeline, characters, assets, task gamification
applies_to: every AI agent and every 3D skill (threejs-*, blender2three-*, 3d-*)
repo: /home/programer/work/redhunter-reborn/visual-office
language: Indonesian prose, English identifiers
---

# Redhunter HQ — AI Rules & Guide

> **Untuk AI agent:** baca file ini SEBELUM task 3D, Blender, aset, karakter, atau task-integration apapun.
> Skill 3D general = **HOW** (cara teknis). File ini = **WHAT** (apa yang dibangun, style, aturan proyek).
> Jika file ini konflik dengan skill → **file ini menang**. Jika konflik dengan pesan user terbaru → **user menang**, lalu update file ini.

---

## 0. Cara Membaca File Ini (untuk AI)

| Bagian | Isi | Kapan dibaca |
|---|---|---|
| §1 Hard Rules | Larangan & kewajiban mutlak | **Selalu** |
| §2 Status & Gate | Apa yang boleh dikerjakan sekarang | **Selalu** |
| §3 Keputusan Terkunci | Pilihan yang sudah final — jangan dibuka ulang | Sebelum mengusulkan tool/style |
| §4 Style Spec | Spesifikasi visual terukur | Task modeling/render/material |
| §4.1 Atmosfer | Palet, waktu, lighting, dunia luar | Task lighting/palet/exterior |
| §5 Karakter | Preferensi + sistem DIY avatar | Task karakter/agent |
| §6 Naming Contract | Nama objek wajib Blender ↔ R3F | Task Blender, export, R3F |
| §7 Workflow | Langkah urut pipeline | Saat eksekusi disetujui |
| §8 Task & Gamification | Integrasi task/Trello | Task backend/UI task |
| §8.4 Game Feel | Entry, juice, perilaku agents, progresi, ambient | Task kamera/agent/UI |
| §9 Fakta Lingkungan | Hasil audit, quirk Blender 5 | Sebelum menulis script |
| §10 Referensi | Repo & aset pembanding | Saat butuh contoh |
| §11 Changelog Preferensi | Riwayat keputusan user | Saat ragu niat user |

Tingkat aturan: **MUST** = wajib, **MUST NOT** = dilarang, **SHOULD** = default kecuali ada alasan, **TBD** = belum diputuskan — tanya user, jangan mengarang.

---

## 1. Hard Rules

### MUST
1. **MUST** baca §2 dulu; jika gate belum dibuka user → hanya riset/dokumentasi, tanpa implementasi.
2. **MUST** ikuti style §4 untuk semua aset (gedung, interior, props, karakter).
3. **MUST** pakai naming §6 untuk setiap objek Blender yang akan diekspor.
4. **MUST** simpan scene sebagai `hq_vNN.blend` tiap iterasi (scene hilang saat Blender restart).
5. **MUST** jadikan `apps/assets/blender/build_hq.py` sumber kebenaran scene (rebuildable: `blender -b -P build_hq.py`).
6. **MUST** verifikasi visual dengan **render Eevee ke file PNG** lalu baca file — bukan klaim.
7. **MUST** simpan API key (Meshy/Sloyd/Trello) hanya di `.env` lokal yang di-gitignore.
8. **MUST** jaga business logic di backend (Express/MongoDB); objek 3D hanya visual + trigger UI.
9. **MUST** update §11 Changelog bila user mengubah preferensi.

### MUST NOT
1. **MUST NOT** blockout Floor 1, clone Nexus HQ/Huddly, atau ubah kode tanpa persetujuan eksplisit user di pesan saat itu.
2. **MUST NOT** bangun 4 lantai detail sekaligus — Floor 1 dulu, evaluasi, baru perluas.
3. **MUST NOT** generate gedung/ruangan utuh sebagai satu mesh via Meshy/Sloyd (monolitik, tidak bisa floor-switch/collision per dinding). Yang boleh: **potongan kit modular** (panel dinding, lantai, pintu, tangga) yang dijahit bpy — lihat §3 'Kit Meshy'.
4. **MUST NOT** pakai tekstur blur/noise, bentuk "meleleh", atau smooth shading di luar auto-smooth ≤ 30° (lihat §4).
5. **MUST NOT** expose socket Blender MCP (`127.0.0.1:9876`) ke Tailscale/jaringan — `execute_blender_code` = Python arbitrer.
6. **MUST NOT** membuat endpoint backend fiktif, status agent palsu, atau mock task permanen di scene.
7. **MUST NOT** mengubah `apps/web/src/components/office/` di luar plan MVP aktif (MVP-1 memecah `OfficeCanvas.tsx` ke folder ini; edit lanjutan mengikuti plan MVP).
8. **MUST NOT** berlangganan/menyarankan bayar tool sebelum uji free tier (§3).
9. **MUST NOT** menyalin desain/branding/aset berhak cipta dari referensi (bruno-simon.com, Fab, Samantrix).

---

## 2. Status & Gate

| Item | Status |
|---|---|
| Fase | **Brainstorming / dokumentasi** |
| Implementasi besar | ⛔ Menunggu persetujuan user |
| Blender MCP | ✅ Terpasang & smoke test lulus |
| Audit repo + R3F | ✅ Selesai (§9) |
| Style, tooling, karakter, task concept | ✅ Diputuskan (§3) |
| Pending keputusan | Blockout Floor 1 langsung **vs** preview Nexus HQ/Huddly dulu |

**Gate dibuka hanya jika** pesan user saat itu berisi kata kerja eksplisit (buat / bangun / implement / mulai / eksekusi) untuk task tersebut. Izin turn sebelumnya tidak berlaku.

---

## 3. Keputusan Terkunci

Jangan buka ulang kecuali user meminta.

| Topik | Keputusan | Alasan singkat |
|---|---|---|
| Produk | **Redhunter HQ** — Interactive 3D AI Virtual Office, tagline "Where Humans and AI Work Together" | 3D = antarmuka operasional, bukan dekorasi |
| Style | **Mid-poly stylized bertekstur tajam** (siluet low-poly ala bruno-simon.com + tekstur hand-painted bersih; bukan dark glass foto-realistis) | Achievable via bpy + Meshy t2.5, ringan, konsisten; user m0019 MVP-2 |
| Stack web | Next.js 16, React 19, Three.js, R3F, Drei, Tailwind 4, shadcn/ui | Sudah ada di repo |
| Backend | Express 5, MongoDB/Mongoose, Socket.IO, Tailscale | Source of truth |
| Pipeline | Blender → GLB → Next.js + R3F | Blender authoring, R3F interaksi |
| MCP | **mcp-for-blender saja** (`uvx mcp-for-blender`) | Hindari MCP tumpang tindih |
| Konsistensi style | **Satu bahasa visual untuk SEMUA objek**: exterior, interior, furniture, karakter, props = mid-poly stylized, siluet tegas, tekstur hand-painted tajam atau palet flat. Tidak ada campuran foto-realistis/PBR | Transisi helicopter↔FPV mulus, agents terlihat "menghuni", satu sistem lighting |
| Gedung/interior/furniture/terrain | **Procedural bpy** via MCP = default. Collider `COL_*`, `NAV_*`, `ROOM_*`/`TASK_*` naming & layout **selalu bpy** | Modular, $0, kontrol penuh |
| Hybrid Meshy (conditional) | **Level 1 (default)**: Meshy per objek (furniture/props kompleks), bpy struktur. **Level 2 = Kit Meshy**: Meshy generate **potongan kit modular** (panel dinding 1×3.2 m, panel dinding+pintu/jendela/kaca, panel lantai, tangga, pilar, kusen) → bpy normalisasi skala ke grid 1 m, pivot dasar, snap, instancing, susun sesuai denah. **Bukan per ruangan.** **Hasil uji MVP-2 (2026-10-18): Level 2 dipilih untuk dinding/lantai (kit Meshy v2: 1 panel per jenis, realistis 4K, bpy merakit); furniture kompleks = Meshy.** Alasan: user memilih tampilan realistis bergaya poly; uji verdict menunjukkan gaya tekstur kit dan karakter konsisten, biaya tris (~1,1 jt di hq_v04) ditangani di MVP-3 lewat decimate/LOD + KTX2. | Reuse = hemat kredit & style konsisten; grid presisi tanpa celah/dinding dobel; revisi murah |
| Karakter | **Meshy = generator utama** (auto-rig + 600+ motions) | Kualitas dinilai user "cukup baik" |
| Props variatif | Sloyd **ditunda** (opsional nanti); props sederhana = bpy, kompleks = Meshy | Satu langganan dulu |
| Rigging gratis | Mixamo | Alternatif tanpa biaya |
| Langganan | **Meshy saja dulu.** Free (100 kredit/bln) = web app saja, **tanpa API**, lisensi CC BY 4.0 → uji manual (download GLB, agent import via MCP). Pro ($20/bln, 1.000 kredit) = API untuk otomasi, ambil setelah uji lolos | Anti salah bayar |
| Interaksi layout | 100% di R3F | Blender hanya kirim GLB bernama |
| Physics | Raycast/capsule collision; Rapier hanya jika perlu | Hindari kompleksitas |
| Task data | **Kombinasi**: backend Redhunter + Trello sync dua arah | User memilih |

---

## 4. Style Spec (terukur)

Kutipan user: *"walau poly, saya mau poly yang bagus, realistis gk buram"*.

| Properti | Nilai wajib |
|---|---|
| Gaya | Mid-poly stylized, playful, gamified, **clean & tajam** |
| Shading | Auto-smooth ≤ 30° (sudut tajam tetap tajam). Flat untuk geometri bpy |
| Material | Tekstur hand-painted tajam (Meshy) atau vertex colors/palet (bpy); 1 shared material/atlas per objek bila bisa |
| Tekstur bitmap | Diizinkan; wajib tajam di kamera dekat, ≤ 2048² karakter, ≤ 1024² kit/prop, tanpa noise/blur |
| Aksen | Merah Redhunter terkendali: signage, core tangga, detail kecil |
| Skala | Meter real-world, origin di ground (y=0) |
| Grid modular | Dinding segmen 1 m, tinggi lantai 3.2 m, kolom grid 4 m, props snap 0.8–1 m |
| Batas bawah kualitas | Setara output Meshy t2.5 + refine 2k/4k |
| Realisme | Boleh sedikit (proporsi, lighting) selama tetap stylized |

**Konsistensi interior (MUST):** interior ikut style yang sama dengan exterior. Variasi dicapai lewat **bentuk, prop, dan palet**, bukan tekstur foto-realistis:
- Palet interior boleh lebih hangat (krem/abu terang) dari exterior; aksen merah tetap terkendali
- Zona warna per fungsi (kerja, meeting, lounge, AI Core) — style sama, aksen beda
- Kekayaan visual dari siluet prop (rak, tanaman, lampu, whiteboard, sofa), tetap §4 shading
- Aset Meshy/Sloyd untuk interior wajib lolos checklist di bawah; gagal → regenerate atau ganti bpy

**Tolak (anti-pattern visual):** campuran objek foto-realistis PBR dengan objek stylized dalam satu scene, bentuk meleleh/blobby, siku tidak 90° tanpa alasan, skala antar-aset tidak konsisten, warna acak di luar palet, neon berlebihan, dekorasi acak, bangunan kotak generik tanpa siluet.

**Checklist QA render (jalankan tiap iterasi):**
- [ ] Siluet terbaca dari kamera isometrik **dan** eye-level
- [ ] Tidak ada permukaan blur/noise
- [ ] Aksen merah tidak dominan
- [ ] Skala manusia 1.7 m masuk akal terhadap pintu/desk
- [ ] Naming §6 lengkap

### 4.1 Atmosfer (MVP-0, terkunci)

| Properti | Nilai |
|---|---|
| Vibe | Startup playful: warna cerah-pastel, prop fun (bean bag, tanaman, mural dinding), tetap §4 |
| Waktu | Day-night cycle, 4 fase: pagi 06–10, siang 10–16, senja 16–19, malam 19–06 (jam lokal client; transisi lerp ≤ 60 s) |
| Palet "Playful Pastel" | Exterior `#F4EFE6` · Interior `#FFF8F0` · Lantai `#D9D4CB` · Sekunder `#FFB74D` (oranye) + `#4DB6AC` (teal) · Aksen merah Redhunter `#E53935` (signage, core tangga, detail kecil — bukan ring AI) |
| Langit per fase | Pagi `#FFE0B2`→`#BFE3F7` · Siang `#BFE3F7`→`#E3F4FC` · Senja `#FF8A65`→`#7E57C2` · Malam `#1A237E`→`#0D1B2A` (gradient atas→bawah) |
| Sun per fase | Pagi `#FFD180` intensitas 1.0 · Siang `#FFFFFF` 1.4 · Senja `#FF7043` 0.8 · Malam `#5C6BC0` 0.25 + emissive jendela interior `#FFF3C4` |
| Lighting | `HemisphereLight` (skyColor/groundColor = warna langit atas/bawah fase aktif) + 1 `DirectionalLight` shadow `PCFSoft`, map 2048², shadow bias -0.0005; tanpa AO bake |
| Dunia luar gedung | Taman + jalan low-poly: ground plane 80×80 m `#A5D6A7`, jalan `#9E9E9E` lebar 6 m, trotoar `#CFCFCF`, 8–12 pohon bulat/kerucut, 1–2 mobil statis low-poly. Semua ikut §4 |

Nilai di atas dipakai MVP-2 (fase P0: palet, exterior, lighting) dan MVP-3 (fase P1–P2: day-night, kamera). Peta MVP↔fase: docs/mvp/README.md.

---

## 5. Karakter

### 5.1 Preferensi (dokumen hidup — user boleh revisi)

| Atribut | Nilai |
|---|---|
| Bentuk | Humanoid mid-poly stylized, proporsi realistis-stylized |
| Tinggi | 1.7 m (skala real, konsisten grid §4) |
| Staff vs AI agent | Bentuk & rig SAMA (`CHAR_BASE`). AI dibedakan **aksen visual**: ring torus low-poly ≤ 200 tris melayang 0.25 m di atas kepala, warna = aksen per-agent (bukan merah global) + warna aksen sama pada `CHAR_TOP_*`. Bukan bentuk berbeda. Ring termasuk budget polycount |
| Wajah | Ekspresif: mata + mulut termodel pada `CHAR_FACE_*`. Shape key wajib di **setiap** `CHAR_FACE_<id>` (part wajah swappable §5.2): `face_blink`, `face_smile`, `face_talk` (jika Meshy tidak menghasilkan → buat manual di Blender) |
| Animasi wajib | `idle`, `walk`, `sit`, `type`, `wave`, `talk`, `celebrate` (7 clip body). Clip `talk` = gerak tubuh + men-drive shape key `face_talk`. Daftar ini menggantikan daftar clip §7.2 |
| Polycount | ≤ 20.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 2048². Budget scene: 10 agents ≈ 200k tris |
| Pose dasar | T-pose atau A-pose (untuk rigging) |
| Pembeda antar agent | Warna aksen + kombinasi parts DIY (§5.2) |
| Generator | Meshy (utama), procedural bpy (parts sederhana), Sloyd (opsional) |

Semua atribut §5.1 sudah terkunci (MVP-0, lihat docs/mvp/README.md). Revisi hanya atas permintaan user → update §11.

### 5.2 Sistem Avatar DIY (keputusan user)
Setiap staff/agent bisa kustom avatar sendiri — sistem **slot-based** ala game.

- **Satu base body rigged** (`CHAR_BASE`) dengan skeleton sama untuk semua.
- **Part library per slot:** rambut, wajah, atasan, bawahan, sepatu, aksesori.
- Parts di-skin/parent ke bone `CHAR_BASE` → semua animasi berlaku untuk semua kombinasi. Parts **tidak** di-rig ulang.
- Rigging dilakukan **sekali** untuk base body (Meshy Animate atau Mixamo).
- Konfigurasi per staff disimpan di **MongoDB**, bukan di file 3D:
  ```json
  { "hair": "hair_01", "face": "face_02", "top": "top_03", "bottom": "bottom_01", "shoes": "shoes_02", "acc": ["acc_glasses"] }
  ```
- R3F merakit parts saat load berdasarkan config. UI pemilih avatar = fase berikutnya.
- Semua parts wajib lulus §4.

---

## 6. Naming Contract (Blender ↔ R3F)

R3F mencari objek berdasarkan prefix ini. Nama salah = fitur rusak.

| Prefix | Arti | Dipakai R3F untuk |
|---|---|---|
| `FLOOR_<n>` | Collection per lantai (1–4) | Floor switching, isolasi lantai |
| `ROOM_<id>` | Ruangan (`ROOM_lobby`, `ROOM_meeting_a`) | Room selection, fokus kamera |
| `COL_<name>` | Collider, hidden saat render | Collision FPV |
| `NAV_<name>` | Spawn point / marker kamera | Posisi awal, transisi kamera |
| `TASK_<name>` | Anchor task board / workstation | Trigger panel task (§8) |
| `CHAR_BASE` | Body + rig karakter | Animasi |
| `CHAR_<SLOT>_<id>` | Part avatar: `HAIR`, `FACE`, `TOP`, `BOTTOM`, `SHOES`, `ACC` | Perakitan avatar DIY |
| `KIT_<piece>` | Potongan kit modular (Meshy Level 2 atau bpy): `KIT_wall_1m`, `KIT_wall_door`, `KIT_floor_1m` | Instancing di Blender; R3F tidak bergantung |

`<id>`/`<name>`: `snake_case` bahasa Inggris.

---

## 7. Workflow

### 7.1 Scene Blender (gedung/interior)
1. Baca §1–§6.
2. Tulis/ubah fungsi builder di `apps/assets/blender/build_hq.py` (`make_wall()`, `make_desk()`, `make_stairs()`, …) — modular, linked duplicates.
3. Jalankan via MCP `execute_blender_code` (atau headless `blender -b -P build_hq.py`).
4. Save `hq_vNN.blend` (naikkan NN).
5. Render Eevee (`BLENDER_EEVEE`) dua kamera: isometrik + eye-level → PNG.
6. Baca PNG, jalankan checklist §4, revisi.
6a. (Opsional, Level 2 Kit Meshy) Import potongan kit dari `apps/assets/raw/meshy/kit/` → normalisasi skala ke grid 1 m, pivot di dasar, Remesh (0 kredit) + rapikan tepi seam, ganti tekstur ke vertex color/palet §4.1 bila tidak lolos, nama `KIT_<piece>` → instancing (linked duplicates) oleh builder bpy. Collider tetap kotak bpy.
7. Export GLB headless → `gltf-transform` (meshopt; KTX2 hanya jika ada tekstur).
8. Verifikasi GLB: skala, orientasi, hierarchy, naming §6.
9. Output kandidat → `apps/web/public/models/hq_shell.glb` + `floor_N.glb` (§7.5) (ganti `building.glb` hanya setelah user setuju).

### 7.2 Karakter via API (tanpa buka web)
```
prompt (+ style §4, preferensi §5)
  → curl Meshy API (text/image-to-3D) → poll job → download GLB
  → import Blender via MCP → cek §4, rename sesuai §6
  → Meshy Animate API (rig + idle/walk/sit/type)  |  alternatif: Mixamo
  → export GLB animated → apps/web/public/models/
```
- Alur API butuh **Meshy Pro** (free tier tidak punya API). Selama free tier: user generate di web Meshy, simpan GLB ke `apps/assets/raw/meshy/`, agent lanjut dari langkah import.
- Langkah manual user hanya sekali: daftar akun + buat API key → `.env` (`MESHY_API_KEY`; `SLOYD_API_KEY` nanti bila Sloyd dipakai).
- Addon mcp-for-blender punya integrasi built-in Tripo/Hyper3D (nonaktif, butuh key) — bukan pilihan utama.

### 7.3 Urutan fase
- **P0:** deklarasi `three`/`@react-three/fiber`/`@react-three/drei` di `apps/web/package.json` → `build_hq.py` massing 4 lantai + Floor 1 detail (lobby, meeting kaca, 8 workstation, koridor, tangga) → 2–3 iterasi render → export & verifikasi GLB.
- **P1:** helicopter/isometric camera → floor switching → room selection.
- **P2:** FPV (WASD + mouse-look, pointer lock exit jelas) + collision `COL_*`.
- **P3:** minimap → karakter Meshy + avatar DIY → integrasi agent backend.
- **P4:** task board + Trello (§8).
- Third-person view: opsional, paling akhir.

### 7.5 Render per lantai (kualitas utuh, keputusan #21)
- **MUST:** export GLB terpisah per lantai `floor_1.glb`..`floor_4.glb` + shell eksterior ringan `hq_shell.glb`. Yang dimuat hanya lantai aktif (lazy-load saat pilih lantai); lantai lain di-unload/disembunyikan.
- **MUST:** helicopter view = shell eksterior + cutaway interior **lantai aktif saja**, bukan seluruh gedung.
- **MUST NOT:** decimate karakter, furniture, atau scenery demi angka tris. Kualitas aset MVP-2 dipertahankan.
- **SHOULD:** objek berulang (kit dinding/lantai, furniture) pakai instancing (`EXT_mesh_gpu_instancing`); kompresi meshopt + tekstur KTX2 (resolusi tetap ≤ 2048², §11 #19).
- `renderer.info` (calls/triangles) & FPS per lantai dicatat sebagai **info**, bukan target pangkas. Lantai berat → instancing/culling dulu; decimate hanya dengan izin user.

### 7.4 Contoh prompt siap pakai
```
Baca docs/redhunter-hq-brainstorming-guided.md. Buat blockout kantor low-poly 4 lantai:
footprint 20×14 m, tinggi lantai 3.2 m, style §4. Floor 1 detail: lobby, meeting room kaca,
8 workstation, koridor, tangga. Naming §6. Render isometrik + eye-level, simpan hq_v01.blend.
```

---

## 8. Task & Gamification

Kutipan user: *"selain fungsi game, fungsi kerjaan juga bisa di pakai"* — Redhunter HQ = game **dan** alat kerja nyata.

### 8.1 Data
- **Source of truth:** backend Redhunter (Express + MongoDB).
- **Trello:** sync dua arah (token/OAuth + REST + webhook).
- 3D tidak menyimpan state task.

### 8.2 Wujud di 3D
| Fitur | Perilaku |
|---|---|
| Task board 3D (meeting room, anchor `TASK_board`) | Kolom To Do / Doing / Done; klik kartu → panel HTML shadcn (detail, komentar, status) |
| Workstation (`TASK_desk_<id>`) | Dekat desk → tekan `E` → panel task staff (pola Huddly) |
| Agent aktif | Animasi `type`, speech bubble judul task dari backend |
| Task selesai | Kartu pindah kolom + animasi selebrasi kecil |
| Notifikasi spasial | Indikator melayang di atas agent/ruangan (mention, deadline) |
| Minimap | Marker aktivitas task per lantai/ruangan |

### 8.3 Batas
- Tidak dibangun di P0–P3. Demo data hanya jika jelas dilabeli "demo mode".

### 8.4 Game Feel (MVP-0, terkunci)

| Aspek | Nilai |
|---|---|
| Entry | Cinematic intro ≤ 4 s: kamera orbit turun dari 60 m → settle helicopter view (isometrik). Skip = klik/tombol apa pun. Checkbox "Jangan tampilkan lagi" → Zustand `persist` (localStorage). Setelah intro: helicopter view + floor selector |
| Juice (sedang) | Hover HANYA pada objek interaktif (`TASK_*`, `ROOM_*`, agent): emissive `#E53935` intensitas 0.35 + kursor pointer — state UI sementara, tidak dihitung dalam checklist "aksen merah tidak dominan" §4. Klik: scale bounce 1.05 → 1.0 dalam 180 ms. Transisi kamera: ease-in-out 0.6 s. Tanpa SFX; partikel hanya saat `celebrate` |
| Perilaku agents | Default di `TASK_desk_<id>`. Mapping enum `AGENT_STATUSES` (`packages/shared/src/enums.ts`) → lokasi+clip: `working`/`thinking` → desk + `type`; `blocked`/`waiting_permission` → `ROOM_meeting_a` + `sit` (loop) dengan `talk` overlay 2 s saat status berubah (butuh perhatian manusia); `idle` → `ROOM_lobby` area sofa + `idle`; `offline` → tidak dirender. MUST NOT menambah status di luar enum backend (§1 MUST NOT 6). Pindah = `walk` mengikuti waypoint `NAV_wp_<room_id>` (1 empty per `ROOM_*`, garis lurus antar waypoint; tanpa navmesh). MVP-4 (P3) mengirim 7 clip + demo `walk` sepanjang `NAV_wp_*` tanpa data backend; mapping ke status live dipasang di MVP-5 (P4) atau fase sesudahnya |
| Progresi | XP + level + badge, **data di backend** (MongoDB). Aturan XP/level/badge + endpoint = scope MVP-5 (fase P4). 3D hanya menampilkan: level di name tag, badge ikon di panel profil, `celebrate` saat level-up |
| Ambient idle | Bubble idle dari pool teks lokal (contoh: "☕ brb coffee", "🎧 focus mode") — **bukan data task/status, bukan demo data** (tidak melanggar §1 MUST NOT 6 / §8.3); style bubble abu-abu tanpa ikon status, berbeda dari bubble task backend. Interval bubble 20–60 s acak per agent. Prop bergerak: kipas 1 putaran/s, layar monitor ganti warna tiap 4 s, tanaman goyang ±3° periode 3 s |

Batas §8.3 ("tidak dibangun di P0–P3") berlaku untuk §8.1–8.2 (task board/Trello) saja. §8.4 dibangun per MVP: entry+juice → MVP-3 (P1–P2), clip+waypoint → MVP-4 (P3), mapping status + progresi + ambient → MVP-5 (P4). Peta: docs/mvp/README.md.

---

## 9. Fakta Lingkungan (hasil audit)

### Repo
- `apps/web/package.json`: next ^16.2.11, react 19, zustand, tailwind 4. Sejak MVP-1 three/fiber/drei dideklarasikan: `three ^0.186.1`, `@react-three/fiber ^9.8.1`, `@react-three/drei ^10.7.9`, devDep `@types/three ^0.186.0`.
- `apps/web/src/components/office/`: 13 file hasil pecahan MVP-1 dari monolith `OfficeCanvas.tsx` (dulu 417 LOC); `BUILDING_MODEL_URL` di `Building.tsx`, lighting (ambient 0.4 + 1 directional) di `Lighting.tsx`, tone mapping ACES di `OfficeCanvas.tsx`.
- Model sekarang: `building.glb` 12.4 KB, `character.glb` 38.2 KB — prosedural three.js dari `apps/assets/scripts/generate-assets.ts` (710 LOC).
- Penyebab visual buruk: aset prosedural non-authored, lighting flat, inline material override, monolith, deps tidak dideklarasikan.

### Blender
| Fakta | Implikasi untuk script |
|---|---|
| Blender 5.0.1 di `/usr/bin/blender` | Pakai API 5.x |
| Engine: `BLENDER_EEVEE` (EEVEE_NEXT tidak ada) | Set engine dalam try/except |
| Viewport screenshot addon sering gelap | Render ke PNG lalu baca |
| `look` mode image butuh numpy (tidak ada) | Jangan pakai |
| Scene tidak persist antar restart | Save `.blend` tiap iterasi |
| Addon: polyhaven/sketchfab/polypizza & tripo/hyper3d/hunyuan3d OFF | Procedural bpy saja di awal |
| Addon file `~/.config/blender/5.0/scripts/addons/blender_mcp.py`, tab sidebar "MCP for Blender" | Server listen `127.0.0.1:9876` |
| MCP terdaftar di `~/.config/opencode/opencode.json` | Restart OpenCode jika config berubah |
| Shader node: cari via `n.type == "BSDF_PRINCIPLED"` | Nama node bisa terlokalisasi |

---

## 10. Referensi

### Interaksi (open source, untuk pola — jangan salin aset)
| Proyek | Pola yang dipelajari |
|---|---|
| Nexus HQ — github.com/xbrxr03/nexus-hq ⭐ | Dashboard AI agents 3D, zones, live feed, WebSocket |
| AI Office — github.com/Gaurav2693/ai-office | Diorama isometrik, agent behavior, day/night |
| Huddly — github.com/harshal0704/huddly | FPV WASD, Tab toggle UI, `E` interaksi (Next.js + R3F) |
| Aura Plan — github.com/sujalvk888/aura-plan | FPV + PointerLockControls + collision |
| VirtualOffice3D — github.com/ktauchert/VirtualOffice3D | Click-to-move pathfinding |

### Visual
- bruno-simon.com — acuan style & fitur map.
- Fab commercial buildings, Samantrix virtual office — acuan kualitas/interaksi saja.

### Aset gratis (cadangan, cek lisensi per item)
threejsassets.com/assets/free (komersial), polyfork.dev (komersial, vertex color), antics.gg interior kit (CC-BY), 3dassets.dev Open Plan Office Floor (CC0, referensi layout Floor 1), Poly Haven (CC0), Quaternius & Kenney (CC0).

### Generator AI (dievaluasi)
| Tool | Peran | Biaya |
|---|---|---|
| Meshy | **Utama** — karakter + rig + 600+ motions, props kompleks, kit modular (Level 2), REST API (Pro) | Free 100 kredit web-only; Pro $20/bln 1.000 kredit + API; generate ±20–30 kredit, rig 5, animate 3/aksi, remesh 5, convert/resize 1 (harga live MCP 2026-10-17) |
| Sloyd | **Ditunda** — props low-poly, ekspor .blend, REST API | Web $15/bln; API prepaid min $12 |
| Mixamo | Rig + animasi gratis | $0 |
| Tripo / Hyper3D-Rodin / Hunyuan3D / Luma / Spline / Kaedim | Dicatat, tidak dipakai | — |

Cap kredit Meshy MVP-2: 450 (disetujui user 2026-10-18); kit v2 ≤ 330, furniture Meshy butuh otorisasi terpisah.

---

## 11. Changelog Preferensi User

| # | Keputusan | Kutipan/inti |
|---|---|---|
| 1 | MCP = ahujasid lineage → `mcp-for-blender` | "A" |
| 2 | Style low-poly ala Bruno Simon | "design stylenya polygon gitu", "gamification low poly art" |
| 3 | Gedung/interior/furniture procedural bpy | Kontrol penuh, $0 |
| 4 | Meshy + Sloyd, uji free tier dulu | "gak papa bayar, saya cuma gk mau salah bayar" |
| 5 | Prompting via API dari agent, bukan web | Otomasi penuh |
| 6 | Avatar DIY per staff (baju, rambut, muka, sepatu, celana) | "karakternya bisa DIY" |
| 7 | Task terhubung Trello, sumber data kombinasi | "fungsi kerjaan juga bisa di pakai" |
| 8 | Low-poly kualitas tinggi, tidak buram; Meshy utama | "poly yang bagus, realistis gk buram" |
| 9 | Tetap brainstorming, jangan implementasi/blockout/clone | "jangan dulu implementasi apapun" |
| 10 | File ini dijadikan rules & guide untuk AI | "jadi rules dan guided untuk AI" |
| 11 | Hybrid Meshy conditional: default Meshy per objek; per ruangan hanya setelah uji free tier lolos | "emang gak bisa hybrid? ... atau conditioning aja" |
| 12 | Interior wajib low-poly sama dengan exterior, satu bahasa visual | "interior perlu style poly juga untuk jaga konsistensi" → "iya" |
| 13 | Karakter: humanoid 1.7 m, satu rig untuk staff & AI, AI beda ring aksen per-agent 0.25 m; wajah ekspresif + shape key face_*; 7 clip; ≤ 8k tris | MVP-0 wawancara Q1–Q5 |
| 14 | Atmosfer: day-night cycle 4 fase, vibe startup playful | MVP-0 Q6–Q7 |
| 15 | Palet "Playful Pastel" (#F4EFE6/#FFF8F0/#D9D4CB, #FFB74D+#4DB6AC, merah #E53935); HemisphereLight + soft shadow 2048 | MVP-0 Q8–Q9 |
| 16 | Dunia luar: taman + jalan low-poly | MVP-0 Q10 |
| 17 | Game feel: cinematic ≤ 4 s skippable, juice sedang, agents desk-default + pindah per enum status backend (idle → ROOM_lobby), XP/level/badge backend, ambient bubble idle non-status + prop bergerak | MVP-0 Q11–Q15 |
| 18 | Kit Meshy (Level 2): Meshy generate potongan kit modular (dinding/lantai/pintu/tangga), bpy menjahit di grid 1 m; diuji di MVP-2 vs full bpy. Langganan Meshy saja dulu (free = web, Pro = API), Sloyd ditunda | "make object yang di generate meshy dan di jait oleh bpy" → "iya begitu tambahkan" |
| 19 | Mid-poly stylized + tekstur tajam (bukan flat vertex-color murni); karakter ≤ 20k tris, tekstur ≤ 2048² | "mid poly aja saya butuh texture juga walau poly" (MVP-2) |
| 20 | Verdict MVP-2: Level 2 dinding/lantai (kit Meshy v2, semua lantai), furniture kompleks Meshy | "buat dengan meshy contoh lantainya, kacanya dinding nya, ... kemudian bpy baru merakitnya, saya mau design high poly, dimana realistic, tapi style designnya poly" |
| 21 | Render per lantai: GLB per lantai lazy-load + shell eksterior; helicopter = cutaway lantai aktif; tanpa decimate karakter/scenery; instancing + meshopt/KTX2 | "rendernya per 1 lantai gak langsung 1 gedung ... saya gk mau ngurangi kualitas karakter scenery dll" |
