# MVP-5 — Kantor Jadi Alat Kerja (Task Board 3D + Trello)

**Goal:** task nyata terlihat & bisa dikelola dari dalam kantor 3D, tersinkron dengan Trello.
**Demo:** buat kartu di Trello → muncul di task board 3D meeting room; tekan E di desk → panel task; ubah status → Trello ikut berubah.
**Butuh:** MVP-4 (sistem interactable, FPV), MVP-3 (agent char_base.glb untuk visualisasi status), `TRELLO_KEY` + `TRELLO_TOKEN`.
**Handoff:** sistem task end-to-end → fase berikutnya (avatar DIY, gamification XP, lantai 2–4).

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-5 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §1, §8
lengkap termasuk §8.4 Game Feel), docs/mvp/README.md, docs/mvp/HANDOFF.md (cara menambah
interactable dari MVP-4, anchor TASK_board/TASK_desk_* dari MVP-2). Juga baca AGENTS.md
apps/api untuk konvensi backend (factory createX, zod di setiap boundary, routes tipis +
logic di services). Guide = sumber kebenaran; konflik → guide menang.
Saya mengizinkan implementasi untuk scope MVP-5 ini saja.

Prinsip mutlak: backend Redhunter (Express + MongoDB) = source of truth. Objek 3D hanya
visual + trigger UI, tidak menyimpan state task. Dilarang endpoint fiktif / data palsu
permanen. Mode demo hanya bila Trello belum dikonfigurasi DAN dilabeli jelas "demo mode".

Prasyarat: TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID di .env lokal (gitignored). Tidak ada →
STOP, pandu saya membuatnya. Konfirmasi ke saya board Trello mana yang dipakai.

GOAL MVP-5 (3 fase, checkpoint di antara fase):

FASE 1 — Backend:
1. Shared zod schema Task di packages/shared (id, title, status 'todo'|'doing'|'done',
   assigneeId, trelloCardId, updatedAt). Mongoose model di apps/api.
2. Routes + service: GET/PATCH tasks. Sync Trello: pull board → MongoDB (list ↔ status
   mapping dikonfigurasi), push PATCH → Trello, webhook receiver (validasi signature Trello).
3. Event realtime via Socket.IO namespace /office yang ada (task.updated), lewat outbox
   events yang ada — jangan bypass.
4. Test service (bun test) dengan Trello API di-mock di level HTTP client.
   ⏸ CHECKPOINT: bukti curl request/response nyata ke Trello, tunggu persetujuan.

FASE 2 — Panel UI (2D, shadcn):
5. Panel board (kolom To Do / Doing / Done), detail kartu, ubah status. Panel task per staff.
   Live update via socket.

FASE 3 — Trigger dari 3D:
6. TASK_board di ROOM_meeting_a → klik (helicopter) / E (FPV) → panel board.
7. TASK_desk_<n> → E saat dekat (FPV) / klik → panel task staff desk itu.
8. Feedback sesuai §8.4: agent di desk menampilkan speech bubble judul task "doing";
   task done → animasi selebrasi kecil (jika ada animasinya) / indikator.
9. Verifikasi end-to-end (bukti, bukan klaim): buat kartu di Trello → muncul di panel 3D;
   ubah status dari panel → berubah di Trello. Screenshot + log request.

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: endpoint, schema, mapping list Trello,
cara setup webhook (butuh URL publik — catat opsi Tailscale Funnel/ngrok, JANGAN expose
port Blender/Mongo), keterbatasan, usulan fase berikutnya (avatar DIY, XP/badge, lantai 2–4).

Batasan: business logic di backend. Jangan expose Mongo/Blender ke publik. Jangan commit
git atau .env kecuali saya minta.
Definition of Done: sync dua arah terbukti, panel bisa dibuka dari 3D, test lulus, HANDOFF ter-update.
```
