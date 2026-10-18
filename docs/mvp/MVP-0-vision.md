# MVP-0 — Visi Terkunci (wawancara, tanpa kode)

**Goal:** semua keputusan rasa/visual yang masih TBD terkunci di guide, supaya MVP-2/3/4 tidak menebak.
**Demo:** guide berisi §4 "Atmosfer", §5.1 tanpa TBD, §8.4 "Game Feel".
**Handoff:** keputusan visi → MVP-2 (palet/lighting/karakter di Blender), MVP-4 (game feel).

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-0 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP dan
docs/mvp/README.md. Guide = sumber kebenaran style & rules; konflik dengan skill/insting
Anda → guide menang. Style dasar sudah terkunci (low-poly flat-shaded ala bruno-simon.com,
kualitas tinggi, tidak buram, interior satu bahasa visual dengan exterior) — JANGAN dibuka ulang.

GOAL MVP-0: wawancarai saya untuk mengunci visi yang masih TBD, lalu tulis ke guide.
Sesi ini TIDAK membangun apa pun: tanpa kode, tanpa Blender, tanpa install.

Cara wawancara: SATU pertanyaan per giliran, pakai tool question (pilihan ganda), tiap opsi
sertakan trade-off singkat. Tunggu jawaban sebelum lanjut.

BAGIAN A — Karakter (isi guide §5.1):
1. Bentuk AI agents: humanoid low-poly ~1.7 m / humanoid chibi ~1.1 m / robot kecil / abstrak.
2. Staff manusia & AI agents: bentuk sama atau dibedakan?
3. Animasi tambahan selain idle/walk/sit/type (wave/talk/celebrate)?
4. Wajah: mata titik sederhana atau ekspresif (mata+mulut)?
5. Target polycount per karakter — usulkan angka untuk 10+ agents on-screen tanpa lag, minta saya setujui.

BAGIAN B — Atmosfer (tambah sub-bagian guide §4 "Atmosfer"):
6. Waktu/suasana: siang cerah / senja hangat / malam lampu interior / day-night cycle.
7. Vibe: startup playful / HQ profesional bersih / cozy / futuristik AI lab.
8. Palet: usulkan 2–3 palet kandidat (hex + aksen merah Redhunter), saya pilih satu.
9. Lighting: flat sederhana / gradient sky / soft shadow halus.
10. Dunia luar gedung: polos / taman+jalan low-poly / mini city block.

BAGIAN C — Game feel (tambah sub-bagian guide §8.4 "Game Feel"):
11. Saat app dibuka: langsung helicopter / cinematic intro / langsung FPV lobby.
12. Feedback interaksi: seberapa banyak "juice" (hover glow, bounce, ripple).
13. Perilaku agents: diam di desk / jalan antar ruangan sesuai status backend / campuran.
14. Progresi: XP/level/badge atau murni visual.
15. Ambient idle: ada life (bubble chat, prop bergerak) atau statis sampai ada event.

SETELAH SEMUA TERJAWAB:
- Tulis jawaban sebagai NILAI KONKRET (hex, angka polycount, jenis sky), bukan narasi.
- Update docs/redhunter-hq-brainstorming-guided.md (§4 Atmosfer, §5.1 hapus TBD, §8.4,
  changelog §11) DAN versi .html-nya agar sinkron.
- Append Handoff Report ke docs/mvp/HANDOFF.md: "MVP-0 selesai — ringkasan keputusan".

Definition of Done: tidak ada TBD tersisa di §5.1, §4 Atmosfer & §8.4 ada, .md & .html
sinkron, HANDOFF.md ter-update. Jangan commit git kecuali saya minta.
```
