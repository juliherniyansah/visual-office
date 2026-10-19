# CHECKPOINT 3 — APPROVED

Approved by: user (checkpoint question via orchestrator)
Timestamp: 2026-10-18T17:45:00Z

## Persetujuan Ulang (re-approval) — 2026-10-19

Kutipan verbatim user: **"Ya tangani dan lanjutkan"** (user, 2026-10-19, membalas ringkasan keputusan checkpoint 3: cap tekstur 2048², shell 561.718 tris tetap INFO, tanpa split fasad, tanpa decimate, mode KTX2).

Catatan: balasan asli 2026-10-18 tidak terpulihkan dari log sesi (sudah dicari orchestrator via `session_search`). Kutipan di atas adalah persetujuan ulang eksplisit atas keputusan yang sama, dicatat apa adanya dengan tanggal hari ini — bukan seolah-olah tanggal lama.

## Locked decisions

- Texture cap 2048² CONFIRMED (kit source 4096² downscaled per guide §7.5).
- Shell 561,718 tris kept as INFO per decision #21; no facade split; no decimate.
- KTX2 mode active (KTX-Software v4.4.2 installed); fallback branch remains in optimize-hq.sh for machines without ktx.

## GLB table

| File | Size (MB) | Tris (Δ vs staging baseline) | Draw Call Estimate | Prefix Counts (COL / NAV / TASK / ROOM / CHAR) | Max Tex | Instance Batches | Notes |
|------|-----------|------------------------------|--------------------|------------------------------------------------|---------|------------------|-------|
| `hq_shell.glb` | 12.84 | 561,718 (+0 / 0.00%) | 33 | 0 / 0 / 0 / 0 / 0 | 2048 | 0 | Budget verdict: **INFO** — shell ~561,718 tris post-instance is accepted per decision #21; **no decimate allowed**. If user considers it heavy, the only sanctioned option is splitting the facade per floor into `floor_N.glb`. |
| `floor_1.glb` | 6.73 | 103,148 (+0 / 0.00%) | 117 + 2 = **119** | 20 / 7 / 9 / 3 / 0 | 2048 | 2 | Real-file `nodes.ts` verification **PASS**. |
| `floor_2.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `floor_3.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `floor_4.glb` | 3.90 | 107,260 (+0 / 0.00%) | 6 + 1 = **7** | 1 / 0 / 0 / 0 / 0 | 2048 | 1 | |
| `char_base.glb` | 0.93 | 19,499 (+0 / 0.00%) | 1 | 0 / 0 / 0 / 0 / 2 | 2048 | 0 | `CHAR_`=2 are legacy avatar bones; not tracked in the staging expected map. |

Draw-call formula: `draw_calls = |{(mesh_index, material_index) for every primitive}| + |{nodes with EXT_mesh_gpu_instancing}|`.

Prefix expected vs actual: all match task-2-optimize-happy.txt line 191 expectations. **No BLOCK.**

Source detail: `.omo/evidence/mvp3-integration/task-3-glb-table.md`.
