# Redhunter HQ — MVP Roadmap (1 MVP = 1 sesi)

Setiap file `MVP-N-*.md` berisi **satu prompt siap paste** untuk satu sesi OpenCode baru.
Setiap MVP punya goal yang bisa didemokan, saling terikat lewat **handoff** (output MVP
sebelumnya = input MVP berikutnya), dan dijaga kecil supaya plan tidak membengkak.

Semua prompt wajib membaca `docs/redhunter-hq-brainstorming-guided.md` dulu (rules & style).

| MVP | Goal (yang bisa Anda lihat/coba) | Butuh dari MVP sebelumnya | Menyerahkan ke MVP berikutnya |
|---|---|---|---|
| [MVP-0](MVP-0-vision.md) | Visi terkunci: karakter, atmosfer, game feel tertulis di guide | — | Guide §4 Atmosfer, §5.1, §8.4 terisi |
| [MVP-1](MVP-1-foundation.md) | Dashboard web lama tetap jalan, kode 3D rapi & siap terima gedung baru | — | deps dideklarasi, `components/office/*` |
| [MVP-2](MVP-2-blender-lab.md) | **Blender Visual Lab** (pure Blender): gedung + Floor 1 bpy, uji Kit Meshy vs bpy, karakter Meshy, verdict Level 1/2 | MVP-0 | `.blend` approved + `build_hq.py` + aset raw |
| [MVP-3](MVP-3-integration.md) | **Gedung + agent tampil di browser** (export GLB → R3F) | MVP-1, MVP-2 | `hq_shell.glb` + `floor_N.glb` (per lantai, tanpa decimate), `char_base.glb`, helper node |
| [MVP-4](MVP-4-explore.md) | **Bisa menjelajah**: pilih lantai, fokus ruangan, jalan FPV, minimap | MVP-3 | sistem kamera/FPV/minimap, interactable |
| [MVP-5](MVP-5-tasks.md) | **Kantor jadi alat kerja**: task board 3D + Trello sync | MVP-3, MVP-4 | sistem task end-to-end |

```
MVP-0 ✅ ──► MVP-2 Blender Lab (tanpa kode) ─┐
MVP-1 (web) ─────────────────────────────────┴─► MVP-3 Integrasi ─► MVP-4 Explore ─► MVP-5 Task
```
Boleh paralel: MVP-1 ∥ MVP-2 (MVP-2 tidak menyentuh `apps/web`). Sisanya berurutan.

## Aturan antar-sesi
- Paste isi blok prompt dari satu file MVP ke sesi baru. Jangan gabung dua MVP.
- Di akhir tiap MVP, agent menulis **Handoff Report** ke `docs/mvp/HANDOFF.md` (append) —
  MVP berikutnya membaca file itu, jadi Anda tidak perlu menjelaskan ulang apa pun.
- MVP gagal di tengah → paste prompt yang sama + "lanjutkan dari: <ringkasan HANDOFF terakhir>".
- Persiapan manual Anda: Blender desktop + addon MCP aktif; Meshy Free (manual download GLB dari web)
  atau Meshy Pro + `MESHY_API_KEY` (MVP-2, Sloyd ditunda); `TRELLO_KEY` + `TRELLO_TOKEN` (MVP-5).

`docs/redhunter-hq-step-prompts.md` = versi lama per-step (arsip); pakai folder ini.
