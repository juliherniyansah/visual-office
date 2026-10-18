---
slug: mvp-0-vision
intent: clear
review_required: true
status: plan-complete-reviewed
pending-action: none — handoff; user starts worker session (/start-work)
plan_path: .omo/plans/mvp-0-vision.md
plan_sha256: 97f60915e74f9896789964a2eea7319dfde8a7737cfd62af1a29e3bb327ee740 (v4 as reviewed r3; 3 non-blocking wording nits applied after → hash changed, substance identical)
review_round_id: r3-2026-10-16
round_status: closed
r3_result: momus OKAY + oracle OKAY (both re-ran fenced-block QA against disk + simulated post-edit; all counts hit targets). Non-blocking applied post-OKAY: §8.4 closing sentence now "mapping status + progresi + ambient → MVP-5 (P4)"; dropped "integrasi backend" label (conflicts §7.3 P3); added executor note that `grep -c` exits 1 on count 0 (do not run under set -e).
r2_result: both CHANGES_REQUESTED, QA-command bugs only (substance OK): $S51/$S84/$S41 string vars unusable → shell functions s51/s84/s41 in fenced block; backslash-escaped backticks → [`] class / plain backtick with -F; §5.1 row count 11→10; class="tbd" pre-edit 3→4; F4 cut path absolute; optional: mapping owner → MVP-5. All applied → plan v4.
r1_result: momus CHANGES_REQUESTED (F4 broken: docs/ untracked so git-status baseline useless; 17→19 count; §5.1 row order; bottom-up wording) + oracle CHANGES_REQUESTED (ring colour vs red list; ROOM_lounge absent from P0 floor 1 → ROOM_lobby sofa; MVP-4 scope = clips+demo walk, mapping after; NAV_wp_ naming belongs to MVP-2 bullet; non-discriminating failure greps **TBD** —/TBD</span> —/wajib; html anchor <li>…</li></ul> on 2 lines; after.txt allowlist; narrative values ring/emissive/sit+talk/Hemisphere/prop motion; §7.2 clip note). ALL folded into plan v3 (sha unknown, bash absent). Pending user flag: idle room changed lounge→lobby (P0 scope), user may overrule.
metis: done (ses_eb8dc06bdffe1lBItVERcGtlt7) — 15 findings folded in (anchors not line numbers, baseline diff for F4, real AGENT_STATUSES enum, ROOM_lounge/NAV_wp_, face_* shape keys, §8.3 scope note, no new QA MUST for other MVPs)
review:
  momus: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, target: .omo/plans/mvp-0-vision.md, round_id: r3-2026-10-16, launch_id: L3-momus, session: ses_eb8d78e24ffedkpdC6odyz7pRt, bg: bg_435b3afd, sha256: 97f60915e74f9896789964a2eea7319dfde8a7737cfd62af1a29e3bb327ee740, result: OKAY }
  independent: { status: done, workspace_root: /home/programer/work/redhunter-reborn/visual-office, target: .omo/plans/mvp-0-vision.md, round_id: r3-2026-10-16, launch_id: L3-oracle, session: ses_eb8d76700ffegiS5SF46vzZwed, bg: bg_bbbd466b, sha256: 97f60915e74f9896789964a2eea7319dfde8a7737cfd62af1a29e3bb327ee740, result: OKAY }
---

# Draft — MVP-0 Visi Terkunci

## Context (verified)
- Guide .md: docs/redhunter-hq-brainstorming-guided.md (318 lines). §5.1 TBD rows: Bentuk (l.144), Tinggi (l.145); note l.151. §4 ends l.134; §8.3 at l.247-248; §11 table ends l.318 (entry #12 last).
- Guide .html: docs/redhunter-hq-brainstorming-guided.html (339 lines). §5.1 TBD at l.172-173, note l.179. §4 block ends l.166 (before `<h2>5.`). §8.3 at l.263-266. §11 table rows l.319-330, `</table>` l.331. CSS classes: .tbd, .note, table/th/td.
- HANDOFF.md: 11 lines, header + format comment; append-only.
- MVP-4 prompt consumes §5.1 (bentuk, polycount, animasi tambahan) and §8.4 (perilaku agents).
- User explicitly asked to be interviewed → CLEAR, adopt-default filter OFF. User said "tulis plan lalu high review" → review_required: true.
- Classify: Trivial-Standard (3 doc files, no code). bash unavailable → scaffold script cannot run; plan file hand-built with verbatim template headers.

## Decisions (all 15 answered)
A. Karakter
1. Bentuk: humanoid low-poly, tinggi 1.7 m (skala real §4)
2. Staff vs AI: bentuk sama, satu CHAR_BASE + satu rig; AI dibedakan aksen visual (badge/ring di atas kepala + warna aksen), bukan bentuk
3. Animasi tambahan: wave, talk, celebrate (total 7 clip: idle, walk, sit, type, wave, talk, celebrate)
4. Wajah: ekspresif (mata + mulut termodel) + blendshape (minimal: blink, smile, talk)
5. Polycount: ≤ 8.000 tris per karakter (base + parts), 1 material, 1 tekstur ≤ 1024² atau vertex color; budget 10 agents ≈ 80k tris
B. Atmosfer
6. Waktu: day-night cycle (ikut jam lokal client; 4 fase: pagi/siang/senja/malam)
7. Vibe: startup playful
8. Palet A "Playful Pastel": exterior #F4EFE6, interior #FFF8F0, lantai #D9D4CB, sekunder #FFB74D + #4DB6AC, langit siang #BFE3F7, aksen merah #E53935
9. Lighting: gradient sky (hemisphere) + 1 directional PCFSoft shadow map 2048; day-night = ubah warna sky + arah/warna sun
10. Dunia luar: taman + jalan low-poly (ground, pohon, jalan, trotoar, 1–2 mobil statis)
C. Game feel
11. Entry: cinematic intro ≤ 4 s (orbit turun → settle helicopter), skippable klik, preferensi "jangan tampilkan lagi"
12. Juice: sedang — hover outline/emissive tipis, klik scale bounce 1.05, kamera ease 0.6 s
13. Perilaku: campuran — default di TASK_desk_<id>; status backend → walk ke ruangan via NAV_* (mapping: working→desk/type, meeting→ROOM_meeting, idle→lounge, offline→tidak tampil)
14. Progresi: XP + level + badge, data backend (schema/endpoint = scope MVP-5; §8.4 hanya mencatat keputusan)
15. Ambient idle: life ringan — bubble idle dari pool teks lokal (tanpa klaim task/status, dilabeli non-status), prop bergerak (kipas, layar berkedip, tanaman goyang)

## Approach
Doc-only edits: (1) guide .md §4 tambah "4.1 Atmosfer" sub-bagian, §5.1 isi Bentuk/Tinggi + tambah baris Wajah/Animasi tambahan/Polycount/Pembeda AI, hapus kalimat TBD, (2) §8.4 "Game Feel" setelah §8.3, (3) §11 tambah #13–#17, (4) §0 tabel tambah baris jika perlu, (5) mirror ke .html dengan markup/kelas yang sama, (6) append HANDOFF.md "MVP-0". No code, no Blender, no git.

## Approval gate
awaiting user okay → then write .omo/plans/mvp-0-vision.md, then dual review (momus + oracle).
