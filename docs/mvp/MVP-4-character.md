# MVP-4 — Agent Pertama Hidup di Kantor (Meshy)

**Goal:** satu AI agent hasil Meshy beranimasi di lobby, plus verdict apakah Meshy layak dipakai lebih luas.
**Demo:** buka dashboard → agent idle (dan walk) di lobby, style konsisten dengan gedung.
**Butuh:** MVP-0 (§5.1 karakter), MVP-2 (`hq.glb`), `MESHY_API_KEY` di `.env`.
**Handoff:** `char_base.glb` + skeleton CHAR_BASE (fondasi avatar DIY) + verdict Meshy → MVP-5 & fase avatar DIY.

## Prompt (paste ke sesi baru)

```
Repo: /home/programer/work/redhunter-reborn/visual-office. Sesi ini = MVP-4 Redhunter HQ.

LANGKAH PERTAMA WAJIB: baca docs/redhunter-hq-brainstorming-guided.md LENGKAP (fokus §3 Hybrid
Meshy conditional, §4, §5, §6, §7.2), docs/mvp/README.md, docs/mvp/HANDOFF.md.
Guide = sumber kebenaran; konflik → guide menang. Karakter WAJIB sesuai §5.1 (hasil MVP-0).
Jika §5.1 masih TBD → STOP dan tanya saya, jangan menebak bentuk karakter.
Saya mengizinkan implementasi untuk scope MVP-4 ini saja.
Load skill: 3d-router, 3d-ai-asset-intake, blender2three-export, threejs-animation, 3d-visual-qa.

Prasyarat manual: MESHY_API_KEY di .env lokal (pastikan .env di-gitignore). Jika tidak ada →
STOP, minta saya membuat key. JANGAN langganan: free tier saja. Laporkan kredit terpakai.

GOAL MVP-4:
1. Susun prompt Meshy dari §5.1 + §4 (low-poly flat-shaded, clean geometry, stylized,
   T-pose/A-pose, polycount target §5.1). Tunjukkan prompt ke saya sebelum submit.
2. Meshy API text-to-3D: curl submit → poll status → download GLB ke
   apps/assets/meshy/raw/. Simpan JSON response (task id, kredit).
3. Import ke Blender via MCP "blender". Cek checklist §4 + intake (skala 1 unit = 1 m, origin
   di kaki, orientasi, polycount, tidak buram). Render close-up PNG → tunjukkan.
   ⏸ CHECKPOINT: tunggu persetujuan kualitas. Jika gagal → revisi prompt (maks 2 retry, kabari kredit).
4. Rig + animasi idle & walk (+ animasi tambahan §5.1 bila ada): Meshy Animate API;
   fallback Mixamo (instruksikan langkah manual saya bila perlu). Nama armature/body
   CHAR_BASE sesuai §6. Save apps/assets/blender/char_v01.blend.
5. Export GLB animated → optimasi → apps/web/public/models/char_base.glb. Rename
   character.glb lama → character_legacy.glb.
6. R3F: komponen agent memakai char_base.glb dengan AnimationMixer (drei useAnimations),
   spawn di lobby (dekat NAV_spawn_lobby), idle loop; perilaku sesuai §8.4 (jika "jalan antar
   ruangan" → cukup demo walk path sederhana, tanpa data backend).
7. Playwright screenshot dashboard: agent tampil dalam scene, skala vs desk/pintu masuk akal.

VERDICT (wajib, tulis ke HANDOFF): kualitas Meshy vs checklist §4, konsistensi style dengan
gedung bpy, kredit terpakai, rekomendasi: (a) Meshy lanjut untuk props (hybrid Level 1),
(b) Meshy hanya karakter, (c) ganti generator. Update guide §11 changelog dengan verdict.

Selesai: append Handoff Report ke docs/mvp/HANDOFF.md: file paths, struktur skeleton CHAR_BASE
(nama bone utama — penting untuk avatar DIY slot-based §5.2 nanti), daftar animasi, kredit, verdict.

Batasan: 1 karakter. Tidak sistem avatar DIY penuh (cukup pastikan skeleton siap). Tidak
langganan. Jangan commit git kecuali saya minta. Jangan commit .env.
Definition of Done: agent beranimasi di lobby, style lolos §4, verdict tertulis, HANDOFF ter-update.
```
