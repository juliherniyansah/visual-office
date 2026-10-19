# F3 Manual QA — MVP-3 office 3D (live browser, SwiftShader, 1280x800)

Raw data: `results.json`, `console-log.json`, `network-log.json`, screenshots in this dir. Script: /tmp/f3-qa.mjs (not in repo).

| # | Scenario | Expected | Observed | Result |
|---|----------|----------|----------|--------|
| S1 | Initial load /dashboard | hq_shell+floor_1 200 once, char_base loaded, floor_2/3/4 not requested, basis js+wasm 200, canvas non-blank, F1 label visible | hq_shell 1x200, floor_1 1x200, char_base 1x200, floor_2/3/4 0, basis_transcoder.js/.wasm 200 (fetched 2x each: 2 KTX2 loaders, known warning), ~8.3k sampled unique colours, label visible. Screenshot S1-initial-load.png viewed: lobby interior visible (desks, chairs, sofas, stairs), ground-floor facade cut away, floors above intact, trees, black sky above horizon, selector over red sign (accepted caveats) | PASS |
| S2 | Lazy load F2 | floor_2 once 200; F3/F4 not requested | floor_2 1x200, floor_3/4 0; stats floor 2 = 296 calls / 380,033 tris. Console clean. S2-floor2.png | PASS |
| S3 | F2 -> F1 round trip | floor_1 re-fetched (count 2), char back at (7,0,-6) | floor_1 count 2, char_base count 2, `__hqChar` = (7,0,-6). S3-roundtrip-f1.png | PASS |
| S4 | Visit F3, F4 | each GLB once; stats >0 after waiting | floor_3 1x200, floor_4 1x200. Stable samples (2 samples 1.5 s apart identical): F3 305 calls / 388,681 tris; F4 307 / 391,679; F1 (recheck) 303 / 364,045; F2 (recheck) 296 / 380,033. All pairs distinct, none equals F1 baseline of S1 (568/576,326, includes char). No console errors. See stats note below | PASS |
| S5 | Cutaway vs nocut | pixel diff clearly > 1% | full page diff 6.89%, canvas-only 7.56%. S5-nocut.png viewed: full facade, no interior visible; S5-cut shows interior | PASS |
| S6 | Character | `__hqChar` within 0.5 m of (7,0,-6); animation plays | pos (7,0,-6), dist 0; two canvas shots 800 ms apart: 201 px changed (0.02%, small char region) > 0 | PASS |
| S7 | Console hygiene | 0 console.error, 0 pageerror (S1-S6) | S1-S4, S5-cut, S5-nocut: only accepted warnings (Clock deprecated, PCFSoftShadowMap, Multiple KTX2 loaders) + debug lines. 0 errors, 0 pageerror. (The only pageerror in log is from my own `about:blank` helper page `S5-diff` localStorage access — harness artefact, not the app.) Errors appear only in S8 (induced failure) | PASS |
| S8 | Failure path: abort floor_3.glb, click F3 | page not white-screened; selector still usable; F1 click works afterwards | After click F3: net::ERR_FAILED, pageerror "Could not load /models/floor_3.glb: Failed to fetch", `[OfficeCanvas] WebGL error: ...` logged. The ENTIRE canvas is replaced by the "WebGL not available / Your browser or device does not support 3D rendering." fallback (S8-floor3-aborted.png viewed: dark blank panel with that text). Floor selector buttons GONE from DOM (canvas count 0, selector invisible). Clicking F1/F2 afterwards times out (no button exists). The failure is unrecoverable without a page reload; the message is also misleading (not a WebGL issue). Page header/logout still render (no white screen), but selector is dead | **FAIL** |
| S9 | Real e2e spec (no PW_NEG, no --update-snapshots) | 2 passed | `2 passed (2.0m)`, EXIT=0 (s9-e2e.txt). Baseline md5 before and after = 4816ac7234930a6aea5e65856c2e759e | PASS |

Stats note (INFO): F2 stats in S2 (296/380,033) equal the F2 recheck and equal the Task-10 F3 row (296/380,033), which supports the already-documented suspicion that Task-10's F3 row was a shell-only/stale sample. F3/F4 properly waited values differ from each other and from F2. F1 first sample (568/576,326, with char) is close to Task-10 F1 (627/583,228). FPS 0-4 INFO only.

Visual caveats accepted by user (black sky, building cropped at right, selector over sign, small char) observed and not counted.

## Cleanup
Own dev server (pids 235779/235780/235792) killed; S9 spec server exited itself. `lsof -i :3100 -sTCP:LISTEN` empty. Other user's next-server pid 12098 untouched.

## Verdict
REJECT — S8 FAIL (a single failed floor GLB fetch kills the whole 3D canvas, selector disappears, no recovery without reload; fallback text misleadingly says WebGL not available). All other scenarios (S1-S7, S9) PASS.
