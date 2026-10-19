# mvp3-integration - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->

**Who this is for and what changes for them:** Anda melihat dashboard Redhunter HQ di browser: gedung 3D hasil Blender MVP-2 (bukan kotak prosedural lama), pilih lantai 1–4 (hanya lantai aktif dimuat, fasad lantai aktif dibuka agar interior terlihat), satu karakter beranimasi idle di lobby. Sesi MVP-4/5 menerima file gedung per lantai + helper pencari node untuk kamera/FPV/task board.

**What you'll get:** File gedung terpisah (kerangka eksterior + 4 lantai) hasil export Blender teroptimasi (kompresi mesh + tekstur KTX2, geometri TIDAK disentuh), dashboard yang memuatnya per lantai, karakter beranimasi, laporan angka performa per lantai.

**Why this approach:** Keputusan #21 (guide §7.5) = render per lantai kualitas penuh — optimasi hanya kompresi format + instancing, bukan pengurangan polygon. Keputusan visual final di MVP-2; sesi ini hanya memindahkannya ke web.

**What it will NOT do:** Tidak decimate/simplify geometri, tidak ubah bentuk, tidak sentuh backend, tidak day-night cycle (MVP-4), tidak FPV/task board (MVP-4/5), tanpa biaya Meshy baru, tanpa git commit.

**Effort:** Large
**Risk:** Medium — pipeline export→KTX2→web punya titik gagal baru (biner `ktx` eksternal, wiring KTX2Loader, instancing kit), semuanya punya preflight/fallback terukur.

**Decisions to sanity-check:** (1) 7 agent kapsul prosedural DIHAPUS, 1 karakter Meshy di lobby; (2) GLB >10 MB tidak masuk git (regen via script); (3) lantai awal = 1; (4) tekstur kit 4096² di-cap ke 2048² sesuai batas guide §7.5 (satu-satunya "pengecilan", pada tekstur saja — veto tersedia di checkpoint 3); (5) KTX2 butuh KTX-Software terpasang; bila gagal dipasang → fallback meshopt+PNG dicatat sebagai deviasi.

Your next move: selesai direview (round 2), eksekusi via `/ulw-execute`.

---

> TL;DR (machine): Large / Medium risk — export hq_v04.blend → 6 GLB (shell + 4 lantai + char) via pipeline ktx-safe, loader R3F per lantai + cutaway + helper node, 1 agent idle lobby, stats per lantai, HANDOFF append.

## Scope
### Affected user and ideal state
**Affected user:** (1) Owner — membuka dashboard `bun run dev`, melihat gedung + agent, menilai kualitas di 2 checkpoint; (2) Agent MVP-4/5 — memakai GLB per lantai + helper node by prefix; (3) Pengunjung dashboard — scene termuat per lantai tanpa error console.

| Row | Statement | Reason |
| --- | --- | --- |
| IS-1 | Dashboard menampilkan shell eksterior + CUTAWAY lantai aktif (fasad lantai aktif disembunyikan, interior lantai aktif terlihat), dipilih via FloorSelector; hanya lantai aktif yang dimuat | Goal demo MVP-3, guide §7.5 MUST cutaway |
| IS-2 | Kualitas visual setara render MVP-2: geometri identik (tris dipertahankan ±0,1%), tekstur tajam — satu-satunya pengecilan = cap tekstur 2048² per §7.5 | Keputusan #21, §7.5 |
| IS-3 | Satu karakter (CHAR_BASE + skeleton) idle beranimasi di posisi NAV_spawn_lobby saat lantai 1 aktif | Fase 3 prompt |
| IS-4 | Lantai 2–4 (blockout) dapat dipilih dan termuat; lantai non-aktif tidak dirender dan memory GPU-nya dibebaskan (kunjung ulang boleh re-fetch) | Render per lantai §7.5 |
| IS-5 | Node COL_ tersembunyi di web tapi tetap ada di GLB; NAV_/TASK_/ROOM_ tetap sebagai node SETELAH optimasi | Naming contract §6, handoff MVP-4/5 |
| IS-6 | renderer.info (calls/triangles) + FPS per lantai tercatat sebagai info, bukan target pangkas | §7.5 |
| IS-7 | `bun run typecheck` lulus; lint file disentuh bersih (pre-existing dicatat terpisah) | Verifikasi wajib prompt |
| IS-8 | MVP-4/5 agent dapat resolve node by prefix dari GLB nyata (diverifikasi pada floor_1) via satu helper file | Handoff requirement |

| GAP | Difference today | Closed by todo(s) |
| --- | --- | --- |
| GAP-1 | Web memakai building.glb prosedural 12.4 KB + agent kapsul | 1, 2, 6, 7, 8, 9, 11 |
| GAP-2 | Tidak ada floor_N.glb per lantai | 1, 2, 3 |
| GAP-3 | Tidak ada char_base.glb live beranimasi di web | 1, 2, 9 |
| GAP-4 | Tidak ada helper node by prefix | 5, 3 |
| GAP-5 | Baseline Playwright masih tampilan lama | 11 |
| GAP-6 | Tidak ada angka renderer.info/FPS per lantai | 10 |
| GAP-7 | HANDOFF.md belum ada laporan MVP-3 | 13 |

### Must have
- `apps/assets/blender/export_hq.py` headless, idempotent, self-check (pola `build_hq.py --check`).
- Output `apps/web/public/models/{hq_shell,floor_1..4,char_base}.glb` + transcoder basis lokal di `apps/web/public/basis/`.
- Pipeline `gltf-transform`: `dedup` → `instance` → `meshopt` → `uastc` (normal/ORM) → `etc1s` (base color), tanpa `prune` default, tanpa `weld`, tanpa simplify/decimate; cap tekstur 2048² kondisional (`--resize` hanya untuk tekstur >2048²).
- Loader per lantai R3F lazy + cutaway fasad lantai aktif + dispose GPU saat unmount; KTX2 wired via extendLoader dengan `import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'` (teresolve dari apps/web; `three-stdlib` TIDAK — transitive dep drei, tak ter-hoist; review round-2).
- Helper `apps/web/src/components/office/nodes.ts`.
- Lighting §4.1 fase siang (hemisphere skyColor `#BFE3F7` / groundColor `#E3F4FC` + directional `#FFFFFF` 1.4, PCFSoft 2048, bias -0.0005).
- Tabel verifikasi per GLB + stats renderer.info/FPS per lantai.
- Handoff Report append `docs/mvp/HANDOFF.md`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- MUST NOT decimate/simplify/weld/merubah geometri apapun (tris hasil ≥ baseline −0,1%; char ≈19.499 tris).
- MUST NOT downscale tekstur DI BAWAH 2048²; cap 2048² hanya berlaku untuk tekstur sumber yang lebih besar (4096 kit) — keputusan tercatat, veto di checkpoint 3.
- MUST NOT redesain visual. Perubahan model hanya bila export rusak, via `build_hq.py`, bukan edit manual `.blend`; `hq_v04.blend` tidak di-save ulang oleh export.
- MUST NOT sentuh `apps/api`, `packages/*`.
- MUST NOT git commit/push.
- MUST NOT spend kredit Meshy (assert di todo 13: tidak ada task Meshy baru setelah ledger MVP-2).
- MUST NOT bangun day-night cycle (MVP-4), FPV (MVP-4), task board (MVP-5), minimap.
- MUST NOT tambah dep runtime web; `@gltf-transform/cli` hanya root devDependency; KTX-Software (`ktx` ≥4.4) = system prerequisite terdokumentasi.
- MUST NOT pakai `apps/assets/scripts/optimize.sh` lama (draco+webp+1024, kontra #21); biarkan tak tersentuh.
- MUST NOT andalkan CDN runtime transcoder; `useDraco={false}` (meshopt dipakai).

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + self-check scripts + e2e gate. (a) `export_hq.py --check` membandingkan GLB staging vs koleksi .blend langsung (expected counts dihitung dari .blend, bukan hardcode); (b) `gltf-transform inspect` memvalidasi extension + prefix counts + tris preservation + max texture size; (c) Playwright `dashboard-office.e2e.ts` gate visual + stats + lazy-load assertions; (d) `bun run typecheck` + `biome lint` per file disentuh. Dua checkpoint user (todo 3, 11) = satu-satunya gerbang manusia; semuanya lain mesin.
- Evidence: `.omo/evidence/mvp3-integration/` (mkdir -p oleh todo 1 sebelum tulis pertama).

## Execution strategy
### Parallel execution waves
- **Wave 1:** Todo 1.
- **Wave 2:** Todo 2 setelah 1; Todo 3 setelah 2 (⏸ CHECKPOINT 3 — artefak approval wajib sebelum Wave 3); Todo 4, 5 paralel.
- **Wave 3:** Todo 6, 7, 8 setelah CHECKPOINT-3-APPROVED; Todo 9 setelah 6.
- **Wave 4:** Todo 10 setelah 9; Todo 11 setelah 6–10 (⏸ CHECKPOINT 11); Todo 12, 13 terakhir.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 2,3 | — |
| 2 | 1 | 3,6,7,8,9 | 4,5 |
| 3 | 2 | ⏸3 → 6,7,8,9 | 4,5 |
| 4 | 2 | — | 3,5 |
| 5 | — | 3(verif GLB nyata),6,9 | 1,2,3,4 |
| 6 | CHECKPOINT-3-APPROVED, 5 | 9,10,11 | 7,8 |
| 7 | CHECKPOINT-3-APPROVED | 11 | 6,8 |
| 8 | 6 | 11 | 7 |
| 9 | 6, 5 | 10,11 | 8 |
| 10 | 9 | 11 | — |
| 11 | 6,7,8,9,10 | ⏸11 → 12,13 | — |
| 12 | 6–11 | 13 | — |
| 13 | 1–12 | — | — |

Gate condition CHECKPOINT: file `.omo/evidence/mvp3-integration/CHECKPOINT-3-APPROVED.md` (berisi tabel + kutipan verbatim balasan user + timestamp) HARUS ada sebelum todo 6/7/8 mulai; `CHECKPOINT-11-APPROVED.md` sebelum todo 12/13. "Pesan terkirim" ≠ approved — file adalah gerbangnya.

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Script export headless `export_hq.py` (shell + 4 lantai + karakter)
  What to do / Must NOT do: Buat `apps/assets/models/export/` (`mkdir -p`, tidak ada di repo) dan `.omo/evidence/mvp3-integration/`. Buat `apps/assets/blender/export_hq.py` (pola argparse manual `build_hq.py:34-74`; jalankan `PYTHONPATH=/home/programer/.local/lib/python3.14/site-packages blender -b apps/assets/blender/hq_v04.blend --python-use-system-env --python-exit-code 1 -P apps/assets/blender/export_hq.py -- --out apps/assets/models/export --check`). BUKA .blend TANPA save ulang. Export via `bpy.ops.export_scene.gltf` dengan `use_selection=True` per output, `export_format='GLB'`, `export_extras=True`, `export_yup=True`:
  (a) `hq_shell_src.glb` = EXTERIOR + fasad perimeter semua lantai + `roof_top` + `SIGN_redhunter`. Selector fasad = allowlist regex pola `hq_kit2.py:158-161` (`REPLACED_NAME_RE`): `^wall_f\d+_(n|s|w|e)` (termasuk varian `_\d+`/`_fill_\d+`), `^window_f\d+_`, `^column_f\d+`, `^door_f\d+_(n|s|w|e)$` (pintu perimeter SAJA, di-anchor — `door_f1_meeting` adalah pintu interior ruang meeting `hq_kit2.py:181` dan TIDAK boleh match; review round-3); DITAMBAH assertion pengecualian: nama mengandung `meeting`, `stair`, `core`, `tile`, `TASK_`, `NAV_`, `COL_`, `ROOM_` TIDAK boleh masuk shell; assertion positif: `door_f1_meeting` ADA di floor_1, TIDAK di shell.
  Preflight environment (review round-2, Blender 5.0.1 host ini tanpa numpy di sys.path-nya → exporter gagal `import numpy`): `blender -b --factory-startup --python-use-system-env --python-expr "import numpy"` EXIT=0; command export WAJIB env `PYTHONPATH=/home/programer/.local/lib/python3.14/site-packages` + flag `--python-use-system-env` (PYTHONPATH saja diabaikan Blender). Catat syarat ini di HANDOFF regen (todo 13).
  (b) `floor_N_src.glb` (N=1..4) = SEMUA objek koleksi `FLOOR_N` MINUS objek fasad yang sudah di shell (ownership: `slab_*` lantai itu → floor file; `roof_top`+`SIGN_redhunter` → shell DAN di-exclude eksplisit dari floor_4 — cegah duplikat/z-fight, review round-3; `stair_*` → floor). `COL_*` diekspor sebagai node biasa (invisibility di web), `NAV_*`/`TASK_*`/`ROOM_*` sebagai node/empty.
  (c) `char_base_src.glb` = `CHAR_BASE` (armature) + `CHAR_BASE_mesh`; sebelum export: HAPUS action lain — `for a in list(bpy.data.actions): if a.name != 'idle': bpy.data.actions.remove(a)` (export_animation_mode='ACTIONS' mengumpulkan SEMUA action — "abaikan baselayer" bukan operasi, review round-2), SET `CHAR_BASE.animation_data.action = bpy.data.actions['idle']`, `export_animation_mode='ACTIONS'`, `export_skins=True`; TANPA decimate. Assert GLB berisi TEPAT 1 animation bernama `idle`.
  Transform apply: HANYA objek dengan `obj.data.users == 1` (mesh single-user). Objek ber-mesh-shared (link_duplicate, `hq_lib.py:343` — 1048 tile, 138 wall share mesh) DILARANG di-apply — dilewati + dilog; skala objek tetap hidup di node transform (glTF menangani via node scale). Self-check tambahan: untuk SETIAP mesh, bounding box world-space sebelum vs sesudah seluruh proses identik toleransi 1e-4.
  Exclusion list WAJIB (HANDOFF.md:115): `FLOOR_1_KIT_TEST`+`KIT_TEST_CEILING`, `VERDICT_STAGE`, `KIT_BPY`, `KIT_MESHY`, `KIT_MESHY_V2`, `CAMERAS`, `LIGHTING`, `glTF_not_exported`, `CHAR_BASE_stage`.
  Self-check `--check` (expected counts DIHITUNG DARI .blend, bukan hardcode): untuk tiap output — hitung objek per prefix §6 dalam selektor (query koleksi .blend langsung), lalu assert jumlah node GLB (parse JSON chunk GLB via stdlib) sama; khusus floor_1 assert keberadaan `NAV_spawn_lobby`, `TASK_board`, `TASK_desk_1..8`, `ROOM_lobby`; shell assert `roof_top` ada, nol node prefix `TASK_/NAV_/COL_/ROOM_` dan nol nama ber-`meeting|stair`; char assert 1 animation bernama `idle`; footprint assert DI BLENDER pre-export (Z-up, sumbu X×Y ≈ 20×14 m). Negatif hook: flag `--inject-missing-exclusions` yang sengaja menyertakan `VERDICT_STAGE` → self-check HARUS gagal (EXIT≠0), pola `--inject-bad-col` MVP-2.
  Catat juga: jumlah mesh datablock unik vs jumlah node per GLB (bukti mesh-sharing exporter — dasar `instance` di todo 2).
  Must NOT: decimate; save .blend; apply transform pada multi-user mesh; sentuh apps/web.
  Closes: GAP-1 (parsial), GAP-2, GAP-3 (parsial)
  Parallelization: Wave 1 | Blocked by: — | Blocks: 2, 3
  References: `apps/assets/blender/build_hq.py:34-74`; `apps/assets/blender/hq_lib.py` (get_collection, count_tris, make_empty, link_duplicate:343, self-check registry); `apps/assets/blender/hq_kit2.py:158-161` (REPLACED_NAME_RE); `apps/assets/blender/hq_floor1.py:197-257` (nama wall interior meeting/stair — jangan masuk shell); `apps/assets/blender/hq_massing.py:125-158` (roof_top, SIGN di FLOOR_4, slab per lantai); `apps/assets/blender/import_character.py:168` (action rig); HANDOFF.md:88-116; guide §6 §7.5.
  Acceptance criteria (agent-executable): command EXIT=0; 6 GLB di staging; log self-check per file PASS (prefix counts match .blend-derived expectations); char GLB berisi tepat 1 animation `idle`; negative hook EXIT≠0.
  QA scenarios (tool: blender headless + GLB JSON parse): happy = full command EXIT 0, evidence `.omo/evidence/mvp3-integration/task-1-export-happy.txt` (log lengkap); failure = `--inject-missing-exclusions` gagal self-check, evidence `task-1-export-failure.txt`.
  Commit: N
  Recommended task executor category: deep-low — scripting bpy multi-export + konstraint exclusion; pola ada di repo.

- [x] 2. Pipeline optimasi gltf-transform (meshopt + KTX2 + instance, geometri utuh)
  What to do / Must NOT do: Root devDep: `bun add -d @gltf-transform/cli`. PREFLIGHT wajib: `ktx --version` (KTX-Software ≥4.4) exit 0 — bila tidak ada: coba pasang (release resmi KTX-Software GitHub, atau package manager sistem); bila tetap gagal → JANGAN lanjut diam-diam: lanjutkan varian `meshopt`-saja (PNG tekstur utuh), catat deviasi, tampilkan sebagai pilihan di checkpoint 3 (user memutuskan pasang nanti vs terima PNG besar).
  Buat `apps/assets/scripts/optimize-hq.sh` (baru; JANGAN sentuh `optimize.sh` lama). Per GLB non-char, urutan (perintah gltf-transform CLI, nama persis):
  1. `dedup in tmp1.glb`
  2. `instance tmp1 tmp2.glb --min 9` HANYA untuk `floor_1..4` (bukan shell — batch instancing menghapus nama node `wall_f{N}_`/`window_f{N}_` yang dipakai cutaway & meratakan `COL_desk_*` bila grup 8 desk terbatch, review round-2; `--min 9` menjaga grup ≤8 (8 desk) tetap named node, tile 1048/wall 138/window 134/pillar 36 tetap terbatch)
  3. `meshopt tmp2 tmp3.glb`
  4. `uastc tmp3 tmp4.glb --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" --level 2 --rdo` (nama slot = edge name glTF — `occlusionRoughnessMetalnessTexture` TIDAK ada, review round-2; bila file punya slot itu; skip+log bila tanpa tekstur)
  5. `etc1s tmp4 out.glb --quality 255` (slot warna tersisa)
  Shell pipeline: `dedup` → `meshopt` → `uastc`+`etc1s` (TANPA `instance`).
  TANPA `prune` (menghapus empty NAV_/TASK_ — Oracle B1); TANPA `weld`; TANPA simplify/apapun yang ubah geometri.
  char_base: `dedup` → `meshopt` → `uastc`+`etc1s` TANPA `instance` (jaga skinning), tanpa resize (tekstur char ≤2048²).
  Cap tekstur 2048² (keputusan tervalidasi §7.5; veto di checkpoint 3): sebelum langkah 4, `gltf-transform inspect` → bila max texture size >2048 (kit 4096), tambahkan `--resize 2048` pada `uastc` dan `etc1s` untuk file itu; ≤2048 → tanpa resize.
  Output final → `apps/web/public/models/{hq_shell,floor_1..4,char_base}.glb`.
  Copy transcoder: resolve path three web via `import.meta.resolve('three')` + dirname (JANGAN `'three/package.json'` — export map three tidak expose itu, throw ERR_PACKAGE_PATH_NOT_EXPORTED, review round-2) ATAU `bun pm ls three`; fallback literal `node_modules/.bun/three@0.186.1*/node_modules/three/examples/jsm/libs/basis/basis_transcoder.{js,wasm}` → copy ke `apps/web/public/basis/`.
  Post-verify per file (`inspect`, parse JSON): `KHR_texture_basisu` + `EXT_meshopt_compression` terdaftar; `EXT_mesh_gpu_instancing` terdaftar DAN instance count >0 hanya untuk floor_1..4 (shell TIDAK di-instance — lihat atas); prefix node counts IDENTIK dengan staging todo 1 — expected PER FILE dihitung dari .blend via selektor todo 1 (AGREGAT lintas file untuk cross-check: NAV 7, TASK 9, ROOM 3, COL 23 — bukan 8/10/4/26; objek `*_kit` hidup di `FLOOR_1_KIT_TEST` yang di-exclude, `hq_kit_room.py:214-257`); total tris ≥ baseline −0,1% (baseline per file dari todo 1); char tris 19.499 ±1%; max texture size ≤2048². Semua masuk tabel.
  Must NOT: weld/prune/simplify/decimate; resize di bawah 2048; draco; dep runtime web; sentuh optimize.sh lama.
  Closes: GAP-1, GAP-2, GAP-3 (parsial), IS-2 (mekanisme)
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 3, 6, 7, 8, 9
  References: HANDOFF.md:96-113 (instance counts, 4096 kit textures, polycount baseline 231.732/251k/19.499); guide §7.5 (≤2048², meshopt, instancing), §4 (cap tekstur); catatan review round-1 (nama subcommand `instance`; `ktx` binary; sharp BUKAN encoder Basis — hanya pra-pemrosesan; jangan klaim sharp).
  Acceptance criteria (agent-executable): 6 GLB final ada; inspect assertions di atas semua PASS (termasuk prefix counts & tris preservation); `apps/web/public/basis/basis_transcoder.wasm` ada; `ktx --version` tereksekusi atau deviasi tercatat.
  QA scenarios (tool: gltf-transform inspect + jq/parse): happy = semua assertion PASS, tabel before/after ukuran, evidence `task-2-optimize-happy.txt`; failure = file tanpa tekstur (shell sebagian polos) → langkah 4-5 skip+log tanpa crash EXIT 0, evidence `task-2-optimize-failure.txt`.
  Commit: N
  Recommended task executor category: unspecified-low — chaining CLI dengan assertion mekanis.

- [x] 3. Tabel verifikasi per GLB + ⏸ CHECKPOINT 3
  What to do / Must NOT do: Susun `.omo/evidence/mvp3-integration/task-3-glb-table.md` — per GLB final (6): ukuran MB; total tris (+delta vs baseline); JUMLAH DRAW CALL ESTIMASI dengan formula EKSPLISIT = jumlah pasangan (mesh,material) unik pada primitives + 1 per instanced mesh (dari inspect: mesh count & instanceEXT count — tulis formula di tabel agar reproducible); prefix node counts (COL/NAV/TASK/ROOM/CHAR); max texture size; instance count. Baris shell DIBERI budget verdict eksplisit (tris ~560k perimeter pasca-instance = info; bila user anggap berat → opsi: pisahkan fasad per lantai ke floor_N.glb, TIDAK decimate). Jalankan helper `nodes.ts` (todo 5) via script bun kecil atas GLB `floor_1.glb` nyata: assert `COL_` count >0, `NAV_spawn_lobby` ketemu, `TASK_` = 8+board — bukti IS-8 di file asli, bukan dummy.
  ⏸ CHECKPOINT 3: presentasikan tabel + keputusan veto (cap tekstur 2048 vs keep 4096; shell berat vs split fasad; fallback PNG bila ktx gagal) → tunggu approve user → tulis `CHECKPOINT-3-APPROVED.md` berisi tabel + kutipan verbatim balasan user + timestamp. TIDAK ADA todo 6/7/8 sebelum file itu ada. Tidak ada decimate otomatis.
  Must NOT: mulai Wave 3 tanpa artefak approval; decimate tanpa izin tertulis user.
  Closes: GAP-2, GAP-4 (verifikasi GLB nyata), GAP-6 (parsial)
  Parallelization: Wave 2 | Blocked by: 2, 5 | Blocks: 6, 7, 8, 9
  References: HANDOFF.md:114 (baseline tris), HANDOFF.md:91-104 (prefix counts), guide §7.5, hasil todo 1-2.
  Acceptance criteria (agent-executable): tabel ada, 6 baris lengkap dengan formula draw-call tercantum; verifikasi nodes.ts di GLB nyata PASS; `CHECKPOINT-3-APPROVED.md` tercipta hanya setelah balasan user (worker berhenti menunggu — ini satu-satunya gerbang manusia bersama checkpoint 11).
  QA scenarios: happy = tabel + approved file, evidence `task-3-glb-table.md` + `CHECKPOINT-3-APPROVED.md`; failure = prefix mismatch apapun ditandai di tabel sebagai BLOCK sebelum checkpoint dikirim, evidence sama.
  Commit: N
  Recommended task executor category: quick — tabel + inspect mekanis (approved file = user).
- [x] 4. `.gitignore` GLB besar + staging
  What to do / Must NOT do: Setelah ukuran diketahui: pola `.gitignore` untuk `apps/assets/models/export/` (staging, seluruhnya) dan file GLB final >10 MB di `apps/web/public/models/` (default keputusan user). File ≤10 MB tetap boleh tracked. Komentar regen: `export_hq.py` + `optimize-hq.sh`.
  Must NOT: gitignore file kecil; commit.
  Closes: GAP-2 (housekeeping)
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: —
  References: `.gitignore:16-18`.
  Acceptance criteria (agent-executable): `git check-ignore -v` match untuk file >10 MB & staging; tidak match file ≤10 MB.
  QA scenarios: happy/failure evidence `task-4-gitignore.txt`.
  Commit: N
  Recommended task executor category: quick

- [x] 5. Helper node by prefix `nodes.ts` (+ test)
  What to do / Must NOT do: `apps/web/src/components/office/nodes.ts`: `findNodesByPrefix(root, prefix)`, `findFirstByPrefix(root, prefix)`, `hideByPrefix(root, prefix): number`, `nodeWorldPosition(node): THREE.Vector3`. Named export, strict, no `any`. Test `nodes.test.ts` (bun test, pure THREE): scene dummy `COL_a/NAV_b/TASK_c` — happy: filter+hide counts benar, posisi world benar; failure: prefix tak ada → `[]`/0/undefined. Test ini menegak kontrak §6 dengan murah (catatan review: tambahan kecil, disengaja).
  Must NOT: navmesh/graph/registry.
  Closes: GAP-4, IS-8
  Parallelization: Wave 2 | Blocked by: 1 (mkdir evidence di todo 1) | Blocks: 3 (verifikasi GLB nyata), 6, 9
  References: guide §6; struktur folder office/.
  Acceptance criteria (agent-executable): `bun test apps/web/src/components/office/nodes.test.ts` EXIT=0.
  QA scenarios: evidence `task-5-nodes-test.txt`.
  Commit: N
  Recommended task executor category: quick

- [x] 6. Loader gedung per lantai + cutaway + dispose (refactor Building/Scene/OfficeCanvas)
  What to do / Must NOT do: Refactor `apps/web/src/components/office/`:
  (a) KTX2 wiring helper DI DALAM komponen (bukan module scope): `import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'` (teresolve dari apps/web via export map three `./addons/*`; types via @types/three. `three-stdlib` TIDAK bisa — transitive dep drei yang tak ter-hoist ke workspace, review round-2). Buat `useHqGltf(url)`: `useGLTF(url, false /*useDraco*/, true /*meshopt*/, (loader) => { loader.setKTX2Loader(ktx2LoaderRef.current) })` — instance KTX2Loader dibuat SEKALI dalam komponen via `useMemo`/ref dengan `useThree(gl)`: `useMemo(() => new KTX2Loader().setTranscoderPath('/basis/').detectSupport(gl), [gl])`. Tanpa ini GLTFLoader throw `setKTX2Loader must be called before loading KTX2 textures`.
  (b) `HqShell({ activeFloor })` — load `hq_shell.glb` via useHqGltf; render `<primitive>` TANPA override material; CUTAWAY: `useEffect` → `findNodesByPrefix(scene, 'wall_f'+activeFloor+'_')` + `'window_f'+activeFloor+'_'` → `visible=false` (ulang tiap ganti activeFloor; restore lainnya visible). Log count console.debug. (Pintu fasad `door_f{N}_{s|w}` ikut disembunyikan — prefix `'door_f'+activeFloor+'_'`; `door_f1_meeting` hidup di floor_1.glb bukan shell, tak terdampak. `column_f{N}` dibiarkan terlihat, kolom struktural.)
  (c) `FloorModel({ n })` — load `floor_${n}.glb`; mount kondisional per lantai dalam `<Suspense>`; `useEffect` mount: `hideByPrefix(scene,'COL_')`; UNMOUNT cleanup: traverse dispose `geometry.dispose()`, material (array-aware) `dispose()` + semua properti `isTexture` di-dispose, BARU KEMUDIAN `useGLTF.clear(url)` (clear saja TIDAK bebaskan GPU — review round-1). Kunjung ulang lantai = re-fetch diperbolehkan (kebijakan: memory dibebaskan > hemat bandwith lokal).
  (d) `OfficeCanvas.tsx`: default `useState<FloorId>(1)`; `constants.ts` `FLOOR_HEIGHT = 3.2` (satu sumber — hapus ide konstanta ganda; `deskLayout.floorCenter` ikut nilai baru); kamera awal `[14, 12, 18]` (rasional: frame shell+lobby — dievaluasi ulang di checkpoint 11). Preload: DI DALAM komponen (useEffect), `useGLTF.preload('/models/hq_shell.glb', false, true, extLoader)` + floor_1 — JANGAN module scope (preload tanpa extendLoader + draco default → throw pada GLB KTX2; review round-1).
  (e) `Scene.tsx`: props `currentFloor`; render `<HqShell activeFloor={currentFloor}/>` + `{<Suspense><FloorModel n={currentFloor}/></Suspense>}`; hapus `FloorPlane` loop & `Building` lama; hapus const `BUILDING_MODEL_URL` (grep dulu 0 referensi lain).
  Must NOT: preload semua lantai; ubah UI FloorSelector; preload module-scope; override material GLB.
  Closes: GAP-1, GAP-5 (parsial), IS-1, IS-4, IS-5
  Parallelization: Wave 3 | Blocked by: CHECKPOINT-3-APPROVED, 5 | Blocks: 9, 10, 11
  References: `Building.tsx:5-10`, `OfficeCanvas.tsx:19,30-33`, `Scene.tsx:31-54`, `deskLayout.ts:13-19`, `constants.ts:3`; drei `core/Gltf.js:9-26` (signature & KTX2 gap); three-stdlib GLTFLoader (throw setKTX2Loader); `nodes.ts` (todo 5); guide §6 §7.5 cutaway.
  Acceptance criteria (agent-executable): e2e (todo 11 memformalkan; pra-cek di sini via dev + curl): GET `/models/hq_shell.glb` & `/models/floor_1.glb` 200; console browser TIDAK mengandung `setKTX2Loader must be called`; request `floor_2.glb` tidak terjadi sampai klik F2; `floor_3/4.glb` tidak diminta pada load awal & saat switch F1→F2.
  QA scenarios (tool: playwright dev-run scratch): happy = daftar network request sesuai (assertion `page.on('request')` filter URL), evidence `task-6-loader-network.txt`; failure = cutaway dimatikan sementara via query param dev `?nocut=1` (dibaca `OfficeCanvas` di luar Canvas via `new URLSearchParams(window.location.search)` lalu di-pass props ke `HqShell`) → screenshot diff menunjukkan perbedaan (interior tersembunyi) — bukti cutaway hidup, evidence `task-6-cutaway-diff.png`.
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 7. Lighting §4.1 fase siang
  What to do / Must NOT do: Rewrite `Lighting.tsx`: `<hemisphereLight intensity ~1.0 skyColor #BFE3F7 groundColor #E3F4FC>` (guide §4.1: sky/ground = gradient langit siang atas/bawah — BUKAN palet lantai; review round-1) + `<directionalLight color #FFFFFF intensity 1.4 position [12,22,8] castShadow shadow-mapSize [2048,2048] shadow-bias -0.0005 shadow-camera-{left,right,top,bottom} ±18 shadow-camera-far 60>`. Hapus `ambientLight`. Biarkan Canvas `shadows` + ACES (OfficeCanvas) & warning pre-existing PCFSoft→PCF fallback (catat).
  Must NOT: day-night; AO; HDR env; ubah tone mapping.
  Closes: IS-2 (parsial), GAP-1
  Parallelization: Wave 3 | Blocked by: CHECKPOINT-3-APPROVED | Blocks: 11
  References: guide §4.1; `Lighting.tsx:1-20`; `OfficeCanvas.tsx:40-49`.
  Acceptance criteria (agent-executable): grep nilai di file == spec (hemisphere #BFE3F7/#E3F4FC, directional #FFFFFF 1.4, mapSize 2048, bias -0.0005); render dev tanpa console error baru. (Kesan visual shadow = bagian screenshot checkpoint 11, bukan AC subjektif.)
  QA scenarios: evidence `task-7-lighting.txt` (grep output + console log).
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 8. Cleanup komponen prosedural lama
  What to do / Must NOT do: `Scene.tsx`: hapus render `FloorPlane`, `DeskMarkers`, loop `Agent`, DAN fungsi `handleAgentClick` + import yang jadi tak terpakai (`AGENT_DEFINITIONS`, `findAgentDesk`, `deskToWorld`, `FocusContext` bila tak dipakai lagi) — biome unused-import memprotes di todo 12 (review round-2). Grep sebelum hapus file: `FloorPlane|DeskMarkers|from './Agent'` → 0 referensi lain → hapus `FloorPlane.tsx`, `DeskMarkers.tsx`, `Agent.tsx`. `deskLayout.ts` DIPERTAHANKAN (floorCenter dipakai). `constants.ts`: `DEFAULT_STATUSES`/`AgentStatuses` tetap (props OfficeCanvas tidak berubah). JANGAN hapus `character.glb`/`building.glb` lama di sini — serahkan ke todo 11 (setelah spec hijau).
  Must NOT: ubah `OfficeCanvasProps`; hapus `focusContext`/`CameraRig`/`WebGLErrorBoundary`.
  Closes: GAP-1
  Parallelization: Wave 3 | Blocked by: 6 | Blocks: 11
  References: `Scene.tsx:31-54`, file terkait, HANDOFF MVP-1 peta office/.
  Acceptance criteria (agent-executable): grep 0 hasil; typecheck jalan (formal di todo 12).
  QA scenarios: evidence `task-8-cleanup.txt`.
  Commit: N
  Recommended task executor category: quick

- [x] 9. Karakter CHAR_BASE idle di lobby
  What to do / Must NOT do: `apps/web/src/components/office/CharAgent.tsx`: `useHqGltf('/models/char_base.glb')`; `useAnimations(animations, group)`; play clip `idle` (bila nama beda — fallback clip[0], catat nama aktual ke evidence). Render `<primitive>` dalam `<group position={spawnPos}>`; `spawnPos = nodeWorldPosition(findFirstByPrefix(floor1Scene, 'NAV_spawn_lobby'))` — CharAgent dirender DI DALAM `FloorModel` n=1 (scene floor_1 sudah termuat di tree induk; akses via props dari FloorModel yang mem-pass referensi scene-nya sendiri). castShadow. Skala 1:1 (HANDOFF: 1.70 m; bila tampak salah vs tile 1 m → catat di evidence, JANGAN auto-fix).
  Acceptance otomatis: (1) posisi: expose debug global `window.__hqChar = { x, y, z }` (update di useFrame CharAgent; `declare global { interface Window { __hqChar?: { x: number; y: number; z: number } } }` di file CharAgent.tsx — pola sama seperti `__hqStats` todo 10, tanpa ini typecheck gagal, review round-3) → evaluate — |pos − NAV_spawn_lobby worldPos| < 0.5 m; (2) animasi hidup: 2 screenshot 600 ms apart, region karakter (bounding box proyeksi) berbeda pixel >0; (3) console bersih.
  Must NOT: decimate; import walk/run; clone multi; bone manip.
  Closes: GAP-3, IS-3
  Parallelization: Wave 3 | Blocked by: 6, 5 | Blocks: 10, 11
  References: HANDOFF.md:85 (CHAR_BASE, idle 96 frame, 1.70 m), HANDOFF.md:98 (NAV_spawn_lobby), drei useAnimations, nodes.ts.
  Acceptance criteria (agent-executable): 3 assertion atas → PASS via playwright scratch run.
  QA scenarios: happy = `task-9-char-happy/` (2 PNG + posisi log); failure = clip `idle` absen → fallback index-0 tetap hidup & dicatat, evidence `task-9-char-fallback.txt`.
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 10. renderer.info + FPS per lantai
  What to do / Must NOT do: Komponen `PerfProbe` dalam Canvas: useFrame kumpul per detik — `gl.info.render.calls`, `gl.info.render.triangles` (sampel max per frame dalam jendela 1 s), FPS (frame count / detik); tulis `window.__hqStats = { floorId, calls, triangles, fps }`. TS strict: `declare global { interface Window { __hqStats?: ... } }` di file itu (tanpa ini typecheck gagal — review round-1). Playwright: per lantai (klik F1..F4, tunggu 3 s) baca `window.__hqStats` → tabel `task-10-stats-per-floor.md`. Angka = info; TIDAK memicu decimate; rekomendasi ditulis bila berat.
  Must NOT: dep stats; jadikan target pangkas.
  Closes: GAP-6, IS-6
  Parallelization: Wave 4 | Blocked by: 9 | Blocks: 11
  References: guide §7.5; `OfficeCanvas.tsx:47-49`; R3F useFrame.
  Acceptance criteria (agent-executable): tabel 4 lantai lengkap; calls/triangles >0 tiap lantai.
  QA scenarios: evidence `task-10-stats-per-floor.md`.
  Commit: N
  Recommended task executor category: unspecified-low

- [x] 11. E2E gate update + baseline regen + ⏸ CHECKPOINT 11
  What to do / Must NOT do: PRECONDITION: pastikan 6 GLB final ada (regen via todo 1+2 bila hilang — GLB >10MB di-gitignore). Update `apps/web/e2e/dashboard-office.e2e.ts`: EVIDENCE_DIR → `.omo/evidence/mvp3-integration`; HAPUS konstanta `AGENT_TITLE_ANCHOR` + assertion `getByText(AGENT_TITLE_ANCHOR)` (sumber `Agent.tsx` dihapus todo 8 — review round-2); dua `waitForResponse` (`hq_shell.glb`, `floor_1.glb`) DIBUAT SEBELUM `page.goto` (respons bisa selesai sebelum wait dibuat — review round-1); anchor baru = `getByText('F1 · Lobby & Server Room')` (SUBSTRING dari label asli `FloorSelector.tsx:46` + `office-layout.ts` — jangan `exact: true`); step lazy-load: `page.on('request')` collector → klik F2 (waitForResponse floor_2 DIBUAT sebelum klik) → assert floor_2 fetched, `floor_3.glb`/`floor_4.glb` TIDAK pernah diminta; round-trip F2→F1: waitForResponse floor_1 DIBUAT sebelum klik (re-fetch ekspektasi: 200 — kebijakan dispose-on-unmount); baca `window.__hqStats` → evidence. Bila flaky karena browser cache dev: gunakan request-event assertion `page.on('request')`, JANGAN `page.route cache:'no-store'` (bukan API Playwright, review round-2) dan jangan melebarkan timeout. Regen baseline: `(cd apps/web && rm -rf .next/dev && bunx playwright test e2e/dashboard-office.e2e.ts --update-snapshots --output ../../.omo/evidence/mvp3-integration/pw-output)` → run normal 2× pass → PW_NEG invert menggigit → catat md5 baru. Hapus `building.glb`+`character.glb` lama SETELAH hijau (grep 0 referensi).
  ⏸ CHECKPOINT 11: presentasikan screenshot browser vs `apps/assets/blender/renders/hq_v04_kit2_iso.png` + `hq_v04_kit2_lobby.png` (jelaskan delta wajar EEVEE vs WebGL) + tabel todo 10 → approve user → `CHECKPOINT-11-APPROVED.md` (kutipan verbatim + timestamp). Todo 12/13 menunggu file itu.
  Must NOT: longgarkan `maxDiffPixelRatio`; hapus PW_NEG; regen baseline tanpa catatan md5.
  Closes: GAP-5, buti IS-1..4, GAP-6 (gabung)
  Parallelization: Wave 4 | Blocked by: 6,7,8,9,10 | Blocks: 12, 13
  References: `apps/web/e2e/dashboard-office.e2e.ts:8,21-28,43-49,62,73-78`; `apps/web/src/components/office/FloorSelector.tsx:46`; HANDOFF MVP-1:42-46 (pola command + md5 catat), :49 (regen eksplisit wajib).
  Acceptance criteria (agent-executable): spec pass 2×; PW_NEG gagal di toHaveScreenshot; md5 baru tercatat; `git status` bersih dari GLB lama; `CHECKPOINT-11-APPROVED.md` ada (setelah balasan user).
  QA scenarios: happy = `task-11-e2e-pass.txt` + snapshot; failure = `task-11-e2e-negative.txt` (PW_NEG).
  Commit: N
  Recommended task executor category: unspecified-high — e2e multi-wait, ordering sensitif, baseline regen, checkpoint.
- [x] 12. Typecheck + lint
  What to do / Must NOT do: `(cd apps/web && bun run typecheck)` EXIT=0 (termasuk `declare global` __hqStats, nodes.ts, semua refactor). `biome lint` file disentuh: 0 error baru; 5 pre-existing MVP-1 (HANDOFF MVP-1:53) + 4071 repo-wide format = dicatat terpisah, tidak diperbaiki. Root typecheck pre-existing apps/api (HANDOFF MVP-1:58) tidak terkait — biarkan.
  Must NOT: `biome format --write` repo-wide; perbaiki pre-existing.
  Closes: IS-7
  Parallelization: Wave 4 | Blocked by: CHECKPOINT-11-APPROVED | Blocks: 13
  References: HANDOFF MVP-1:53-58.
  Acceptance criteria (agent-executable): typecheck EXIT=0; diff diagnostik biome = hanya pre-existing identik.
  QA scenarios: evidence `task-12-typecheck-lint.txt`.
  Commit: N
  Recommended task executor category: quick

- [x] 13. Handoff Report append `docs/mvp/HANDOFF.md`
  What to do / Must NOT do: Append `## MVP-3 — Export & Integrasi Web (tanggal)`: Selesai per fase; Output untuk MVP-4/5: command regen lengkap (export_hq.py + optimize-hq.sh + prerequisite `ktx`/KTX-Software), tabel per GLB (ukuran/tris/draw calls/FPS per lantai/max texture), nama helper `nodes.ts` + signature + hasil verifikasi GLB nyata, path transcoder `/basis/`, wiring KTX2 extendLoader (import `three/addons/loaders/KTX2Loader.js` — penting, BUKAN three-stdlib), cutaway mekanisme `wall_f{n}_`/`window_f{n}_`/`door_f{n}_{s|w}`, kebijakan dispose+re-fetch, baseline md5 baru, assertion "tanpa Meshy spend" (tidak ada task Meshy baru pasca ledger MVP-2), keputusan cap 2048² + veto user. Keterbatasan: delta visual EEVEE vs WebGL, fallback clip name char (bila ada), warning pre-existing, GLB di-gitignore + cara regen.
  Must NOT: rewrite section lain; commit.
  Closes: GAP-7
  Parallelization: Wave 4 | Blocked by: 1-12 | Blocks: —
  References: `docs/mvp/HANDOFF.md` format; `docs/mvp/README.md`.
  Acceptance criteria (agent-executable): section ada di akhir file; grep `MVP-3` match; memuat 3 sub-bagian + tabel.
  QA scenarios: evidence `task-13-handoff.md`.
  Commit: N
  Recommended task executor category: writing

- [x] 14. Floor-load failure isolation (F3 S8 shortfall)
  What to do / Must NOT do: `OfficeCanvas.tsx` membungkus `FloorSelector` + `Canvas` dalam SATU `WebGLErrorBoundary`; kegagalan fetch `floor_N.glb` (net::ERR_FAILED) melempar ke boundary → seluruh canvas + selector diganti pesan "WebGL not available" yang salah/menyesatkan, selector hilang, tak bisa pulih tanpa reload. Perbaiki: `FloorSelector` DI LUAR boundary kegagalan-model; boundary khusus model-load membungkus `Canvas` (atau `FloorModel`), menampilkan pesan akurat ("Gagal memuat model lantai N" + tombol coba lagi) dan reset otomatis saat user memilih lantai lain. `WebGLErrorBoundary` asli tetap untuk kegagalan WebGL sungguhan. Layout/posisi selector + canvas tidak boleh berubah (baseline screenshot md5 `4816ac7234930a6aea5e65856c2e759e` harus tetap lulus tanpa regen). Tambah test e2e ke-3 di `apps/web/e2e/dashboard-office.e2e.ts` (tanpa screenshot): `page.route('**/models/floor_3.glb', abort)` → klik F3 → assert pesan error akurat + tombol selector F1/F2 masih ada → klik F1 → canvas pulih (canvas count 1, `__hqStats.floorId===1`). RED dulu (test gagal pada kode sekarang), lalu GREEN.
  Must NOT: longgarkan `maxDiffPixelRatio`; regen baseline; ubah GLB; commit; menyentuh file di luar `apps/web/src/components/office/` + spec e2e.
  Closes: F3 S8 (ketahanan error), IS-1 (lazy-load per lantai tidak boleh rapuh).
  Parallelization: Wave 5 (post-final-wave fix) | Blocked by: — | Blocks: F1-F4 re-run
  Acceptance criteria (agent-executable): test e2e baru RED sebelum fix dan GREEN sesudah; spec penuh `2 passed` → `3 passed`; baseline md5 tidak berubah; `bun run typecheck` EXIT=0; biome 0 error baru.
  QA scenarios: evidence `task-14-floor-failure.txt` (RED + GREEN log), `task-14-floor-failure-*.png`.
  Commit: N
  Recommended task executor category: visual-engineering

- [x] 15. Koreksi tabel stats per lantai (F3 S4 temuan)
  What to do / Must NOT do: F3 final-wave membuktikan baris task-10 salah/stale (baris "F3" 296/380.033 sebenarnya sampel lantai 2; spec probe juga sama). Ganti tabel `task-10-stats-per-floor.md`, tabel stats di `task-11-checkpoint/README.md` dan tabel/caveat di section MVP-3 `docs/mvp/HANDOFF.md` + `task-13-handoff.md` dengan data tervalidasi dari `.omo/evidence/mvp3-integration/final-wave/F3-manual-qa/results.json` (S1 F1=568/576.326 dengan karakter; S2 F2=296/380.033; S4 F3=305/388.681; F4=307/391.679; semua 2 sampel stabil setelah waitForResponse + settle). Hapus caveat "sampel spec = baris F3" ganti penjelasan akurat: baris lama stale; spec hanya assert >0 (tidak diubah).
  Must NOT: ubah angka selain dari results.json; ubah spec; commit; menyentuh bagian lain HANDOFF.
  Closes: IS-6, IS-4.
  Parallelization: Wave 5 | Blocked by: — | Blocks: F1-F4 re-run
  Acceptance criteria (agent-executable): 4 baris beda & cocok results.json; grep "296 / 380" hanya muncul sebagai F2; tidak ada sisa caveat usang; HANDOFF diff tetap hanya penambahan pada section MVP-3.
  QA scenarios: evidence `task-15-stats-correction.md` (before/after).
  Commit: N
  Recommended task executor category: writing

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Ideal-state fidelity

## Commit strategy
Tidak ada commit — prompt MVP-3: "Jangan commit git kecuali saya minta". Semua di working tree; user memutuskan sesudah laporan.

## Success criteria
> One row per IS row. The plan is complete only when every IS row has a delivering todo and a proving QA scenario; F4 checks the delivered behavior against these rows 1:1, and a shortfall becomes new `- [ ] N.` rows, never a note.
| IS | Delivering todo(s) | Proving QA scenario | Evidence |
| --- | --- | --- | --- |
| IS-1 | 1, 2, 6, 11 | e2e: shell+floor_1 dimuat, cutaway diff (`?nocut=1`), F2 lazy | `task-6-cutaway-diff.png`, `task-11-e2e-pass.txt` |
| IS-2 | 2, 7, 11 | inspect: tris ≥ baseline−0,1%, char 19.499±1%, texture ≤2048² + checkpoint visual user | `task-2-optimize-happy.txt`, `task-3-glb-table.md`, `CHECKPOINT-11-APPROVED.md` |
| IS-3 | 1, 2, 9 | posisi <0,5 m dari NAV_spawn_lobby + 2-frame diff animasi | `task-9-char-happy/` |
| IS-4 | 1, 2, 6, 10, 11 | e2e lazy (floor_3/4 tak diminta) + round-trip re-fetch 200 + stats per lantai | `task-11-e2e-pass.txt`, `task-10-stats-per-floor.md` |
| IS-5 | 1, 2, 3, 5, 6 | inspect prefix counts identik pasca-optimasi + hideByPrefix count logged | `task-2-optimize-happy.txt`, `task-6-loader-network.txt` |
| IS-6 | 10 | tabel stats 4 lantai | `task-10-stats-per-floor.md` |
| IS-7 | 12 | typecheck EXIT=0 + lint diff bersih | `task-12-typecheck-lint.txt` |
| IS-8 | 5, 3 | bun test nodes + verifikasi helper di floor_1.glb nyata | `task-5-nodes-test.txt`, `task-3-glb-table.md` |
