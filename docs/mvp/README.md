# Redhunter HQ — MVP Roadmap (1 MVP = 1 sesi)

Setiap file `MVP-N-*.md` berisi **satu prompt siap paste** untuk satu sesi OpenCode baru.
Setiap MVP punya goal yang bisa didemokan, saling terikat lewat **handoff** (output MVP
sebelumnya = input MVP berikutnya), dan dijaga kecil supaya plan tidak membengkak.

Semua prompt wajib membaca `docs/redhunter-hq-brainstorming-guided.md` dulu (rules & style).

| MVP | Goal (yang bisa Anda lihat/coba) | Butuh dari MVP sebelumnya | Menyerahkan ke MVP berikutnya |
|---|---|---|---|
| [MVP-0](MVP-0-vision.md) | Visi terkunci: karakter, atmosfer, game feel tertulis di guide | — | Guide §4 Atmosfer, §5.1, §8.4 terisi |
| [MVP-1](MVP-1-foundation.md) | Dashboard web lama tetap jalan, kode 3D rapi & siap terima gedung baru | — | deps dideklarasi, `components/office/*` |
| [MVP-2](MVP-2-building.md) | **Gedung low-poly baru terlihat di browser** (4 lantai, Floor 1 detail) | MVP-0, MVP-1 | `hq.glb` live + `build_hq.py` |
| [MVP-3](MVP-3-explore.md) | **Bisa menjelajah**: pilih lantai, fokus ruangan, jalan FPV, minimap | MVP-2 | sistem kamera/FPV/minimap, `COL_*` dipakai |
| [MVP-4](MVP-4-character.md) | **Agent pertama hidup** di kantor (Meshy, beranimasi) + verdict Meshy | MVP-0, MVP-2 | `char_base.glb`, skeleton CHAR_BASE |
| [MVP-5](MVP-5-tasks.md) | **Kantor jadi alat kerja**: task board 3D + Trello sync | MVP-3, MVP-4 | sistem task end-to-end |

Urutan: **MVP-0 → MVP-1 → MVP-2 → MVP-3 → MVP-4 → MVP-5**.
Boleh paralel: MVP-0 ∥ MVP-1 (tidak saling sentuh). MVP-3 ∥ MVP-4 setelah MVP-2.

## Aturan antar-sesi
- Paste isi blok prompt dari satu file MVP ke sesi baru. Jangan gabung dua MVP.
- Di akhir tiap MVP, agent menulis **Handoff Report** ke `docs/mvp/HANDOFF.md` (append) —
  MVP berikutnya membaca file itu, jadi Anda tidak perlu menjelaskan ulang apa pun.
- MVP gagal di tengah → paste prompt yang sama + "lanjutkan dari: <ringkasan HANDOFF terakhir>".
- Persiapan manual Anda: Blender desktop + addon MCP aktif (MVP-2), `MESHY_API_KEY` (MVP-4),
  `TRELLO_KEY` + `TRELLO_TOKEN` (MVP-5).

`docs/redhunter-hq-step-prompts.md` = versi lama per-step (arsip); pakai folder ini.
