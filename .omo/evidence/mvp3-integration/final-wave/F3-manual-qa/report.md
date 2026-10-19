# F3 Manual QA — Round 2 (live Chromium + SwiftShader, 1280x800, Next dev :3100)

Round 1 -> Round 2: Round 1 REJECTED on S8 (floor load failure replaced the whole canvas AND selector with "WebGL not available", unrecoverable). Round 2: FloorLoadBoundary wraps only the Canvas; S8 and both variants PASS. S1-S7, S9 still PASS. Verdict: APPROVE.

Driver: /tmp/f3r2.mjs (not in repo). Raw data: results.json, console-log.json, network-log.json, s9-e2e.txt, pw-output/.

| # | Scenario | Steps | Expected | Observed | Result |
|---|---|---|---|---|---|
| S1 | Initial load | goto /dashboard, waitForResponse floor_1 set before goto | shell+floor_1 once 200, char_base loaded, floor_2/3/4 0, basis js+wasm 200, canvas non-blank, F1 label visible | hq_shell 1, floor_1 1, char_base 1, floor_2/3/4 = 0, basis_transcoder.js 2x200 + .wasm 2x200 (2 KTX2 loaders = accepted warning), 2112 unique colours (stride-7 sample; 23078 full), label visible, stats floor 1 568 calls / 576,326 tris, char (7,0,-6). S1 screenshot viewed: lobby facade cut away, desks/chairs/sofas/stairs, trees, black sky, selector over red sign (accepted caveats) | PASS |
| S2 | Click F2 | waitForResponse before click | floor_2 once; F3/F4 not requested; no console.error | floor_2 1x200, floor_3 0, floor_4 0; stats 296 / 380,033; no errors | PASS |
| S3 | F2 -> F1 | click F1 | floor_1 total 2, char ≈ (7,0,-6) | floor_1 2, char_base 2, char (7,0,-6) dist 0. S3 screenshot viewed (see S3 note) | PASS |
| S4 | Visit F3, F4 (INFO) | waitForResponse + 3 s settle, 2 samples 1.5 s apart | each once; stats | F3 fetched 1x: 305 / 388,681 (both samples identical); F4 fetched 1x: 307 / 391,679 (identical). Rechecks: F1 303 / 364,045; F2 296 / 380,033. All match expected values (0% diff, < 5%). Total floor fetches at end: F1 3 (extra re-click in recheck), F2 2, F3 1, F4 1 | PASS |
| S5 | cut vs nocut | canvas screenshots, python3 PIL+numpy | diff > 1% | canvas-only 7.56% (70,512 px), full page 6.89%. S5-nocut viewed: full facade, no interior; cut shows interior | PASS |
| S6 | Character | __hqChar, two shots 800 ms apart | within 0.5 m of (7,0,-6); diff > 0 px | (7,0,-6) dist 0; 142 px changed (0.014%) > 0 | PASS |
| S7 | Console hygiene S1-S6 | collect console/pageerror | 0 console.error, 0 pageerror | S1-S4, S5-cut, S5-nocut: 0 error, 0 pageerror; only accepted warnings (THREE.Clock deprecated, PCFSoftShadowMap removed, Multiple KTX2 loaders) | PASS |
| S8 | Failure path, fresh page, route abort floor_3.glb | click F3 | 'Gagal memuat model lantai' visible <60 s; 'WebGL not available' count 0; F1-F4 buttons visible | errVisible true; WebGL fallback count 0; buttons [true,true,true,true]; "Coba lagi" visible; canvas count 0 (boundary replaces canvas only); net floor_3 FAILED net::ERR_FAILED. S8-error.png viewed: dark navy panel fills the whole canvas area below the header; centred bold "Gagal memuat model lantai", small "Could not load /models/floor_3.glb: Failed to fetch", "Coba lagi" button (error text box ~251x27 px at x=515,y=382); selector stays at top-right (x=1074..1264, y=87..263), F3 highlighted orange-brown | PASS |
| S8 recover | click F1 | canvas 1, floorId 1, char (7,0,-6) within 60 s | ok true, canvas count 1, stats floorId 1 (303 / 364,045), char (7,0,-6) dist 0, error text gone. S8-recovered.png viewed: identical lobby scene to S1/S3 (0.57 diff vs S1 only because of the camera/frame state; same composition) | PASS |
| S8a | abort, F3 error, unroute, F2, then F3 | | floor_3 200, floorId 3, error gone | F2 loaded (floorId 2), floor_3.glb fetched 200 (net: FAILED then 200), floorId 3 (305 / 388,681), error text gone | PASS |
| S8b | abort, F3 error, unroute, click 'Coba lagi' | | floor_3 200, scene renders floorId 3 | floor_3.glb fetched 200, floorId 3 (305 / 388,681), canvas count 1, error text gone | PASS |
| S8c | non-model error reaching old WebGL boundary | | | not tested (cannot be triggered in browser) | n/a |
| S9 | Real spec (own server killed, :3100 free, .next/dev removed) | `bunx playwright test e2e/dashboard-office.e2e.ts` via nohup | 3 passed, EXIT=0, md5 unchanged | `3 passed (2.4m)`, EXIT=0; md5 before = after = 4816ac7234930a6aea5e65856c2e759e; no --update-snapshots | PASS |

Notes
- S8 console.error entries (net::ERR_FAILED, R3F error, `[FloorLoadBoundary] floor model failed to load`) and one pageerror occur only in the induced-failure pages; expected, not counted against S7.
- S3 screenshot viewed: same lobby view as S1 (sofas, desks, trees, building at right, selector F1 active).
- Accepted visual caveats observed: black sky, building cropped at right edge, selector overlapping red sign, small character, F2 furniture not visible from default camera.
- git status shows modified spec/snapshot files: pre-existing uncommitted state; snapshot md5 equals baseline.
- Own processes (dev server pids 256041/256043/256060) killed by PID; `lsof -i :3100 -sTCP:LISTEN` empty. Pid 12098 untouched.
