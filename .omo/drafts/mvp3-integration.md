---
slug: mvp3-integration
status: drafting
intent: clear
review_required: false
pending-action: write .omo/plans/mvp3-integration.md
approach: Export per lantai via export_hq.py headless (hq_shell.glb + floor_N.glb dari hq_v04.blend final), optimasi gltf-transform (meshopt + KTX2 ≤ 2048², no downscale, instancing), R3F loader per lantai di Building.tsx, helper node by prefix untuk MVP-4/5, char_base.glb di NAV_spawn_lobby dengan AnimationMixer idle.
---

# Draft: mvp3-integration

## Affected user and ideal state
<!-- Who this output touches (a customer, another programmer, a program or agent consuming it - often more than one) and how each uses it today and will use it after. -->
<!-- IS-n | property of the ideal state: nothing snags, feels odd, regresses, or degrades for them | reason -->
<!-- GAP-n | difference between IS-n and today | reason | closed by todo(s) -->

Affected users:
1. User (owner) — melihat dashboard web `bun run dev`: shell gedung + Floor 1 detail, agent idle di lobby, kualitas setara render MVP-2.
2. MVP-4/5 agent berikutnya — memakai output handoff: GLB per lantai + helper node by prefix (COL_/NAV_/TASK_).
3. Pengunjang dashboard — scene 3D termuat per lantai, tanpa jank fatal, console bersih.

| Row | Statement | Reason |
| --- | --- | --- |
| IS-1 | Dashboard menampilkan shell eksterior + Floor 1 detail (lazy-load per lantai via FloorSelector) | Goal demo MVP-3 |
| IS-2 | Kualitas visual setara render MVP-2 (hq_v04 kit2): tanpa decimate, tekstur tetap tajam | Keputusan #21, guide §7.5 |
| IS-3 | Satu agent karakter (CHAR_BASE rigged) idle beranimasi di NAV_spawn_lobby | Fase 3 prompt |
| IS-4 | Lantai lain (2–4) dapat dipilih, blockout termuat, lantai lain di-unload | Render per lantai §7.5 |
| IS-5 | Node COL_* tersembunyi di web; NAV_/TASK_ dipertahankan sebagai node untuk MVP-4/5 | Naming contract §6 |
| IS-6 | renderer.info (calls/triangles) + FPS per lantai dicatat sebagai info | §7.5 |
| IS-7 | typecheck + lint lulus (pre-existing dicatat terpisah) | Verifikasi wajib prompt |
| IS-8 | MVP-4/5 agent bisa resolve node by prefix dari GLB | Handoff helper |

| GAP | Difference | Closed by |
| --- | --- | --- |
| GAP-1 | Web masih pakai building.glb prosedural 12.4 KB + agent kapsul | F1 export + F2 R3F |
| GAP-2 | Tidak ada floor_N.glb per lantai | F1 export |
| GAP-3 | Tidak ada char_base.glb live di web | F3 |
| GAP-4 | Tidak ada helper node by prefix | F2 |
| GAP-5 | Baseline Playwright perlu regenerasi (tampilan berubah sah) | F2 |
| GAP-6 | Tidak ada angka renderer.info/FPS per lantai tercatat | F2/F3 |
| GAP-7 | HANDOFF.md belum ada laporan MVP-3 | Closing |

## Components (topology ledger)
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome | status | evidence |
| --- | --- | --- | --- |
| C1-export | export_hq.py headless menghasilkan hq_shell.glb + floor_1..4.glb + char_base.glb dari hq_v04.blend | active | apps/assets/blender/ (baru) |
| C2-optimize | gltf-transform meshopt+KTX2+instancing pada GLB (bukan decimate) | active | C1 output |
| C3-web | R3F loader per lantai + helper prefix + agent char + lighting §4.1 | active | apps/web/src/components/office/ |
| C4-verify | Playwright screenshot gate + renderer.info + typecheck/lint + HANDOFF append | active | .omo/evidence/ |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->

| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Meshy credits terpakai | 0 — char_base.glb final dari `apps/assets/raw/meshy/char_idle.glb` yang sudah diunduh MVP-2, hanya re-export Blender | MVP-2 sudah punya rig+idle; prompt bilang "export karakter Meshy (tanpa decimate)" = export, bukan generate baru | Ya |
| Char walk/run | Tidak di-import (out of scope MVP-3) | Prompt hanya minta idle | Ya |
| Day-night MVP-3 | Lighting statis fase siang §4.1 (HemisphereLight+DirectionalLight) | Guide §4.1 fase day-night = P1–P2; MVP-3 prompt hanya "Lighting sesuai §4.1" tanpa cycle; cycle ditunda MVP-4 | Ya |
| FloorPlane/DeskMarkers/agent prosedural lama | Diganti/dihapus bila bertabrakan visual; default: FloorPlane & DeskMarkers dihapus saat floor GLB live | GLB floor sudah berisi furniture+desks; duplikasi visual | Ya — minta user di gate |
| git | Tidak ada commit (prompt: kecuali diminta) | Aturan sesi | Ya |
| `*bpy` variants | hq_v04.blend final (meshy2) = sumber tunggal | HANDOFF: final approved | Ya |

## Findings (cited - path:lines)

- `apps/web/src/components/office/Building.tsx:5` — `BUILDING_MODEL_URL = '/models/building.glb'`; satu-satunya pemakaian URL model gedung.
- `apps/web/src/components/office/OfficeCanvas.tsx:19` — `currentFloor` state default 2; FloorSelector → `handleFloorSelect` set floor + focus.
- `apps/web/src/components/office/FloorSelector.tsx:25-49` — render tombol lantai dari OFFICE_LAYOUT; hook wiring ke loader baru di sini.
- `apps/web/src/components/office/Scene.tsx:31-54` — komposisi: Lighting, Building, FloorPlane x4, DeskMarkers, Agent x7, CameraRig.
- `apps/web/src/components/office/constants.ts:3` — `FLOOR_HEIGHT = 4` (bukan 3.2 m §4! prosedural lama). GLB baru punya skala meter nyata (slab 3.2 m + 0.2 offset?) — mapping floorId → tinggi harus dari data GLB/konstanta baru, bukan deskToWorld lama.
- `apps/web/src/components/office/deskLayout.ts:13-19` — posisi desk hash-based prosedural; tidak berlaku untuk GLB — agent placement harus pakai NAV_spawn_lobby/TASK_desk_n dari GLB.
- `apps/web/e2e/dashboard-office.e2e.ts:8,44` — EVIDENCE_DIR mvp-1-foundation; `waitForResponse /models/building.glb`; baseline snapshot `dashboard-office-linux.png` md5 a273b6d... (regen sah bila tampilan berubah, catat di HANDOFF).
- `apps/assets/scripts/optimize.sh:23-27` — optimize.sh lama: draco + webp + texture-size 1024 (downscale!) — TIDAK sesuai keputusan #21 (KTX2, no downscale ≤ 2048²). Perlu script/flag baru, jangan pakai yang ini.
- HANDOFF.md:89-116 — hq_v04.blend final (md5 edc83c...), build command, exclusion list export (FLOOR_1_KIT_TEST, VERDICT_STAGE, KIT_BPY/MESHY/V2, CAMERAS, LIGHTING, glTF_not_exported), kit v2 instance counts (wall 139+134+3+1048+36), char raw GLBs di apps/assets/raw/meshy/ (char_idle.glb 4.1 MB), >10MB files harus tetap di luar git.
- HANDOFF.md:91-104 — prefix dump: FLOOR_n collections, ROOM_ 4, COL_ 26, NAV_ 8, TASK_ 10, CHAR_ 3, KIT2_ 6.
- HANDOFF.md:115 — karakter export: CHAR_BASE + action idle; abaikan `Armature|clip0|baselayer`.
- guide §6, §7.5, §11 #21 — naming contract, render per lantai, no decimate.
- `.gitignore:17-18` — hq_v04.blend & kit_v2/*.glb di-gitignore (>10MB). GLB web hasil export bisa >10MB per lantai → perlu kebijakan (lihat open questions).
- `apps/web/package.json:13-32` — deps three 0.186.1, fiber 9.8.1, drei 10.7.9.
- **KRITIS — KTX2 wiring**: `node_modules/.bun/@react-three+drei@10.7.9+*/node_modules/@react-three/drei/core/Gltf.js:9-26` — drei `useGLTF(path, useDraco, useMeshopt, extendLoader)` men-set DRACO + **MeshoptDecoder** otomatis, tapi **TIDAK** men-set KTX2Loader. `three@0.186.1/examples/jsm/loaders/GLTFLoader.js:1479` throw `setKTX2Loader must be called before loading KTX2 textures`. KTX2 WAJIB di-wire via `extendLoader={(loader) => loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(...).detectSupport(gl))}`.
  Transcoder assets **ADA lokal**: `node_modules/.bun/three@0.186.1/node_modules/three/examples/jsm/libs/basis/{basis_transcoder.js,basis_transcoder.wasm}` + `ktx-parse.module.js`. Perlu di-copy ke `apps/web/public/basis/` (Next tidak serve node_modules) — atau pakai drei CDN default (`useKTX2` default `${cdn}/basis/`, butuh jaringan → gate Playwright offline-safe lebih baik copy lokal).
  Meshopt decoder tersedia di three `examples/jsm/libs/meshopt_decoder.module.js` (drei import dari `three-stdlib`, sudah bundled).
  Juga: drei `Ktx2.js:8` `useKTX2(input, basisPath = cdn/basis/)` — alternatif untuk texture langsung.
- `apps/web/public/models/` — hanya building.glb + character.glb lama.
- `hq_massing.py:125-158` — massing floors 2-4 = blockout; roof_top di FLOOR_4; EXTERIOR collection untuk taman/jalan.

## Decisions (with rationale)

1. Export via script headless baru `apps/assets/blender/export_hq.py` (bukan MCP live) — sesuai pola MVP-2, reproducible, no Blender GUI dependency.
2. hq_shell.glb = EXTERIOR + massing exterior semua lantai (dinding/window/columns/slab perimeter + roof) TANPA interior; floor_N.glb = isi koleksi FLOOR_n (interior blockout lantai 2-4, full lantai 1) minus COL_ render.
3. Optimasi: `gltf-transform` CLI (butuh install; repo belum punya dep ini — `apps/assets/scripts/optimize.sh:9-13` hanya cek `command -v gltf-transform` lalu skip bila tidak ada; script lama itu juga salah: draco+webp+1024 downscale, kontra #21). Butuh: `bun add -d @gltf-transform/cli` (root devDep) ATAU `bunx @gltf-transform/cli` (unduh on-demand; butuh jaringan/registry → jalankan sekali). Pipeline: `dedup` → `instancing` → `meshopt` (atau `weld` dulu) → `ktx2` (texture) → `resize`? NO downscale.
   Catatan instancing: kit2 di Blender = linked duplicates (mesh sama di-share) → gltf-transform `instancing` menggabungkan node ber-mesh-identik jadi EXT_mesh_gpu_instancing. Perlu verifikasi bahwa `instancing` command benar-benar emit extension ini (gltf-transform `instancing` memang menargetkan ini).
   KTX2 encoder butuh `sharp` (ADA: `node_modules/.bun/sharp@0.35.5`) — gltf-transform pakai sharp via `@gltf-transform/functions`. CLI saja.
4. KTX2Loader web-side: copy `basis_transcoder.{js,wasm}` + `ktx-parse.module.js` ke `apps/web/public/basis/`, wire via `extendLoader` (drei tidak otomatis). Meshopt otomatis dari drei.
4. COL_* invisible: set `hide_render` sudah ada di blend (self-check col hide render). glTF exporter tidak menulis hide_render flag — harus di-handle web-side (helper hide COL_* prefix) ATAU tandai via extras. Default: helper web-side hide (GLB tetap carry COL untuk collision MVP-4).
5. Helper file tunggal `apps/web/src/components/office/nodes.ts` — findNodesByPrefix(root, prefix) + COL hiding util.
6. Agent lama prosedural vs char baru: prompt bilang "tanya saya" — fork user.
7. Char di NAV_spawn_lobby: posisi dibaca dari node NAV_spawn_lobby di floor_1.glb.
8. Effort per lantai = cek renderer.info. Lantai 1 ~231k tris + shell. Lantai 2-4 ~251k each — hanya lantai aktif dimuat jadi aman.
9. E2E: regen baseline `--update-snapshots` + catat; assertion waitForResponse ganti `/models/hq_shell.glb` + `/models/floor_1.glb` (default floor 1? current default 2 — ganti default ke 1 supaya demo floor 1; FloorSelector tetap 4 tombol).

## Scope IN

- FASE 1: export_hq.py + gltf-transform optimize + tabel verifikasi per GLB → checkpoint user.
- FASE 2: Building.tsx loader per lantai, helper nodes.ts, Lighting §4.1, cleanup FloorPlane/DeskMarkers/inline material, ukur renderer.info+FPS, Playwright checkpoint.
- FASE 3: char_base.glb export + display idle di NAV_spawn_lobby + screenshot/console/FPS.
- Closing: typecheck, lint, HANDOFF.md append.

## Scope OUT (Must NOT have)

- Decimate karakter/furniture/scenery (keputusan #21).
- Redesign model (keputusan visual final MVP-2).
- Edit manual .blend (perubahan hanya via build_hq.py bila export rusak).
- Sentuh backend (apps/api, packages/*).
- Git commit/push (kecuali diminta).
- Meshy kredit baru (pakai aset raw MVP-2).
- Day-night cycle (MVP-4), FPV/collision interaktif (MVP-4), task board (MVP-5).
- Sloyd, furniture Meshy baru.

## Open questions

1. Agent prosedural lama (7 kapsul dari `Agent.tsx`) — diganti hanya char baru di lobby, atau semua 7 dihapus? (prompt: tanya saya)
2. GLB hasil export (floor_1..4 + shell, 4K KTX2) berpotensi >10MB → masuk git atau gitignore + regen? (`.gitignore:17-18` sudah ignore hq_v04.blend & kit_v2 raw)
3. Default lantai awal: 1 (demo lobby, sesuai DoD) vs 2 (existing `OfficeCanvas.tsx:19`)?
4. KTX2 wajib atau meshopt-only cukup? KTX2 menambah kompleksitas (copy basis transcoder + extendLoader) tapi 4K PBR PNG akan sangat besar tanpa itu. Default: keduanya (sesuai #21).

## Approval gate
status: approved (user: "okay approve langsung high review", 2026-10-18)
Fork resolution: 4 pertanyaan → default diambil user (skip = default): (1) hapus 7 kapsul, 1 char Meshy lobby; (2) GLB >10MB gitignore; (3) default floor 1; (4) meshopt+KTX2.

## Review state
review_required: true
plan_path: .omo/plans/mvp3-integration.md
review_round_id: rr-mvp3-2
plan_sha256: (computed by reviewer; planning env tanpa shell)
pending-action: review .omo/plans/mvp3-integration.md

### Round 1 (rr-mvp3-1) — CLOSED, CHANGES_REQUESTED
- momus: bg_cb475cc6, session ses_eb08a4a8cffeJtvcQS3gle3SHw. sha256 16c60d196d52b4106b48bcceb615d93a7269231562f24cc19d009c27176f12ad. VERDICT CHANGES_REQUESTED.
- independent (oracle): bg_c3aef4db, session ses_eb0855e75ffePmzc4A28LZeKNO. sha256 sama. VERDICT CHANGES_REQUESTED.
- metis (pre-review gap analysis, folded): bg_4318b754, session ses_eb08b1202ffeInqp0spRS3ayzE. 40 temuan.
- Convergence ledger round 1 ACCEPTED BLOCKERS (eligible, all fixed in round 2):
  M1 ktx2 command tidak ada / biner `ktx` absen (reproducible_broken_flow) -> todo 2 preflight + uastc/etc1s subcommand nyata.
  M2 transform_apply merusak linked-duplicate meshes (data loss) -> todo 1 single-user guard + bbox assert.
  M3 konflik cap tekstur 4096 vs <=2048 (explicit_requirement) -> todo 2 cap kondisional + veto checkpoint 3 + TL;DR decision 4.
  O1 prune menghapus empty NAV_/TASK_ (explicit_requirement) -> todo 2 TANPA prune.
  O2 KTX2Loader bukan di namespace three (reproducible_broken_flow) -> todo 6 import dari three-stdlib.
  O3 KTX2 step tidak eksekutabel (reproducible_broken_flow) -> sama M1.
  O4 useGLTF.clear tidak bebaskan GPU (explicit_requirement IS-4) -> todo 6 traverse dispose + clear.
  O5 selector shell wall_* menyedot partisi interior (reproducible_broken_flow) -> todo 1 allowlist regex + exclusion assert.
  Mt2 cutaway tidak diimplementasi (ideal_state_row_unreachable) -> todo 6(b) cutaway + IS-1 rewrite.
  Mt3 shell budget tak terukur (ideal_state_row_unreachable) -> todo 3 baris shell + verdict.
  Mt6-21 preload module-scope rusak -> todo 6(d) preload di dalam komponen.
  (juga: instance bukan instancing; weld dihapus; declare global __hqStats; anchor literal; per-floor COL enum; mkdir -p staging+evidence; action char eksplisit; approval-artifact gate.)
- NON-BLOCKING NOTES round 1: camera reposition rationale, nodes.test.ts sebagai tambahan, hardcoded .bun path (kini resolve via import.meta.resolve + fallback), hemisphere groundColor deviation (diperbaiki ke #E3F4FC), Playwright cache/no-store, shell slab open-frame.
- Fix summary: plan ditulis ulang penuh (v2). Semua blocker eligible di atas diterapkan; ledger beku mulai round 2.

### Round 2 (rr-mvp3-2) — CLOSED, CHANGES_REQUESTED (6 blocker baru, semua eligible: regresi fix + fakta lingkungan)
- momus: bg_bf6b1f08, session ses_eb0638289ffegT0z3ybPFo2mBu. sha256 82f60c45ed64b49b8b30b6c73fab483774c1f5b946a7711bf84c190c7f7ca498. Verdict CHANGES_REQUESTED. Ledger 12 item: 10 YES fixed, 2 fixed-via-broken-import (three-stdlib) / defeated-by-instance (cutaway).
- independent (oracle): bg_3baededd, session ses_eb0637f69ffeAn8ojDb1D3slPG. sha256 sama. Verdict CHANGES_REQUESTED.
- Convergence ledger round 2 ACCEPTED BLOCKERS (frozen):
  R1 three-stdlib tak teresolve dari apps/web (reproducible_broken_flow) -> import `three/addons/loaders/KTX2Loader.js` (export map ./addons/*; types @types/three).
  R2 `instance` menghapus nama node (batch unnamed) -> shell TANPA instance; floor instance `--min 9` (grup 8-desk COL tetap named); assertion instance count hanya floor_1..4.
  R3 slot `occlusionRoughnessMetalnessTexture` tidak ada (reproducible_broken_flow) -> `--slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}"`.
  R4 pintu perimeter absen dari shell allowlist (explicit_requirement) -> tambah `^door_f\d+`; cutaway sembunyikan door_f{N} juga.
  R5 Blender host tanpa numpy -> exporter gagal (reproducible_broken_flow env) -> preflight `--python-use-system-env --python-expr "import numpy"` + command export pakai PYTHONPATH=~/.local/... + flag.
  R6 export_animation_mode='ACTIONS' bawa clip baselayer (reproducible_broken_flow) -> hapus semua action != 'idle' dari bpy.data.actions pre-export; assert tepat 1 animasi.
  Counts fix: agregat NAV 7 / TASK 9 / ROOM 3 / COL 23 (objek *_kit di FLOOR_1_KIT_TEST ter-exclude) — per-file expected dari .blend.
- Non-blocking diterapkan juga: KTX >=4.4; page.route cache bukan API; import.meta.resolve('three'); AGENT_TITLE_ANCHOR dihapus dari spec; unused-import cleanup Scene.tsx; window.__hqChar debug global; ?nocut=1 read site di OfficeCanvas; mkdir race todo 5 depend 1.
- Fix summary: edit plan in-place (v3).

### Round 3 (rr-mvp3-3) — CLOSED, CHANGES_REQUESTED (3+1 blocker, convergen; semua regresi fix R2/R4)
- momus: bg_87f4cf8c, session ses_eb0410628ffe73DjnPVL0RsNhW. sha256 394354429c44c782d92f7a7139a4ffab614f5b9a4015d84a307e414072386a9b. Ledger R1-R6: 5 PASS + R4 partial (door regex over-broad).
- independent (oracle): bg_24aa96d0, session ses_eb04104edffemi5Igiwvs44sAG. sha256 sama. R1-R3/R5/R6 PASS, R4 FAIL (sama).
- Blocker (kedua lane temukan sama): `^door_f\d+` match `door_f1_meeting` (pintu interior, hq_kit2.py:181) → kontradiksi assertion "no meeting in shell" + floor_1 kehilangan pintu meeting. FIX: `^door_f\d+_(n|s|w|e)$` + assertion positif door_f1_meeting di floor_1 bukan shell + cutaway prefix door dijelaskan.
- Blocker momus 2: todo 13 masih "three-stdlib import" → FIX: `three/addons/loaders/KTX2Loader.js`.
- Blocker momus 3: window.__hqChar tanpa declare global → FIX: declare global di CharAgent.tsx.
- Non-blocking diterapkan: command export copy-paste kini bawa PYTHONPATH + --python-use-system-env; roof_top/SIGN di-exclude eksplisit dari floor_4; (note matrix L91 vs todo-5 line: todo-line yang mengikat).
- Fix summary: plan v4.

### Round 4 (rr-mvp3-4) — CLOSED, APPROVED (both lanes)
- momus: bg_e745754d, session ses_eb02e832dffe6jFflzaTTVMTiE (retry attempt 2, model 9router/cc/claude-fable-5; attempt 1 402 quota). sha256 58d4c70b40701c54961c108780ab55b18d9b3e7332495cb0eb93937d5363a713 (38240 bytes). VERDICT APPROVED. D1-D4 VERIFIED, 0 blocker, 3 notes.
- independent (oracle): bg_4c797c25, session ses_eb02e977cffeCs7yLEwQCFJEaV (retry attempt 2, same model fallback). sha256 identik 58d4c70b... VERDICT APPROVED (with notes). D1-D4 VERIFIED + repo cross-check (door_f1_s/w only perimeter; three export map ./addons/*; numpy path real). 0 blocker, 3 notes.
- Non-blocking notes (tidak diterapkan agar hash approved tetap valid; menjadi catatan implementasi): TL;DR line 19 masih bilang "round 2" (kosmetik); glob fallback transcoder jangan ambil three@0.170.0; cutaway door prefix unanchored di web aman via assertion positif D1 — layak 1 baris di HANDOFF.
- Convergence: 4 round / cap 5. Blocker ledger: R1 12 → R2 6 → R3 3(+1 overlap) → R4 0. Approval with notes = approval.

## Final state
status: plan-approved-reviewed
plan_path: .omo/plans/mvp3-integration.md
approved_plan_sha256: 58d4c70b40701c54961c108780ab55b18d9b3e7332495cb0eb93937d5363a713
plan bytes: 38240 (tidak diedit sejak round-4 read)
pending-action: handoff ke worker session (`/ulw-execute mvp3-integration`)
