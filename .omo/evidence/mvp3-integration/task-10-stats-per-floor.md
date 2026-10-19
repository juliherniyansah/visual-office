# Todo 10 — Stats per lantai

Corrected 2026-10-18 by final-wave F3 re-measure (original capture was stale/shell-only for F2-F4).

Method: `waitForResponse(floor_N.glb)` + settle, two stable samples 1.5 s apart, headless Chromium SwiftShader, FPS INFO only; source: `final-wave/F3-manual-qa/results.json` (blocks S1, S2, S4). FPS fluctuated 0-4 across samples (SwiftShader, INFO).

| Floor | Calls | Triangles | FPS | Notes | Recommendation |
|-------|-------|-----------|-----|-------|----------------|
| F1 (with CharAgent, first sample after initial load) | 568 | 576,326 | 0-4 (SwiftShader, INFO) | S1.stats, includes CharAgent | Heaviest sample (char + furniture); within accepted budget |
| F1 re-check (without character, after round trip) | 303 | 364,045 | 0-4 (SwiftShader, INFO) | S4.floor_1_recheck, sampleA == sampleB | Same floor without CharAgent |
| F2 | 296 | 380,033 | 0-4 (SwiftShader, INFO) | S2.stats and S4.floor_2_recheck agree | Shell ~561k tris accepted per decision #21; no decimation needed |
| F3 | 305 | 388,681 | 0-4 (SwiftShader, INFO) | S4.floor_3, sampleA == sampleB | Shell ~561k tris accepted per decision #21; no decimation needed |
| F4 | 307 | 391,679 | 0-4 (SwiftShader, INFO) | S4.floor_4, sampleA == sampleB | Shell ~561k tris accepted per decision #21; no decimation needed |

Raw samples (copied from `results.json`):

```json
{
  "F1_with_character": { "source": "S1.stats", "floorId": 1, "calls": 568, "triangles": 576326, "fps": 0 },
  "F1_recheck": {
    "source": "S4.floor_1_recheck",
    "sampleA": { "floorId": 1, "calls": 303, "triangles": 364045, "fps": 2 },
    "sampleB": { "floorId": 1, "calls": 303, "triangles": 364045, "fps": 2 }
  },
  "F2": {
    "source": "S2.stats / S4.floor_2_recheck",
    "S2": { "floorId": 2, "calls": 296, "triangles": 380033, "fps": 0 },
    "sampleA": { "floorId": 2, "calls": 296, "triangles": 380033, "fps": 1 },
    "sampleB": { "floorId": 2, "calls": 296, "triangles": 380033, "fps": 2 }
  },
  "F3": {
    "source": "S4.floor_3",
    "sampleA": { "floorId": 3, "calls": 305, "triangles": 388681, "fps": 3 },
    "sampleB": { "floorId": 3, "calls": 305, "triangles": 388681, "fps": 2 }
  },
  "F4": {
    "source": "S4.floor_4",
    "sampleA": { "floorId": 4, "calls": 307, "triangles": 391679, "fps": 3 },
    "sampleB": { "floorId": 4, "calls": 307, "triangles": 391679, "fps": 4 }
  }
}
```

## Superseded data

The values below came from the original todo 10 capture (2026-10-18T19:34:27.624Z). They were taken before the target floor GLB finished loading (stale/shell-only for F2-F4; the old "F3" row is actually the floor 2 value). They are SUPERSEDED by the table above and must not be used.

| Floor | Calls | Triangles | FPS | Status |
|-------|-------|-----------|-----|--------|
| F1 | 627 | 583,228 | 3 | SUPERSEDED |
| F2 | 301 | 325,047 | 4 | SUPERSEDED |
| F3 | 296 | 380,033 | 2 | SUPERSEDED (equals the real F2 value) |
| F4 | 307 | 391,679 | 1 | SUPERSEDED (calls/tris happen to match the real F4 value; the capture itself was not reliable) |

Console errors (original capture):

```json
[]
```

Cleanup (original capture):
- Scratch script `apps/web/e2e/task10-scratch.mjs` deleted.
- Dev server (port 3100) and Chromium terminated by script finally block.
- `bunx tsc --noEmit` EXIT=0.
