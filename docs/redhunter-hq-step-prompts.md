---
doc: redhunter-hq-step-prompts
type: execution-prompt-pack
status: ready — setiap prompt mandiri, paste ke sesi OpenCode baru
paired_with: docs/redhunter-hq-brainstorming-guided.md (rules & guide)
repo: /home/programer/work/redhunter-reborn/visual-office
usage: paste 1 prompt per sesi; agent wajib baca guide dulu (sudah tertulis di tiap prompt)
---

# Redhunter HQ — Step-by-Step Execution Prompts

Setiap prompt di bawah ini **mandiri**: sudah berisi konteks, prasyarat, langkah detail, dan kriteria selesai.
Cara pakai: buka sesi OpenCode baru di repo `/home/programer/work/redhunter-reborn/visual-office`, paste satu prompt, biarkan agent bekerja sampai "Definition of Done" terpenuhi.

Urutan rekomendasi: **0A → 0B → 0C (visi, bisa satu sesi) → A1 → A2 → B1 → B2 → B3 → C1 → C2 → C3 → D1 → D2**.
Track A & B bisa paralel di sesi berbeda (A tidak menyentuh Blender, B tidak menyentuh `apps/web` — kecuali B3).

---

## TRACK 0 — Prompt Visi (jalankan SEBELUM step eksekusi)

Prompt di track ini **tidak membangun apa pun** — tugasnya menggali preferensi Anda lewat
pertanyaan terstruktur, lalu menulis jawaban ke `docs/redhunter-hq-brainstorming-guided.md`
(§4, §5.1, §11) dan ke file ini. Tujuannya: Step B1/B2/D1 tidak menebak visi Anda.
Track 0 bisa dikerjakan dalam SATU sesi (paste 0A+0B+0C sekaligus) karena hanya wawancara + edit docs.

### STEP 0A — Visi Karakter (mengisi §5.1 yang masih TBD)

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran style & rules; jika skill/insting Anda konflik dengan guide,
guide menang. Dilarang melenceng dari §4/§5.

Konteks: Redhunter HQ adalah virtual office low-poly ala bruno-simon.com. Guide
§5.1 masih TBD untuk bentuk & tinggi karakter.
Step D1 (generate karakter via Meshy) TIDAK BOLEH jalan sebelum ini terisi — jangan asal pilih.

Task: wawancarai user SATU pertanyaan per satu waktu (pakai tool question, pilihan ganda
dengan opsi visual yang jelas), lalu tulis jawaban ke guide §5.1 dan changelog §11.

Pertanyaan wajib (urut, satu per satu):
1. Bentuk dasar karakter AI agents: (a) humanoid low-poly proporsi realistis ~1.7 m,
   (b) humanoid chibi (kepala besar, ~1.1 m, lebih playful ala bruno-simon.com),
   (c) robot kecil, (d) bentuk abstrak (orb/kapsul melayang). Tunjukkan trade-off tiap opsi
   (chibi = lebih lucu tapi kurang "profesional"; realistis = cocok dengan skala gedung).
2. Apakah staff manusia dan AI agents pakai bentuk yang sama, atau AI agents dibedakan
   bentuknya (misal agents = robot kecil, staff = humanoid)?
3. Animasi selain wajib (idle/walk/sit/type): butuh wave/talk/celebrate?
4. Detail wajah: mata titik sederhana ala low-poly, atau mata+mulut ekspresif?
5. Tingkat detail: berapa polycount kira-kira yang acceptable (minta agent usulkan angka
   target untuk 10+ agent on-screen tanpa lag).

Setelah semua terjawab: update §5.1 (hapus TBD), tambah entry §11, laporkan ringkasan.
Batasan: JANGAN generate karakter, JANGAN buka Blender. Murni wawancara + edit docs.
```

### STEP 0B — Visi Suasana & Atmosfer Kantor (melengkapi §4)

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Dilarang melenceng dari §4.

Konteks: guide §4 sudah mengunci style teknis (low-poly flat-shaded, clean, tajam), tapi
belum mengunci SUASANA: bagaimana rasanya berada di kantor ini. Ini menentukan lighting,
palet, dan density prop di Step B1/B2. Wawancarai user satu pertanyaan per satu waktu,
lalu tulis hasilnya sebagai sub-bagian baru §4 "Atmosfer" + changelog §11.

Pertanyaan wajib:
1. Waktu & suasana global: (a) siang cerah playful (bruno-simon style), (b) senja hangat,
   (c) malam dengan lampu interior menyala (lebih "cyber office"), (d) day/night cycle.
   Trade-off: (d) paling hidup tapi 2x kerja lighting.
2. Vibe keseluruhan: (a) startup playful/ramai, (b) HQ profesional bersih, (c) cozy santai,
   (d) futuristik AI lab. Ini menentukan density furniture & dekorasi.
3. Palet utama (selain aksen merah Redhunter): minta user pilih 3–5 warna atau biarkan agent
   usulkan 2–3 palet kandidat (tampilkan swatch hex) lalu user pilih.
4. Lighting: flat lighting sederhana vs gradient sky vs soft shadow halus — seberapa jauh?
5. Dunia luar gedung: (a) polos/ground saja, (b) taman + jalan + pohon low-poly,
   (c) mini city block ala bruno-simon.com. Trade-off: (c) paling imersif tapi +polycount.
6. Sound nanti (opsional, dicatat saja): ambient office, musik lo-fi, atau hening?

Setelah selesai: tulis §4 sub-bagian "Atmosfer" dengan jawaban konkret (bukan narasi
mengambang — tulis nilai teknis: warna hex palet, jenis sky, kepadatan prop per m²).
Batasan: JANGAN implementasi. Murni wawancara + edit docs.
```

### STEP 0C — Visi Interaksi & "Rasa Game" (melengkapi §8 + rencana C1/C2)

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang.

Konteks: user ingin "gamification" — kantor yang terasa seperti game, bukan viewer 3D.
Guide §8 mengunci integrasi task, tapi belum mengunci RASA interaksinya. Wawancarai user,
tulis hasil ke sub-bagian baru §8.4 "Game Feel" + changelog §11.

Pertanyaan wajib:
1. Saat pertama buka app, user melihat apa: (a) langsung helicopter view gedung,
   (b) cinematic intro kamera mendekat lalu helicopter, (c) langsung FPV di lobby?
2. Feedback interaksi: hover ruangan menyala? Klik ada animasi/ripple? Seberapa banyak
   juice (screen shake tidak, tapi bounce halus pada kartu task, dsb)?
3. Agents di scene: (a) diam di desk masing-masing bekerja, (b) jalan-jalan antar ruangan
   sesuai status nyata dari backend, (c) campuran. (b) paling hidup tapi butuh data nyata.
4. Progresi/gamification nyata: XP/level untuk task selesai? Badge di avatar?
   Atau murni visual tanpa sistem poin?
5. Suasana saat idle: ada life ambient (agents ngobrol bubble chat, printer bergerak) atau
   scene statis sampai ada event backend?

Setelah selesai: tulis §8.4 dengan jawaban konkret, update prompt Step C1/C2/D1/D2 di file
ini jika jawaban mengubah scope mereka (misal agents berjalan → D1 butuh animasi walk di
scene, bukan hanya idle).
Batasan: JANGAN implementasi. Murni wawancara + edit docs.
```

---


## STEP A1 — Deklarasi Dependensi 3D di apps/web

```
Konteks: Repo ini monorepo bun, package web di apps/web. Saat ini three/@react-three/fiber/@react-three/drei
TIDAK dideklarasikan di apps/web/package.json — kebetulan jalan karena bun hoisting
(three ^0.186.1 dideklarasikan hanya di apps/assets). Ini rapuh dan harus diperbaiki dulu
sebelum pekerjaan 3D lain.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran style & rules proyek ini; jika skill/insting Anda konflik dengan
guide, guide menang. Fokus step ini: §1, §9.

Task:
1. Cek versi yang benar-benar ter-resolve sekarang: `bun pm ls three @react-three/fiber @react-three/drei`
   (atau baca node_modules/three/package.json dst). Catat versi persisnya.
2. Tambahkan ketiganya ke dependencies apps/web/package.json dengan versi kompatibel persis
   (gunakan prefix ^ pada versi yang ter-resolve, jangan upgrade major).
3. Jalankan `bun install` di root repo.
4. Verifikasi: `cd apps/web && bun run dev` → buka halaman yang memuat OfficeCanvas
   (dashboard) → pastikan render tanpa error console. Jika ada typecheck/lint script, jalankan.
5. Laporkan: versi yang dideklarasikan, output install, bukti halaman render.

Batasan:
- JANGAN ubah file selain apps/web/package.json (dan lockfile otomatis).
- JANGAN ubah OfficeCanvas.tsx.
- JANGAN upgrade paket lain.

Definition of Done: dashboard render identik dengan sebelumnya, tidak ada error,
three/fiber/drei terdaftar di apps/web/package.json.
```

---

## STEP A2 — Refactor OfficeCanvas (pecah monolith, tanpa ubah perilaku)

```
Konteks: apps/web/src/components/OfficeCanvas.tsx adalah monolith 417 LOC berisi Building
(useGLTF building.glb), FloorPlane, DeskMarkers, Agent, CameraRig, FloorSelector,
WebGLErrorBoundary, lighting inline. Ini menghambat pengembangan.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Fokus step ini: §1, §9.
Prasyarat: Step A1 selesai.

Task: pecah menjadi komponen terpisah di apps/web/src/components/office/:
1. Buat struktur: office/OfficeCanvas.tsx (root, Canvas + error boundary), office/Building.tsx,
   office/FloorPlane.tsx, office/DeskMarkers.tsx, office/Agent.tsx, office/CameraRig.tsx,
   office/FloorSelector.tsx, office/Lighting.tsx.
2. PINDAHKAN kode apa adanya — dilarang mengubah perilaku, warna, posisi, atau logika kamera.
   Inline material tetap inline dulu (perbaikan material ada di step B3).
3. Perbarui import di apps/web/src/app/dashboard/page.tsx (dynamic import tetap).
4. Verifikasi: bun run dev → dashboard tampil IDENTIK (bandingkan screenshot sebelum/sesudah
   bila memungkinkan), tidak ada error/warning baru di console.
5. Laporkan: daftar file baru + LOC per file, bukti render.

Batasan: murni refactor. Tidak boleh ada fitur baru, tidak boleh "sekalian memperbaiki".

Definition of Done: tampilan identik, file terpecah, build & typecheck lulus.
```

---

## STEP B1 — Library Builder + Massing 4 Lantai (Blender via MCP)

```
Konteks: Blender 5.0.1 desktop berjalan dengan MCP "blender" (mcp-for-blender) terhubung.
Pipeline: script Python di apps/assets/blender/build_hq.py adalah SUMBER KEBENARAN scene
(rebuildable via `blender -b -P build_hq.py`); MCP execute_blender_code digunakan untuk
menjalankan/mengembangkan script di Blender live.
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran style & rules; konflik → guide menang. Style visual WAJIB mengikuti
§4 + sub-bagian "Atmosfer" (hasil Step 0B) — jangan improvisasi palet/lighting sendiri.
Fokus step ini: §1, §3, §4, §6, §9.

Task:
1. Buat apps/assets/blender/build_hq.py dengan struktur:
   - CONFIG: footprint 20×14 m, 4 lantai, tinggi lantai 3.2 m, grid kolom 4 m.
   - PALET flat colors sesuai §4 guide (abu hangat dinding, aksen merah Redhunter terkendali).
   - Fungsi builder: make_box(), make_wall(), make_floor_slab(), make_column(), make_stairs(),
     set_flat_material() (Principled BSDF roughness 1, flat shading, cari node via
     n.type == "BSDF_PRINCIPLED" — nama node bisa terlokalisasi).
   - Collection structure: FLOOR_1..FLOOR_4, plus NAV_ dan COL_ placeholder.
   - Naming sesuai §6.
2. Bangun MASSING saja (belum interior): slab tiap lantai, dinding luar dengan bukaan jendela
   sederhana, core tangga terlihat, flat roof. Style §4: low-poly flat-shaded, clean, tajam.
3. Save scene ke apps/assets/blender/hq_v01.blend (wajib — scene hilang saat Blender restart).
4. Render Eevee (engine 'BLENDER_EEVEE', BUKAN EEVEE_NEXT) 2 kamera: isometrik 3/4 dari luar,
   dan eye-level dari depan → PNG ke /tmp/hq_v01_iso.png dan /tmp/hq_v01_eye.png
   (viewport screenshot addon sering gelap — SELALU render ke file).
5. Baca PNG, jalankan checklist §4 (siluet terbaca, tidak blur, aksen merah tidak dominan,
   skala masuk akal). Revisi jika gagal, naikkan versi blend.
6. Laporkan: isi build_hq.py (ringkas), path .blend, dan tunjukkan PNG render.

Batasan: JANGAN sentuh apps/web. JANGAN detail interior (itu Step B2). JANGAN pakai Meshy/Sloyd.

Definition of Done: hq_v01.blend tersimpan + 2 render PNG lolos checklist §4 +
build_hq.py rebuildable headless.
```

---

## STEP B2 — Detail Floor 1 (interior representatif)

```
Konteks: melanjutkan Step B1. hq_v01.blend + build_hq.py sudah ada. Style §4 guide wajib:
low-poly flat-shaded kualitas tinggi, tidak buram; interior SATU bahasa visual dengan exterior
(§3: konsistensi style; §4 blok "Konsistensi interior" — variasi lewat bentuk/prop/palet).
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Style WAJIB §4 (+ Atmosfer dari 0B);
interior SATU bahasa visual dengan exterior. Blender via MCP "blender".

Task: detailkan FLOOR_1 di build_hq.py (fungsi terpisah, mis. build_floor_1()):
1. Layout: lobby (reception desk, sofa lounge, tanaman), meeting room kaca (ROOM_meeting_a,
   panel kaca = material Principled alpha ~0.15 flat), area 8 workstation (desk + monitor +
   kursi low-poly), koridor tengah, tangga ke FLOOR_2 (fungsional, bisa dipakai FPV nanti).
2. Furniture dibuat via fungsi builder modular (make_desk(), make_chair(), make_monitor(),
   make_sofa(), make_plant()) — linked duplicates untuk pengulangan, snap grid 0.8–1 m.
3. Zona warna: lobby hangat, area kerja netral, AI/meeting aksen merah terkendali.
4. Naming §6 wajib: ROOM_lobby, ROOM_meeting_a, ROOM_workstation_a, COL_* (collider dinding
   & furniture besar, hidden saat render), NAV_spawn_lobby, NAV_cam_floor1.
5. Save hq_v02.blend (naikkan versi, jangan timpa v01).
6. Render Eevee 3 PNG: isometrik floor-1-isolated (lantai lain hidden), eye-level lobby,
   eye-level workstation area → /tmp/hq_v02_*.png. Baca, jalankan checklist §4, revisi.
7. Laporkan + tunjukkan PNG. Minta persetujuan user sebelum lanjut export (Step B3).

Batasan: hanya Floor 1. Lantai 2–4 tetap massing. JANGAN export GLB. JANGAN sentuh apps/web.

Definition of Done: hq_v02.blend + 3 render lolos checklist §4 + disetujui user.
```

---

## STEP B3 — Export GLB + Integrasi ke Web

```
Konteks: Step B2 disetujui. hq_vNN.blend final Floor 1 siap. Target: ganti
apps/web/public/models/building.glb (12.4 KB prosedural lama) dengan hq.glb hasil Blender.
OfficeCanvas sudah direfactor (Step A2).

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Fokus step ini: §1, §6, §7.1, §9.

Task:
1. Export GLB dari Blender headless: `blender -b hq_vNN.blend -P export_glb.py` (buat script
   kecil export_glb.py: pilih semua kecuali COL_*, export GLB dengan +Y up).
2. Optimasi: `npx gltf-transform optimize hq.glb hq.opt.glb --compress meshopt` (KTX2 hanya
   jika ada tekstur — seharusnya tidak ada, semua flat colors).
3. Verifikasi GLB: `npx @gltf-transform/cli inspect hq.opt.glb` → cek jumlah mesh, material,
   naming FLOOR_/ROOM_/COL_/NAV_ utuh, skala meter. Laporkan tabel inspect.
4. Simpan sebagai apps/web/public/models/hq.glb. Update office/Building.tsx: load
   '/models/hq.glb' TAPI tetap support fallback building.glb (feature flag sederhana atau
   komentar jelas). Hapus inline material override yang menimpa material GLB.
5. bun run dev → dashboard → verifikasi visual gedung baru tampil, orbit/zoom jalan,
   tidak ada error console. Screenshot sebelum/sesudah.
6. Laporkan: ukuran file GLB lama vs baru, hasil inspect, screenshot.

Batasan: JANGAN ubah logika kamera/floor selector. JANGAN hapus building.glb lama (rename
building_legacy.glb). COL_* TIDAK ikut diekspor ke GLB render (atau diekspor tapi
hidden=true — pilih satu, dokumentasikan).

Definition of Done: hq.glb termuat di dashboard, tampil benar, inspect bersih, user setuju.
```

---

## STEP C1 — Helicopter View: Floor Switching + Room Selection

```
Konteks: hq.glb termuat (Step B3). Referensi pola: Nexus HQ (zones), bruno-simon.com (orbit
playful).

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Fokus step ini: §1, §3, §6 + §8.4
"Game Feel" (hasil Step 0C). Komponen ada di apps/web/src/components/office/.

Task:
1. Floor switching UI: klik lantai (dari raycast pada FLOOR_<n> atau FloorSelector) →
   lantai lain fade/hide, kamera turun fokus ke lantai itu (transisi smooth via CameraRig
   lerp yang sudah ada, atau drei CameraControls).
2. Room selection: hover ROOM_* → highlight halus (emissive aksen merah Redhunter);
   klik → kamera fokus ke bounding box ruangan + label nama ruangan (HTML overlay drei).
3. Tombol reset view → kembali ke orbit penuh gedung.
4. Semua state via zustand store (sudah ada di project — pakai polanya).
5. Verifikasi manual di browser + screenshot tiap state (full, floor isolated, room focused).
6. Playwright: minimal 1 test — load dashboard, klik lantai 1, assert lantai lain hidden.

Batasan: belum FPV (Step C2). JANGAN ubah GLB. JANGAN tambah dependency baru tanpa izin.

Definition of Done: isolasi lantai + fokus ruangan + reset berfungsi, test lulus, screenshot.
```

---

## STEP C2 — First-Person View (WASD + collision)

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang.

Konteks: referensi pola Huddly (WASD + Tab toggle UI + E interaksi) dan Aura Plan
(PointerLockControls + collision). Guide §1, §3: physics = raycast/capsule, Rapier HANYA
jika terbukti perlu (tanya dulu). Collider tersedia sebagai COL_* di GLB.

Task:
1. Mode toggle: tombol/UI switch antara helicopter view (C1) dan FPV. Masuk FPV → kamera ke
   NAV_spawn_lobby. PointerLockControls (drei) + exit jelas (Esc + hint di layar).
2. Movement: WASD + mouse-look, kecepatan jalan manusia (~1.4 m/s), head height 1.6 m.
3. Collision: capsule vs COL_* meshes via three-mesh-bvh ATAU raycast sederhana —
   pilih yang lebih ringan, ukur fps sebelum/sesudah. Player tidak bisa tembus dinding/tangga.
4. Tangga: bisa naik Floor 1 → 2 (lantai 2 masih massing — boleh kosong).
5. UI hint: "WASD bergerak · Esc keluar" ala Huddly, hilang setelah 5 detik.
6. Verifikasi: screen recording atau screenshot sequence jalan lobby → tangga → lantai 2.
   Laporkan fps (renderer.info / stats).

Batasan: JANGAN integrasi task/agent (nanti). JANGAN Rapier tanpa persetujuan eksplisit.

Definition of Done: FPV playable, collision bekerja, toggle view mulus, fps ≥ 50 di laptop user.
```

---

## STEP C3 — Minimap / Fitur Map

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Fokus: §1, §6 + style minimap ikut §4.

Konteks: user menginginkan fitur map seperti bruno-simon.com. Data posisi tersedia dari
NAV_*/ROOM_* di GLB dan state kamera/player.

Task:
1. Minimap pojok kanan bawah: render top-down orthographic scene (portal kedua R3F) atau
   canvas 2D dari denah ROOM_* — pilih lebih murah, ukur.
2. Marker: posisi player (FPV) atau fokus kamera (helicopter), indikator lantai aktif.
3. Klik minimap → kamera pindah ke area itu.
4. Style minimap ikut bahasa visual: flat, palet gelap UI, aksen merah.
5. Verifikasi: screenshot helicopter + FPV dengan minimap; klik minimap berfungsi.

Definition of Done: minimap live, klik-teleport jalan, tidak menurunkan fps signifikan.
```

---

## STEP D1 — Karakter Pertama via Meshy (uji free tier + uji hybrid Level 1)

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Karakter WAJIB mengikuti §5 (preferensi
hasil Step 0A — jika §5.1 masih TBD, tanya user dulu, jangan menebak) dan checklist §4.

Konteks: guide §5 (karakter), §7.2 (alur API), §3 keputusan "Hybrid Meshy conditional".
Step ini SEKALIGUS uji Level 1: hasil Meshy dinilai dengan checklist §4 — menentukan apakah
Meshy layak untuk furniture/ruangan nanti. API key: user menyediakan MESHY_API_KEY di .env
(jika belum ada, STOP dan minta user membuatnya — satu-satunya langkah manual).

Task:
1. Pakai preferensi §5.1 (hasil Step 0A). Jika masih TBD: tanya user bentuk karakter dulu
   (humanoid/robot/abstrak, tinggi/chibi) — jangan menebak.
2. Generate 1 karakter via Meshy API (text-to-3D, prompt sertakan "low-poly flat-shaded,
   clean geometry, stylized game character, T-pose"): curl submit → poll → download GLB.
3. Import ke Blender via MCP → cek checklist §4 (topologi, style, tidak buram) → rename
   CHAR_BASE sesuai §6 → simpan apps/assets/blender/char_v01.blend.
4. Rig + animasi idle/walk (Meshy Animate API, atau Mixamo sebagai fallback gratis).
5. Export GLB animated → apps/web/public/models/char_base.glb → tampilkan 1 agent idle di
   lobby (ganti character.glb lama, rename legacy).
6. Laporkan: kredit Meshy terpakai, kualitas (screenshot close-up + dalam scene),
   verdict checklist §4 → rekomendasi lanjut/tidak Meshy untuk props.

Batasan: 1 karakter saja. JANGAN langganan — free tier saja. JANGAN sistem avatar DIY penuh.

Definition of Done: 1 agent Meshy beranimasi idle di lobby + verdict kualitas + laporan kredit.
```

---

## STEP D2 — Integrasi Task & Trello

```
LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP.
Guide = sumber kebenaran; konflik → guide menang. Fokus: §8 lengkap + §8.4 "Game Feel".

Konteks: guide §8. Source of truth = backend Redhunter (Express + MongoDB di repo ini),
Trello sync dua arah (token/OAuth + REST + webhook). 3D hanya visual + trigger UI.
Prasyarat: C1 selesai (room selection), sebaiknya C2 (workstation E). Trello API key dari user
di .env (TRELLO_KEY, TRELLO_TOKEN — jika belum ada, STOP dan minta).

Task:
1. Backend: endpoint tasks (Express + Mongoose model Task) + service sync Trello
   (pull board → MongoDB, push update → Trello, webhook receiver untuk perubahan dari Trello).
   Sertakan mode demo berlabel jelas bila Trello belum dikonfigurasi (bukan mock palsu permanen).
2. Frontend: panel task HTML shadcn (daftar kartu per kolom To Do/Doing/Done, detail kartu,
   update status) terhubung endpoint — Socket.IO untuk update live bila sudah tersedia.
3. 3D: TASK_board anchor di ROOM_meeting_a → klik → panel board; TASK_desk_<id> → tekan E
   (FPV) atau klik (helicopter) → panel task staff itu.
4. Verifikasi end-to-end: buat kartu di Trello → muncul di panel (dan sebaliknya),
   screenshot. Jangan klaim tanpa bukti request/response nyata.

Batasan: business logic di backend, bukan di objek 3D. JANGAN bangun sebelum user konfirmasi
Trello sudah dipakai di workflow nyata.

Definition of Done: sync dua arah terbukti dengan request nyata, panel berfungsi dari 3D,
tidak ada data palsu.
```

---

## Catatan Pemakaian

- **Satu prompt = satu sesi.** Jangan gabungkan dua step dalam satu sesi — pengecualian: Track 0 (0A+0B+0C) boleh digabung dalam satu sesi karena hanya wawancara + edit docs.
- **Track 0 dulu.** Step D1 dan B2 akan membaca §5.1 dan §4 — pastikan TBD sudah terisi lewat Track 0, kalau tidak agent akan berhenti dan bertanya.
- Setiap prompt **dibuka dengan perintah wajib membaca** `docs/redhunter-hq-brainstorming-guided.md` LENGKAP + aturan "konflik → guide menang". Ini mencegah style melenceng: guide adalah satu-satunya sumber kebenaran rules, style (§4 + Atmosfer), karakter (§5), naming (§6), dan fakta lingkungan (§9).
- Jika step gagal di tengah, sesi berikutnya cukup paste prompt yang sama + kalimat "lanjutkan dari kegagalan: <isi>".
- Step B1–B2 butuh Blender desktop terbuka dengan addon MCP server berjalan (port 127.0.0.1:9876).
- Step D1/D2 butuh API key dari Anda — siapkan sebelum memulai step itu.
