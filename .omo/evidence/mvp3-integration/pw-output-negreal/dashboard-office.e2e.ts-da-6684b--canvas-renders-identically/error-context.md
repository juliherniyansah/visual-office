# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-office.e2e.ts >> dashboard office canvas renders identically
- Location: e2e/dashboard-office.e2e.ts:52:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('main')
Timeout: 30000ms
  Timeout 30000ms exceeded.

  Snapshot: dashboard-office.png

Call log:
  - Expect "toHaveScreenshot(dashboard-office.png)" locator('main') with timeout 30000ms
    - verifying given screenshot expectation
  - waiting for locator('main')
    - locator resolved to <main class="flex-1 overflow-hidden">…</main>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 749312 pixels (ratio 0.81 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('main')
    - locator resolved to <main class="flex-1 overflow-hidden">…</main>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Timeout 30000ms exceeded.

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - heading "Visual Office" [level=1] [ref=e6]
        - generic [ref=e7]:
          - generic [ref=e8]: e2e@redhunter.local
          - generic [ref=e9]: •
          - generic [ref=e10]: admin
      - button "Logout" [ref=e11]
    - main [ref=e12]:
      - generic [ref=e14]:
        - button "F1 · Lobby & Server Room" [active] [ref=e15] [cursor=pointer]
        - button "F2 · Domain Floor" [ref=e16] [cursor=pointer]
        - button "F3 · Operations" [ref=e17] [cursor=pointer]
        - button "F4 · CEO Office" [ref=e18] [cursor=pointer]
```

# Test source

```ts
  39  | const collectErrors = (page: import('@playwright/test').Page) => {
  40  |   const errors: string[] = [];
  41  |   page.on('console', (m) => {
  42  |     if (m.type() === 'error') errors.push(m.text());
  43  |   });
  44  |   page.on('pageerror', (e) => errors.push(e.message));
  45  |   return errors;
  46  | };
  47  | 
  48  | const assertNoErrors = (errors: string[]) => {
  49  |   expect(errors.filter((e) => !ALLOWLIST.some((a) => e.includes(a)))).toEqual([]);
  50  | };
  51  | 
  52  | test('dashboard office canvas renders identically', async ({ page }) => {
  53  |   const phase = process.env.MVP1_PHASE ?? 'run';
  54  |   const errors = collectErrors(page);
  55  |   // Request collector for lazy-load assertions (floor_3/floor_4 must never be fetched).
  56  |   const requested: string[] = [];
  57  |   page.on('request', (r) => requested.push(r.url()));
  58  | 
  59  |   const glbShell = page.waitForResponse(
  60  |     (r) => r.url().endsWith('/models/hq_shell.glb') && r.status() === 200,
  61  |     { timeout: 60_000 },
  62  |   );
  63  |   const glbFloor1 = page.waitForResponse(
  64  |     (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
  65  |     { timeout: 60_000 },
  66  |   );
  67  |   await page.goto('/dashboard');
  68  |   await glbShell;
  69  |   await glbFloor1;
  70  |   await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  71  | 
  72  |   await expect(page.getByText(WEBGL_FALLBACK_TEXT)).toHaveCount(0);
  73  |   const renderer = await page.evaluate(() => {
  74  |     const c = document.querySelector('canvas');
  75  |     const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
  76  |     if (!gl) return null;
  77  |     const ext = gl.getExtension('WEBGL_debug_renderer_info');
  78  |     return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  79  |   });
  80  |   expect(renderer).toBeTruthy();
  81  |   fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-renderer-${phase}.txt`), String(renderer));
  82  | 
  83  |   // Floor selector anchor for the new HQ scene (replaces the deleted agent title anchor).
  84  |   await expect(page.getByText(F1_ANCHOR)).toBeVisible({ timeout: 30_000 });
  85  | 
  86  |   // Camera lerp converges well below 0.001 units within 3s; nothing else animates without input.
  87  |   await page.waitForTimeout(3000);
  88  | 
  89  |   // Hides the Next dev badge host; `mask` cannot reach its shadow root.
  90  |   await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  91  | 
  92  |   await page.screenshot({ path: path.join(EVIDENCE_DIR, `task-11-dashboard-${phase}.png`) });
  93  |   await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-f1.png') });
  94  | 
  95  |   // Lazy-load: clicking F2 must fetch floor_2.glb; floor_3/floor_4 must never be requested.
  96  |   const glbFloor2 = page.waitForResponse(
  97  |     (r) => r.url().endsWith('/models/floor_2.glb') && r.status() === 200,
  98  |     { timeout: 60_000 },
  99  |   );
  100 |   await page.getByText(F2_ANCHOR).click();
  101 |   await glbFloor2;
  102 |   expect(requested.some((u) => u.includes('/models/floor_2.glb'))).toBe(true);
  103 |   expect(requested.some((u) => u.includes('/models/floor_3.glb'))).toBe(false);
  104 |   expect(requested.some((u) => u.includes('/models/floor_4.glb'))).toBe(false);
  105 | 
  106 |   // Let floor 2 render + stats flush before the checkpoint screenshot.
  107 |   await page.waitForFunction(() => window.__hqStats?.floorId === 2, undefined, { timeout: 30_000 });
  108 |   await page.waitForTimeout(3000);
  109 |   await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-f2.png') });
  110 | 
  111 |   // Round-trip F2→F1: FloorModel unmount clears the drei cache, so floor_1 re-fetches (200).
  112 |   const glbFloor1Again = page.waitForResponse(
  113 |     (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
  114 |     { timeout: 60_000 },
  115 |   );
  116 |   await page.getByText(F1_ANCHOR).click();
  117 |   await glbFloor1Again;
  118 | 
  119 |   // PerfProbe writes window.__hqStats once per second; FPS 1-4 under SwiftShader is expected.
  120 |   await page.waitForFunction(
  121 |     () => {
  122 |       const s = window.__hqStats;
  123 |       return !!s && s.floorId === 1 && s.calls > 0 && s.triangles > 0;
  124 |     },
  125 |     undefined,
  126 |     { timeout: 30_000 },
  127 |   );
  128 |   const stats = await page.evaluate(() => window.__hqStats);
  129 |   expect(stats?.calls ?? 0).toBeGreaterThan(0);
  130 |   expect(stats?.triangles ?? 0).toBeGreaterThan(0);
  131 |   fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-hq-stats-${phase}.json`), JSON.stringify(stats, null, 2));
  132 | 
  133 |   // Camera lerp back to F1 converges within 3s.
  134 |   await page.waitForTimeout(3000);
  135 | 
  136 |   // Negative self-check: PW_NEG=1 must make the snapshot comparison fail.
  137 |   if (process.env.PW_NEG) await page.addStyleTag({ content: 'canvas{filter:invert(1)}' });
  138 | 
> 139 |   await expect(page.locator('main')).toHaveScreenshot('dashboard-office.png', {
      |                                      ^ Error: expect(locator).toHaveScreenshot(expected) failed
  140 |     maxDiffPixelRatio: 0.01,
  141 |     animations: 'disabled',
  142 |     // SwiftShader renders the 583k-tri HQ scene at 1-4 FPS; the default 5s assertion
  143 |     // budget is too short for two consecutive rAF stability probes + capture.
  144 |     timeout: 30_000,
  145 |   });
  146 | 
  147 |   fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-console-${phase}.json`), JSON.stringify(errors, null, 2));
  148 |   assertNoErrors(errors);
  149 | });
  150 | 
  151 | test('dashboard office nocut variant renders', async ({ page }) => {
  152 |   const phase = process.env.MVP1_PHASE ?? 'run';
  153 |   const errors = collectErrors(page);
  154 | 
  155 |   const glbShell = page.waitForResponse(
  156 |     (r) => r.url().endsWith('/models/hq_shell.glb') && r.status() === 200,
  157 |     { timeout: 60_000 },
  158 |   );
  159 |   const glbFloor1 = page.waitForResponse(
  160 |     (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
  161 |     { timeout: 60_000 },
  162 |   );
  163 |   await page.goto('/dashboard?nocut=1');
  164 |   await glbShell;
  165 |   await glbFloor1;
  166 |   await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  167 |   await expect(page.getByText(F1_ANCHOR)).toBeVisible({ timeout: 30_000 });
  168 | 
  169 |   await page.waitForTimeout(3000);
  170 |   await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  171 |   await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-nocut.png') });
  172 | 
  173 |   fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-console-nocut-${phase}.json`), JSON.stringify(errors, null, 2));
  174 |   assertNoErrors(errors);
  175 | });
  176 | 
```