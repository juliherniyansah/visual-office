# mvp-0-vision - Work Plan

## TL;DR (For humans)

**What you'll get:** guide `docs/redhunter-hq-brainstorming-guided.md` + `.html` dengan §4.1 "Atmosfer", §5.1 tanpa TBD, §8.4 "Game Feel", §11 changelog #13–#17 — semua nilai konkret (hex, tris, detik, nama clip, enum status backend nyata). `docs/mvp/HANDOFF.md` berisi laporan MVP-0.

**Why this approach:** 15 keputusan sudah diwawancarai dan terkunci (lihat Scope → Decisions). Plan ini menyalin keputusan ke dokumen sumber kebenaran supaya MVP-2/3/4/5 tidak menebak. Mapping status agent memakai enum nyata `AGENT_STATUSES` dari `packages/shared/src/enums.ts` (bukan status rekaan — §1 MUST NOT 6). Ruangan idle = `ROOM_lobby` (area sofa) karena Floor 1 P0 (guide §7.3, MVP-2) tidak punya lounge — tidak menambah ruangan baru.

**What it will NOT do:** tidak menyentuh kode, Blender, package.json, `.env`, atau git. Tidak membuka ulang style dasar (§3). Tidak mengubah §1–§3, §6, §7, §9, §10. Tidak menambah kewajiban QA/ruangan baru untuk MVP lain.

**Effort:** 7 todo doc-only, 1 wave. **Risk:** rendah; risiko utama = .md/.html tidak sinkron (dicek todo 6 + F3) dan edit mendarat di baris salah (dimitigasi: semua edit pakai anchor teks, bukan nomor baris).

**Decisions:** semua di Scope → Decisions; tidak ada yang tersisa untuk executor.

## Scope

**In:**
- `docs/redhunter-hq-brainstorming-guided.md` — §0 tabel (+2 baris), §4 tambah §4.1 Atmosfer, §5.1 isi nilai, §8 tambah §8.4 Game Feel, §11 tambah 5 baris.
- `docs/redhunter-hq-brainstorming-guided.html` — mirror persis dari perubahan .md, markup/kelas CSS yang sudah ada (`.tbd`, `.note`, `table`, `code`).
- `docs/mvp/HANDOFF.md` — append satu bagian `## MVP-0`.
- `.omo/notepads/mvp-0-vision/qa.md`, `.omo/notepads/mvp-0-vision/baseline.sha256`, `.omo/notepads/mvp-0-vision/after.sha256`, `.omo/notepads/mvp-0-vision/files-after.txt` — artefak QA (boleh dibuat).

**Out / Must-NOT-Have:**
- MUST NOT edit file lain selain 3 docs + 4 artefak `.omo/notepads/mvp-0-vision/*` di atas. Khususnya MUST NOT edit `docs/mvp/MVP-*.md`, `docs/mvp/README.md`, `docs/redhunter-hq-step-prompts.md`.
- MUST NOT ubah teks di §1, §2, §3, §6, §7, §9, §10. Di §5.1 baris bertanda **(tetap)** di Decisions A = JANGAN disentuh, teks asli dipertahankan.
- MUST NOT menjalankan `git commit`/`add`/`checkout`/`stash`/`push`. `git status`/`git diff` read-only boleh.
- MUST NOT buka Blender MCP, install dependency, atau menulis kode.
- MUST NOT mengganti palet/nilai di Decisions dengan "perbaikan" sendiri.
- MUST NOT menyisakan string `TBD` di §5.1 (.md maupun .html).
- MUST NOT memakai nomor baris absolut untuk edit — semua edit berbasis anchor teks (lihat tiap todo). Nomor baris di plan ini = orientasi pra-edit saja.
- MUST NOT menambah kewajiban/MUST baru, ruangan baru, atau status baru untuk MVP lain di luar 15 keputusan.

### Decisions (nilai final — salin verbatim ke dokumen)

**A. Karakter (§5.1)** — tabel pengganti penuh untuk §5.1, **urutan baris = urutan tabel ini**. Baris (tetap) = pertahankan teks asli guide persis.
| Atribut | Nilai |
|---|---|
| Bentuk | Humanoid low-poly, proporsi realistis-stylized |
| Tinggi | 1.7 m (skala real, konsisten grid §4) |
| Staff vs AI agent | Bentuk & rig SAMA (`CHAR_BASE`). AI dibedakan **aksen visual**: ring torus low-poly ≤ 200 tris melayang 0.25 m di atas kepala, warna = aksen per-agent (bukan merah global) + warna aksen sama pada `CHAR_TOP_*`. Bukan bentuk berbeda. Ring termasuk budget polycount |
| Wajah | Ekspresif: mata + mulut termodel pada `CHAR_FACE_*`. Shape key wajib di **setiap** `CHAR_FACE_<id>` (part wajah swappable §5.2): `face_blink`, `face_smile`, `face_talk` (jika Meshy tidak menghasilkan → buat manual di Blender) |
| Animasi wajib | `idle`, `walk`, `sit`, `type`, `wave`, `talk`, `celebrate` (7 clip body). Clip `talk` = gerak tubuh + men-drive shape key `face_talk`. Daftar ini menggantikan daftar clip §7.2 |
| Polycount | ≤ 8.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 1024² atau vertex color. Budget scene: 10 agents ≈ 80k tris |
| Pose dasar | (tetap) |
| Pembeda antar agent | (tetap) |
| Generator | (tetap) |

Kalimat `Atribut **TBD** → AI wajib tanya user, tidak memilih sendiri.` diganti: `Semua atribut §5.1 sudah terkunci (MVP-0, lihat docs/mvp/README.md). Revisi hanya atas permintaan user → update §11.`

**B. Atmosfer (§4.1 baru, sub-bagian setelah checklist §4)**
| Properti | Nilai |
|---|---|
| Vibe | Startup playful: warna cerah-pastel, prop fun (bean bag, tanaman, mural dinding), tetap §4 flat-shaded |
| Waktu | Day-night cycle, 4 fase: pagi 06–10, siang 10–16, senja 16–19, malam 19–06 (jam lokal client; transisi lerp ≤ 60 s) |
| Palet "Playful Pastel" | Exterior `#F4EFE6` · Interior `#FFF8F0` · Lantai `#D9D4CB` · Sekunder `#FFB74D` (oranye) + `#4DB6AC` (teal) · Aksen merah Redhunter `#E53935` (signage, core tangga, detail kecil — bukan ring AI) |
| Langit per fase | Pagi `#FFE0B2`→`#BFE3F7` · Siang `#BFE3F7`→`#E3F4FC` · Senja `#FF8A65`→`#7E57C2` · Malam `#1A237E`→`#0D1B2A` (gradient atas→bawah) |
| Sun per fase | Pagi `#FFD180` intensitas 1.0 · Siang `#FFFFFF` 1.4 · Senja `#FF7043` 0.8 · Malam `#5C6BC0` 0.25 + emissive jendela interior `#FFF3C4` |
| Lighting | `HemisphereLight` (skyColor/groundColor = warna langit atas/bawah fase aktif) + 1 `DirectionalLight` shadow `PCFSoft`, map 2048², shadow bias -0.0005; tanpa AO bake |
| Dunia luar gedung | Taman + jalan low-poly: ground plane 80×80 m `#A5D6A7`, jalan `#9E9E9E` lebar 6 m, trotoar `#CFCFCF`, 8–12 pohon bulat/kerucut, 1–2 mobil statis low-poly. Semua ikut §4 |

Kalimat penutup §4.1: `Nilai di atas dipakai MVP-2 (fase P0: palet, exterior, lighting) dan MVP-3 (fase P1–P2: day-night, kamera). Peta MVP↔fase: docs/mvp/README.md.`

**C. Game Feel (§8.4 baru, setelah §8.3)**
| Aspek | Nilai |
|---|---|
| Entry | Cinematic intro ≤ 4 s: kamera orbit turun dari 60 m → settle helicopter view (isometrik). Skip = klik/tombol apa pun. Checkbox "Jangan tampilkan lagi" → Zustand `persist` (localStorage). Setelah intro: helicopter view + floor selector |
| Juice (sedang) | Hover HANYA pada objek interaktif (`TASK_*`, `ROOM_*`, agent): emissive `#E53935` intensitas 0.35 + kursor pointer — state UI sementara, tidak dihitung dalam checklist "aksen merah tidak dominan" §4. Klik: scale bounce 1.05 → 1.0 dalam 180 ms. Transisi kamera: ease-in-out 0.6 s. Tanpa SFX; partikel hanya saat `celebrate` |
| Perilaku agents | Default di `TASK_desk_<id>`. Mapping enum `AGENT_STATUSES` (`packages/shared/src/enums.ts`) → lokasi+clip: `working`/`thinking` → desk + `type`; `blocked`/`waiting_permission` → `ROOM_meeting_a` + `sit` (loop) dengan `talk` overlay 2 s saat status berubah (butuh perhatian manusia); `idle` → `ROOM_lobby` area sofa + `idle`; `offline` → tidak dirender. MUST NOT menambah status di luar enum backend (§1 MUST NOT 6). Pindah = `walk` mengikuti waypoint `NAV_wp_<room_id>` (1 empty per `ROOM_*`, garis lurus antar waypoint; tanpa navmesh). MVP-4 (P3) mengirim 7 clip + demo `walk` sepanjang `NAV_wp_*` tanpa data backend; mapping ke status live dipasang di MVP-5 (P4) atau fase sesudahnya |
| Progresi | XP + level + badge, **data di backend** (MongoDB). Aturan XP/level/badge + endpoint = scope MVP-5 (fase P4). 3D hanya menampilkan: level di name tag, badge ikon di panel profil, `celebrate` saat level-up |
| Ambient idle | Bubble idle dari pool teks lokal (contoh: "☕ brb coffee", "🎧 focus mode") — **bukan data task/status, bukan demo data** (tidak melanggar §1 MUST NOT 6 / §8.3); style bubble abu-abu tanpa ikon status, berbeda dari bubble task backend. Interval bubble 20–60 s acak per agent. Prop bergerak: kipas 1 putaran/s, layar monitor ganti warna tiap 4 s, tanaman goyang ±3° periode 3 s |

Kalimat penutup §8.4: `Batas §8.3 ("tidak dibangun di P0–P3") berlaku untuk §8.1–8.2 (task board/Trello) saja. §8.4 dibangun per MVP: entry+juice → MVP-3 (P1–P2), clip+waypoint → MVP-4 (P3), mapping status + progresi + ambient → MVP-5 (P4). Peta: docs/mvp/README.md.`

**D. §11 Changelog baris baru**
| # | Keputusan | Kutipan/inti |
|---|---|---|
| 13 | Karakter: humanoid 1.7 m, satu rig untuk staff & AI, AI beda ring aksen per-agent 0.25 m; wajah ekspresif + shape key face_*; 7 clip; ≤ 8k tris | MVP-0 wawancara Q1–Q5 |
| 14 | Atmosfer: day-night cycle 4 fase, vibe startup playful | MVP-0 Q6–Q7 |
| 15 | Palet "Playful Pastel" (#F4EFE6/#FFF8F0/#D9D4CB, #FFB74D+#4DB6AC, merah #E53935); HemisphereLight + soft shadow 2048 | MVP-0 Q8–Q9 |
| 16 | Dunia luar: taman + jalan low-poly | MVP-0 Q10 |
| 17 | Game feel: cinematic ≤ 4 s skippable, juice sedang, agents desk-default + pindah per enum status backend (idle → ROOM_lobby), XP/level/badge backend, ambient bubble idle non-status + prop bergerak | MVP-0 Q11–Q15 |

**E. §0 tabel baris baru**: setelah baris `| §4 Style Spec |` → `| §4.1 Atmosfer | Palet, waktu, lighting, dunia luar | Task lighting/palet/exterior |`; setelah baris `| §8 Task & Gamification |` → `| §8.4 Game Feel | Entry, juice, perilaku agents, progresi, ambient | Task kamera/agent/UI |`.

**F. Baseline fakta** (jangan di-grep sebagai bukti edit — sudah ada sebelum edit): `1.7 m`, `NAV_`, `TASK_desk_`, `&lt;id&gt;`, `ROOM_lobby`, `ROOM_meeting_a`, `TBD` di §0 (.md l.35 / .html l.73), `parts sederhana` = 1, `untuk rigging` = 1. Pra-edit: `.md` `grep -c "TBD"` = 4, `.html` `grep -c 'class="tbd"'` = 4 (l.73, 172, 173, 179), `grep -cF "**TBD** —"` (.md) = 2, `grep -cF 'TBD</span> —'` (.html) = 2.

## Verification strategy

- Test strategy: **none (doc-only)**; agent-executed QA via `grep`/`sed`/`sha256sum`/`read` saja. Tidak ada langkah "user konfirmasi".
- Sebelum todo 1: `mkdir -p .omo/notepads/mvp-0-vision && find docs -type f | sort | xargs sha256sum > .omo/notepads/mvp-0-vision/baseline.sha256`. Catatan: semua file `docs/` saat ini **untracked** (`?? docs/...`), jadi `git status --porcelain` TIDAK bisa membedakan sebelum/sesudah edit — karena itu baseline pakai hash isi. Worktree juga dirty 20+ file di `apps/*`, `package.json` (sesi lain) — bukan scope, jangan disentuh, jangan dijadikan kriteria reject.
- Setiap todo: QA happy = grep nilai yang HANYA ada setelah edit; QA failure = grep nilai yang harus hilang/tidak ada. Hasil ditempel ke `.omo/notepads/mvp-0-vision/qa.md`.
- Grep ter-scope rentang: definisikan 3 fungsi shell SEKALI di awal sesi (jalankan dari repo root), lalu pakai `s84 | grep -c …` dst. Jangan pakai variabel string (kutip dalam `$VAR` tidak di-parse oleh sed):

```bash
G=docs/redhunter-hq-brainstorming-guided.md
s84(){ sed -n '/### 8.4 Game Feel/,/^## 9/p' "$G"; }
s51(){ sed -n '/### 5.1/,/### 5.2/p' "$G"; }
s41(){ sed -n '/### 4.1 Atmosfer/,/^## 5/p' "$G"; }
# cek enum status di §8.4 (backtick literal via [`], bukan backslash-escape):
s84 | grep -oE '[`](idle|thinking|working|blocked|waiting_permission|offline)[`]' | sort -u | wc -l   # harus 6
s84 | grep -cF '`meeting`'                                                                          # harus 0
```

Catatan executor: `grep -c` exit code 1 saat hitungan 0 (itu hasil BENAR untuk cek failure). Baca angka yang dicetak, jangan andalkan exit code; jangan jalankan blok QA di bawah `set -e`.

## Execution strategy

Satu wave, urutan 1→7. §0 dan §11 dikerjakan di todo 1 (aman karena anchor-based); todo 2–4 bottom-up §8 → §5 → §4 agar jarak anchor tidak bergeser; sama untuk .html di todo 5. Tanpa worktree, tanpa commit.

Dependency matrix:
| Todo | Blocked by |
|---|---|
| 1 | — (buat baseline.sha256 dulu) |
| 2 | 1 |
| 3 | 2 |
| 4 | 3 |
| 5 | 1–4 |
| 6 | 5 |
| 7 | 6 |

## Todos

- [x] 1. docs/redhunter-hq-brainstorming-guided.md: §11 #13–#17 + §0 baris baru
  - References: §11 tabel, anchor baris `| 12 | Interior wajib low-poly sama dengan exterior, satu bahasa visual |` (1 hit). §0 tabel, anchor `| §4 Style Spec |` dan `| §8 Task & Gamification |` (masing-masing 1 hit). Nilai: Decisions D & E. Sebelum edit apa pun: buat `baseline.sha256` (lihat Verification strategy).
  - Do: append 5 baris Decisions D tepat setelah baris `| 12 |`. Sisipkan 2 baris Decisions E di §0 setelah anchor masing-masing.
  - Acceptance: `grep -cE "^\| 1[3-7] \|" docs/redhunter-hq-brainstorming-guided.md` = 5. `grep -c "§4.1 Atmosfer" …md` = 1 (hanya §0 saat ini). `grep -c "§8.4 Game Feel" …md` = 1. `baseline.sha256` ada dan berisi ≥ 8 baris.
  - QA happy: `grep -c "| 17 |"` = 1. Evidence: qa.md §todo1.
  - QA failure: `grep -c "| 18 |"` = 0. Evidence: sama.
  - Commit: none (user belum minta).

- [x] 2. docs/redhunter-hq-brainstorming-guided.md: tambah §8.4 Game Feel
  - References: anchor `### 8.3 Batas` + bullet `- Tidak dibangun di P0–P3. Demo data hanya jika jelas dilabeli "demo mode".` (1 hit); §8.4 disisipkan setelah bullet itu, sebelum `---` yang mendahului `## 9.`. Nilai: Decisions C (tabel + kalimat penutup).
  - Do: tulis `### 8.4 Game Feel (MVP-0, terkunci)` + tabel C verbatim + kalimat penutup C.
  - Acceptance: `grep -n "### 8.4 Game Feel"` = 1 hit, sebelum `## 9.`. Pakai fungsi `s84` (Verification strategy): `s84 | grep -c "waiting_permission"` ≥ 1; `ROOM_lobby` ≥ 1; `NAV_wp_` ≥ 1; `Cinematic intro` ≥ 1; `1.05` ≥ 1; `MUST NOT 6` ≥ 1.
  - QA happy: perintah enum-6 di blok kode Verification strategy → output `6` (semua 6 status enum dipakai). Evidence: qa.md §todo2.
  - QA failure: perintah `` s84 | grep -cF '`meeting`' `` di blok kode → `0`; `s84 | grep -c "ROOM_lounge"` = 0 (tidak ada status/ruangan rekaan). `s84 | grep -ciE "endpoint /|/api/|schema \{"` = 0. Evidence: sama.
  - Commit: none.

- [x] 3. docs/redhunter-hq-brainstorming-guided.md: isi §5.1 tanpa TBD
  - References: anchor `### 5.1 Preferensi (dokumen hidup — user boleh revisi)` sampai `### 5.2` (masing-masing 1 hit). Nilai: Decisions A. Baris (tetap) = `Pose dasar`, `Pembeda antar agent`, `Generator` — JANGAN ubah teks aslinya. Urutan baris hasil = urutan tabel Decisions A (Bentuk, Tinggi, Staff vs AI agent, Wajah, Animasi wajib, Polycount, Pose dasar, Pembeda antar agent, Generator).
  - Do: ganti baris `Bentuk`, `Tinggi`, `Animasi wajib`; sisipkan baris `Staff vs AI agent`, `Wajah` setelah `Tinggi` dan `Polycount` setelah `Animasi wajib`; ganti kalimat `Atribut **TBD** → …` dengan kalimat pengganti Decisions A.
  - Acceptance: Pakai fungsi `s51`: `s51 | grep -c "TBD"` = 0. `grep -c "TBD" …md` = 1 (hanya §0). `s51 | grep -c "face_blink"` ≥ 1, `"≤ 8.000 tris"` ≥ 1, `"celebrate"` ≥ 1, `"0.25 m"` ≥ 1, `"≤ 200 tris"` ≥ 1. `s51 | grep -c "parts sederhana"` = 1 dan `"untuk rigging"` = 1 (baris tetap utuh). `s51 | grep -c "^| "` = 10 (header + 9 data; separator `|---|` tidak match; pra-edit 7).
  - QA happy: `s51 | grep -c "Humanoid low-poly"` = 1. Evidence: qa.md §todo3.
  - QA failure: `grep -cF "**TBD** —" …md` = 0 (pra-edit 2). Evidence: sama.
  - Commit: none.

- [x] 4. docs/redhunter-hq-brainstorming-guided.md: tambah §4.1 Atmosfer
  - References: anchor checklist §4 baris `- [ ] Naming §6 lengkap` (1 hit); §4.1 disisipkan setelahnya, sebelum `---` yang mendahului `## 5. Karakter`. Nilai: Decisions B (tabel + kalimat penutup).
  - Do: tulis `### 4.1 Atmosfer (MVP-0, terkunci)` + tabel B verbatim + kalimat penutup B.
  - Acceptance: `grep -n "### 4.1 Atmosfer"` = 1 hit sebelum `## 5.`. Pakai fungsi `s41`: `s41 | grep -c "#F4EFE6"` ≥ 1; sama `#4DB6AC`, `#1A237E`, `PCFSoft`, `HemisphereLight`, `80×80 m` masing-masing ≥ 1. `grep -c "4.1 Atmosfer" …md` = 2 (§0 + h3).
  - QA happy: `s41 | grep -c "docs/mvp/README.md"` ≥ 1. Evidence: qa.md §todo4.
  - QA failure: `grep -c "^## 4\.1"` = 0 (harus `###`). `s41 | grep -c "badge AI"` = 0. Evidence: sama.
  - Commit: none.

- [x] 5. docs/redhunter-hq-brainstorming-guided.html: mirror semua perubahan .md (bottom-up)
  - References: anchor .html (tiap anchor tepat 1 hit, verifikasi dengan `grep -c` sebelum edit): §11 baris `<tr><td>12</td>` (append 5 `<tr>` setelah baris `</tr>` penutupnya, sebelum `</table>`); §8.3 `<h3>8.3 Batas</h3>` + `<ul>…</ul>` (sisipkan `<h3>8.4 Game Feel (MVP-0, terkunci)</h3>` + `<table>` + `<p>` setelah `</ul>` itu, sebelum `<h2>9.`); §5.1 `<h3>5.1 Preferensi` tabel (ganti `<tr><td>Bentuk</td>…`, `<tr><td>Tinggi</td>…`, `<tr><td>Animasi wajib</td>…`, sisipkan 3 `<tr>` baru sesuai urutan Decisions A, ganti `<p>Atribut <span class="tbd">TBD</span> → …</p>`); §4 checklist anchor `<li>Naming §6 lengkap</li>` (1 hit; `</ul>` ada di baris berikutnya) → sisipkan `<h3>4.1 Atmosfer (MVP-0, terkunci)</h3>` + `<table>` + `<p>` setelah `</ul>` berikutnya, sebelum `<h2>5. Karakter</h2>`; §0 tabel (`<tr><td>§4 Style Spec</td>` dan `<tr><td>§8 Task &amp; Gamification</td>` → sisipkan baris setelah `</tr>` masing-masing). Markup: `<tr><td>…</td><td>…</td></tr>`, identifier & hex dalam `<code>`, escape `&amp;`, `&lt;`, `&gt;`, `≤`/`×`/`→` boleh literal UTF-8. Badge hero `Status: Brainstorming` JANGAN diubah. Baris (tetap) JANGAN diubah.
  - Do: terapkan isi todo 1–4 ke .html.
  - Acceptance: `grep -c 'class="tbd"' …html` = 1 (hanya definisi §0; pra-edit 4). `grep -c "4.1 Atmosfer" …html` = 2 (§0 + h3). `grep -c "8.4 Game Feel" …html` = 2. `grep -cE "<td>1[3-7]</td>"` = 5. `grep -c "#F4EFE6"` ≥ 1, `"#1A237E"` ≥ 1, `"face_blink"` ≥ 1, `"waiting_permission"` ≥ 1, `"HemisphereLight"` ≥ 1. `tail -1 …html` = `</html>`.
  - QA happy: `grep -c "<h3>4.1 Atmosfer"` = 1, `grep -c "<h3>8.4 Game Feel"` = 1. Evidence: qa.md §todo5.
  - QA failure: `grep -cF 'TBD</span> —' …html` = 0 (pra-edit 2); `sed -n '/<h3>5.1/,/<h3>5.2/p' …html | grep -c "tbd"` = 0; `grep -c "parts sederhana"` = 1; `grep -c "ROOM_lounge"` = 0. Evidence: sama.
  - Commit: none.

- [x] 6. Sinkronisasi .md ↔ .html: cek nilai identik (20 nilai diskriminatif)
  - References: kedua file; Decisions A–D. Daftar nilai (pra-edit 0 di kedua file): `#F4EFE6`, `#FFF8F0`, `#D9D4CB`, `#FFB74D`, `#4DB6AC`, `#E53935`, `#BFE3F7`, `#1A237E`, `8.000 tris`, `0.25 m`, `≤ 200 tris`, `PCFSoft`, `HemisphereLight`, `2048`, `celebrate`, `face_blink`, `0.6 s`, `1.05`, `NAV_wp_`, `waiting_permission`.
  - Do: untuk tiap nilai jalankan `grep -c <nilai>` di .md dan .html; tulis tabel 20 baris (nilai | count .md | count .html) ke qa.md §todo6. Juga hitung jumlah `<tr>` data di tabel §5.1/.html vs jumlah baris data `| … |` di §5.1/.md (harus sama: 9); sama untuk §4.1 (7), §8.4 (5), §11 (17).
  - Acceptance: tidak ada nilai dengan count 0 di salah satu file; 4 pasang jumlah baris tabel sama.
  - QA happy: tabel 20 baris semua ≥ 1. Evidence: qa.md §todo6.
  - QA failure: jika ada 0 atau jumlah baris beda → perbaiki file yang kurang, ulangi grep, catat sebelum/sesudah. Evidence: sama.
  - Commit: none.

- [x] 7. docs/mvp/HANDOFF.md: append laporan MVP-0
  - References: HANDOFF.md format komentar (baris 6–11). Tanggal: `time_current_time` timezone `Asia/Jakarta` format `YYYY-MM-DD`.
  - Do: append di akhir file (baris kosong lalu):
    ```
    ## MVP-0 — Visi Terkunci (YYYY-MM-DD)
    - Selesai: 15 keputusan visi diwawancarai & ditulis ke guide §4.1 Atmosfer, §5.1 (tanpa TBD), §8.4 Game Feel, §11 #13–#17; .html sinkron.
    - Output untuk MVP berikutnya: MVP-2 (P0) → §4.1 palet, exterior taman+jalan, HemisphereLight + DirectionalLight PCFSoft 2048; naming tambahan di hq.glb: 1 empty `NAV_wp_<room_id>` per `ROOM_*` (contoh `NAV_wp_lobby`, `NAV_wp_meeting_a`, `NAV_wp_workstation_a`) + area sofa di `ROOM_lobby`. MVP-3 (P1–P2) → §4.1 day-night 4 fase; §8.4 cinematic intro ≤ 4 s, juice sedang. MVP-4 (P3) → §5.1 humanoid 1.7 m, 7 clip, shape key face_blink/face_smile/face_talk di tiap CHAR_FACE_<id>, ≤ 8k tris, ring AI 0.25 m; demo `walk` sepanjang `NAV_wp_*` tanpa data backend — mapping dipasang di MVP-5. MVP-5 (P4) → §8.4 mapping `AGENT_STATUSES` → ruangan/clip, XP/level/badge backend, ambient bubble idle non-status + prop bergerak.
    - Keterbatasan / catatan: tidak ada kode/Blender/git di MVP-0. Day-night = 4 setup lighting; disarankan (bukan keharusan) MVP-2 render QA minimal fase siang + malam. Shape key bergantung output Meshy; fallback manual Blender. §5.1 menggantikan daftar clip §7.2 (idle/walk/sit/type → 7 clip).
    ```
  - Acceptance: `grep -c "## MVP-0"` = 1; `head -1 HANDOFF.md` = `# Redhunter HQ — MVP Handoff Log`; `grep -c "AGENT_STATUSES"` = 1; `grep -c "NAV_wp_lobby"` = 1.
  - QA happy: `grep -c "MVP-4 (P3)"` = 1. Evidence: qa.md §todo7.
  - QA failure: `sed -n '/## MVP-0/,$p' HANDOFF.md | grep -ci "wajib"` = 0 (tidak ada kewajiban baru); `grep -c "ROOM_lounge"` = 0. Evidence: sama.
  - Commit: none.

## Final verification wave

- [x] F1. Plan compliance audit: jalankan ulang SEMUA acceptance grep/sed todo 1–7, tempel output mentah ke `.omo/notepads/mvp-0-vision/qa.md` §final. APPROVE hanya jika semua nilai sesuai.
- [x] F2. Doc quality review: baca §4.1, §5.1, §8.4 di .md; setiap sel tabel berisi nilai konkret (hex/angka/nama identifier), tidak ada kata "mungkin/sebaiknya/TBD"; prosa Indonesia + identifier Inggris dalam backtick. Catat temuan ke qa.md §F2; temuan apa pun → perbaiki lalu ulangi F1.
- [x] F3. Real QA sinkronisasi: baca .html dan .md; untuk §0, §4.1, §5.1, §8.4, §11 hitung baris tabel di kedua file (harus sama); `grep -c "TBD" …md` = 1 dan `grep -c 'class="tbd"' …html` = 1; `grep -c "parts sederhana"` = 1 di kedua file (baris tetap tidak rusak). Catat ke qa.md §F3.
- [x] F4. Scope fidelity (hash-based, karena `docs/` untracked): (a) `sha256sum -c .omo/notepads/mvp-0-vision/baseline.sha256 2>/dev/null | grep -v ': OK$'` → output HARUS tepat 3 baris `FAILED`: `docs/redhunter-hq-brainstorming-guided.md`, `docs/redhunter-hq-brainstorming-guided.html`, `docs/mvp/HANDOFF.md`; baris FAILED lain → REJECT. (b) `find docs -type f | sort > .omo/notepads/mvp-0-vision/files-after.txt`; `diff <(cut -c67- .omo/notepads/mvp-0-vision/baseline.sha256 | sort) .omo/notepads/mvp-0-vision/files-after.txt` harus kosong (tidak ada file baru/hilang di `docs/`). (c) `git status --porcelain` di luar `docs/` dicatat ke qa.md §F4 sebagai informasi saja (milik sesi lain) — BUKAN kriteria reject. Simpan `find docs -type f | sort | xargs sha256sum > .omo/notepads/mvp-0-vision/after.sha256`.

## Commit strategy

Tidak ada commit. User belum memberi kata kerja git. Setelah F1–F4 lolos: laporkan "Implementasi selesai. Belum di-commit/push. Instruksi selanjutnya?" dan berhenti.

## Success criteria

- `grep -c "TBD" docs/redhunter-hq-brainstorming-guided.md` = 1 (hanya definisi §0).
- `grep -c 'class="tbd"' docs/redhunter-hq-brainstorming-guided.html` = 1.
- `### 4.1 Atmosfer` dan `### 8.4 Game Feel` ada di .md; `<h3>4.1 Atmosfer` dan `<h3>8.4 Game Feel` ada di .html.
- §11 berisi #13–#17 di kedua file; §0 berisi baris §4.1 dan §8.4 di kedua file.
- §8.4 memakai 6 status enum nyata (`waiting_permission` ada, `` `meeting` `` sebagai status tidak ada), `ROOM_lounge` tidak ada di file mana pun.
- HANDOFF.md berisi `## MVP-0` dengan `NAV_wp_lobby` di bullet MVP-2.
- F4: hanya 3 file docs berubah (hash), tidak ada file baru di `docs/`; tidak ada commit.
