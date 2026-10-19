# F2 Code Quality Review — MVP-3 (round 2)

Date: 2026-10-19 · Reviewer: F2 (read-only)

## Mechanical checks
| Check | Result |
|---|---|
| `bun run typecheck` (apps/web) | EXIT 0 |
| `bun test src/components/office/nodes.test.ts` | 5 pass / 0 fail |
| `biome lint` on 13 changed files | 0 errors, 3 warnings (accepted: CharAgent.tsx:21 noNonNullAssertion, FloorModel.tsx:4 + OfficeCanvas.tsx:16 useImportType) |
| `biome lint src/components/office` (whole dir) | 1 error = FloorSelector.tsx:29 useButtonType (pre-existing MVP-1, accepted); CameraRig.tsx:13 noExplicitAny (pre-existing, accepted) |
| grep `as any / @ts-ignore / @ts-expect-error / TODO / FIXME / HACK` | 0 hits |
| `git status apps/web/e2e` | only spec + snapshot modified, no temp files |
| `optimize-hq.sh` | `set -euo pipefail` (l.5), `echo "MODE=$MODE"` (l.107), log shows `MODE=ktx2`; `|| true` only on probes followed by explicit `exit 1` check — no silent fallback |
| `.gitignore` / `package.json` diff | hq_shell.glb ignored by name, `*_src.glb` defensive; only `@gltf-transform/cli` devDep added — OK |

## FloorLoadBoundary.tsx (new)
- Reset logic correct: `componentDidUpdate` resets only when `resetKey` changed AND an error is held; `prevProps.modelUrl` is the URL of the floor that failed (url derived from `currentFloor`), so clearing it is right. Retry clears current `props.modelUrl` — right.
- Rethrow from `render()` for non-model errors: safe. An error thrown by a boundary's own render propagates to the nearest ancestor boundary (`WebGLErrorBoundary`); `componentDidCatch` of the failed boundary is not committed, so no double-logging.
- Healthy path returns `children` directly — no extra DOM, pixel baseline unaffected (md5 unchanged per notepad).
- No `any`, no empty catch, functions small, English names. OK.

| Sev | Location | Problem | Minimal fix |
|---|---|---|---|
| MINOR | FloorLoadBoundary.tsx:46-54 | Reset/retry only clears the *floor* URL. If the failure came from `hq_shell.glb` or `char_base.glb` (message also matches `\.glb`), drei keeps that rejected promise cached; retry/floor switch rethrows forever until reload. | Extract the URL from drei's message (`Could not load <url>:`) and `useGLTF.clear()` it, or clear shell+char+floor URLs in `reset`. |
| NIT | FloorLoadBoundary.tsx:6 | `MODEL_LOAD_PATTERN` broad (`Failed to fetch`, `NetworkError`, `net::`). Inside the Canvas tree only loaders fetch today, so practically fine; would misclassify a future in-canvas API fetch. | Narrow to `/Could not load .*\.glb/` once drei message is the only source. |
| NIT | FloorLoadBoundary.tsx:62-95 | Inline style objects duplicated from WebGLErrorBoundary. | Shared const when a 3rd fallback appears. |

## Resource lifecycle (carry-over)
| Sev | Location | Problem | Minimal fix |
|---|---|---|---|
| MINOR | OfficeCanvas.tsx:24-29, useHqGltf.ts:16-19 | 4 `KTX2Loader` instances per Canvas mount (preloader + HqShell + FloorModel + CharAgent), never `.dispose()`d. Per floor switch no new instance (memo on `gl`, FloorModel not keyed) so no growth; but every error-recovery Canvas remount leaks the old worker pools. Bounded leak. | Single loader per renderer in a context/module WeakMap keyed by `gl`, `dispose()` on Canvas unmount. |
| MINOR | FloorModel.tsx:38-41, CharAgent.tsx:40-43 | `useGLTF.clear(url)` in effect cleanup: under dev StrictMode (`reactStrictMode: true`) the mount→cleanup→mount cycle clears the cache while the component keeps the scene, so the next re-render suspends and refetches (extra network + disposed-then-reused scene). Prod unaffected (cleanup runs only on url change/unmount). | Acceptable for MVP; if dev refetch noise matters, move clear/dispose to the floor-switch handler or guard with a ref. |
| NIT | HqShell.tsx:22-35 | Cutaway has no cleanup; cached shell keeps last visibility if remounted with `disableCutaway`. Each run rewrites all facade nodes so normal path is correct. | Restore `visible=true` in cleanup if `nocut` toggling at runtime is ever needed. |
| OK | CharAgent.tsx:46-60 | action stop on cleanup; drei `useAnimations` uncaches mixer on unmount. | — |

## Test hooks
| Sev | Location | Problem | Minimal fix |
|---|---|---|---|
| NIT | CharAgent.tsx:62-67, PerfProbe.tsx:41 | `window.__hqChar` / `__hqStats` written in production, no comment saying test-only; CharAgent allocates a `Vector3` every frame. | Comment "e2e hook", reuse a module/ref Vector3; optionally gate on `NODE_ENV !== 'production'`. |

## Other
| Sev | Location | Problem | Minimal fix |
|---|---|---|---|
| MINOR | OfficeCanvas.tsx:18-20,40 | `agentStatuses` prop still in public type but ignored (`_props`) after Agent removal — callers get silent no-op. | Drop the prop + caller arg, or comment that agents return in MVP-4. |
| NIT | OfficeCanvas.tsx:51 | magic `distance: 15`. | Named constant in constants.ts. |
| NIT | FloorModel.tsx:31 | prop name `n`. | `floorId`. |

## e2e spec (3 tests)
- `maxDiffPixelRatio: 0.01` intact; `PW_NEG` invert hook intact (l.137).
- Every `waitForResponse` created before its triggering `goto`/`click` (l.59-67, 96-100, 112-116, 155-163, 188-196, 233-237).
- Test 3 asserts: error text visible, no WebGL fallback, all 4 selector buttons visible, recovery to F1 via fresh `__hqStats`, real F3 load after `unroute`, error text gone, only floor_3 errors. No `toHaveScreenshot`. Good.
- NIT: errors filter `!e.includes('floor_3')` is permissive (any message mentioning floor_3 passes). Acceptable.

## Verdict
No BLOCKER/MAJOR. 4 MINOR + NITs above, none affect correctness of the shipped path.

VERDICT: APPROVE

---

# Round 3 (post-polish) — re-review of the 3 fixes

Date: 2026-10-19 · Reviewer: F2 (read-only). Round-2 tables above remain authoritative for NITs not re-litigated here.

## Per-fix verification

| # | Round-2 finding | Fix verified in code | Result |
|---|---|---|---|
| 1 | FloorLoadBoundary reset only cleared floor URL | `reset()` now extracts URL via `/Could not load\s+([^:]+):/` (l.51) → `useGLTF.clear(match[1])`, then always clears floor url + `/models/hq_shell.glb` + `/models/char_base.glb` (l.58-60). `componentDidUpdate` still keyed on `prevProps.resetKey` and passes `prevProps.modelUrl` (the failed floor). Healthy path untouched; non-model errors still rethrown in `render()`. Regex note: `[^:]+` stops at first colon, so an absolute `http://host:port/...` URL would truncate after the scheme — irrelevant here because all model URLs are in-path (no colon) and shell/char/floor are cleared unconditionally as fallback. | FIXED ✓ |
| 2 | KTX2Loader ×4, never disposed | `useHqGltf.ts`: `WeakMap<WebGLRenderer,{loader,holders}>` (l.18); `getSharedKtx2Loader` creates once per `gl` with `detectSupport(gl)` called exactly once at creation (l.23); `retainKtx2Loader`/`releaseKtx2Loader` with deferred `setTimeout(0)` dispose+evict when holders hits 0 (l.29-46). StrictMode mount→cleanup→mount: holders 1→0→1 before macrotask runs → timeout sees 1, no dispose ✓. True unmount: holders 0 at timeout → dispose + `WeakMap.delete` ✓. Post-eviction `getSharedKtx2Loader` re-creates a fresh loader (no disposed-reuse hole: the cache returns only live entries). Holders never >1 in practice (single `ModelPreloader` per Canvas); consumers (`HqShell`/`FloorModel`/`CharAgent` via `useKtx2Loader`) share without retaining — memo on `gl`, so no leak. `OfficeCanvas.tsx` `ModelPreloader` retains in effect, releases in cleanup, no direct dispose. | FIXED ✓ |
| 3 | Dead `agentStatuses` prop | Gone from `OfficeCanvas.tsx` (no prop in signature, no `_props`); caller `dashboard/page.tsx` renders bare `<OfficeCanvas />`. | FIXED ✓ |

## Mechanical (re-run)
| Check | Result |
|---|---|
| `bun run typecheck` | EXIT 0 |
| `bun test nodes.test.ts` | 5 pass / 0 fail |
| `biome lint` on the 3 changed files | 0 errors |
| grep `as any\|@ts-ignore\|TODO\|FIXME` in office dir | 0 hits |
| Orchestrator evidence `final-polish-minors.txt` | e2e `3 passed`; snapshot md5 `4816ac7234930a6aea5e65856c2e759e` before=after — pixel baseline intact |

## Round-3 verdict
All 3 requested MINORs correctly fixed; no new BLOCKER/MAJOR introduced. Fix 4 (StrictMode `useGLTF.clear`) accepted per round 2. NITs (broad pattern, inline styles, magic 15, prop `n`, test hooks) unchanged and accepted.

VERDICT: APPROVE
