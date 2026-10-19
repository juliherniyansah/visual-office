import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.setTimeout(120_000);

// __dirname is apps/web/e2e, so the repo root is three levels up.
const EVIDENCE_DIR = path.resolve(__dirname, '../../../.omo/evidence/mvp3-integration');
const CHECKPOINT_DIR = path.join(EVIDENCE_DIR, 'task-11-checkpoint');
const F1_ANCHOR = 'F1 · Lobby & Server Room';
const F2_ANCHOR = 'F2 · Domain Floor';
const WEBGL_FALLBACK_TEXT = 'WebGL not available';
const ALLOWLIST: string[] = [];

const encodePart = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
// Unsigned JWT: the dashboard only decodes it client-side (display + expiry check).
const DUMMY_TOKEN = [
  encodePart({ alg: 'none', typ: 'JWT' }),
  encodePart({ email: 'e2e@redhunter.local', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
  '',
].join('.');

test.use({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

test.beforeEach(async ({ page }) => {
  // The auth store reads the token at creation, so it must exist before any page script runs.
  await page.addInitScript((t) => localStorage.setItem('auth_token', t), DUMMY_TOKEN);
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
});

const collectErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

const assertNoErrors = (errors: string[]) => {
  expect(errors.filter((e) => !ALLOWLIST.some((a) => e.includes(a)))).toEqual([]);
};

test('dashboard office canvas renders identically', async ({ page }) => {
  const phase = process.env.MVP1_PHASE ?? 'run';
  const errors = collectErrors(page);
  // Request collector for lazy-load assertions (floor_3/floor_4 must never be fetched).
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));

  const glbShell = page.waitForResponse(
    (r) => r.url().endsWith('/models/hq_shell.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  const glbFloor1 = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.goto('/dashboard');
  await glbShell;
  await glbFloor1;
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });

  await expect(page.getByText(WEBGL_FALLBACK_TEXT)).toHaveCount(0);
  const renderer = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  });
  expect(renderer).toBeTruthy();
  fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-renderer-${phase}.txt`), String(renderer));

  // Floor selector anchor for the new HQ scene (replaces the deleted agent title anchor).
  await expect(page.getByText(F1_ANCHOR)).toBeVisible({ timeout: 30_000 });

  // Camera lerp converges well below 0.001 units within 3s; nothing else animates without input.
  await page.waitForTimeout(3000);

  // Hides the Next dev badge host; `mask` cannot reach its shadow root.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });

  await page.screenshot({ path: path.join(EVIDENCE_DIR, `task-11-dashboard-${phase}.png`) });
  await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-f1.png') });

  // Lazy-load: clicking F2 must fetch floor_2.glb; floor_3/floor_4 must never be requested.
  const glbFloor2 = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_2.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.getByText(F2_ANCHOR).click();
  await glbFloor2;
  expect(requested.some((u) => u.includes('/models/floor_2.glb'))).toBe(true);
  expect(requested.some((u) => u.includes('/models/floor_3.glb'))).toBe(false);
  expect(requested.some((u) => u.includes('/models/floor_4.glb'))).toBe(false);

  // Let floor 2 render + stats flush before the checkpoint screenshot.
  await page.waitForFunction(() => window.__hqStats?.floorId === 2, undefined, { timeout: 30_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-f2.png') });

  // Round-trip F2→F1: FloorModel unmount clears the drei cache, so floor_1 re-fetches (200).
  const glbFloor1Again = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.getByText(F1_ANCHOR).click();
  await glbFloor1Again;

  // PerfProbe writes window.__hqStats once per second; FPS 1-4 under SwiftShader is expected.
  await page.waitForFunction(
    () => {
      const s = window.__hqStats;
      return !!s && s.floorId === 1 && s.calls > 0 && s.triangles > 0;
    },
    undefined,
    { timeout: 30_000 },
  );
  const stats = await page.evaluate(() => window.__hqStats);
  expect(stats?.calls ?? 0).toBeGreaterThan(0);
  expect(stats?.triangles ?? 0).toBeGreaterThan(0);
  fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-hq-stats-${phase}.json`), JSON.stringify(stats, null, 2));

  // Camera lerp back to F1 converges within 3s.
  await page.waitForTimeout(3000);

  // Negative self-check: PW_NEG=1 must make the snapshot comparison fail.
  if (process.env.PW_NEG) await page.addStyleTag({ content: 'canvas{filter:invert(1)}' });

  await expect(page.locator('main')).toHaveScreenshot('dashboard-office.png', {
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    // SwiftShader renders the 583k-tri HQ scene at 1-4 FPS; the default 5s assertion
    // budget is too short for two consecutive rAF stability probes + capture.
    timeout: 30_000,
  });

  fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-console-${phase}.json`), JSON.stringify(errors, null, 2));
  assertNoErrors(errors);
});

test('dashboard office nocut variant renders', async ({ page }) => {
  const phase = process.env.MVP1_PHASE ?? 'run';
  const errors = collectErrors(page);

  const glbShell = page.waitForResponse(
    (r) => r.url().endsWith('/models/hq_shell.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  const glbFloor1 = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.goto('/dashboard?nocut=1');
  await glbShell;
  await glbFloor1;
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(F1_ANCHOR)).toBeVisible({ timeout: 30_000 });

  await page.waitForTimeout(3000);
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.screenshot({ path: path.join(CHECKPOINT_DIR, 'dashboard-nocut.png') });

  fs.writeFileSync(path.join(EVIDENCE_DIR, `task-11-console-nocut-${phase}.json`), JSON.stringify(errors, null, 2));
  assertNoErrors(errors);
});

test('dashboard office survives a failed floor load', async ({ page }) => {
  // The browser logs the aborted fetch without a URL in its text; keep the resource URL to filter by.
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${m.location().url} ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));

  // Abort floor 3 only: the shell and floors 1/2 must keep loading normally.
  await page.route('**/models/floor_3.glb', (route) => route.abort('failed'));

  const glbShell = page.waitForResponse(
    (r) => r.url().endsWith('/models/hq_shell.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  const glbFloor1 = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_1.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.goto('/dashboard');
  await glbShell;
  await glbFloor1;
  await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(F1_ANCHOR)).toBeVisible({ timeout: 30_000 });
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });

  await page.getByRole('button', { name: /F3/ }).click();

  // Accurate message, selector still mounted, no misleading WebGL fallback.
  await expect(page.getByText(/Gagal memuat model lantai/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(WEBGL_FALLBACK_TEXT)).toHaveCount(0);
  for (const label of ['F1', 'F2', 'F3', 'F4']) {
    await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 'task-14-floor-failure-error.png'),
  });

  // Picking another floor recovers without a reload. Clear stale stats so the poll sees fresh data.
  await page.evaluate(() => {
    window.__hqStats = undefined;
  });
  await page.getByRole('button', { name: /F1/ }).click();
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 60_000 });
  await expect
    .poll(() => page.evaluate(() => window.__hqStats?.floorId), { timeout: 60_000 })
    .toBe(1);
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 'task-14-floor-failure-recovered.png'),
  });

  // Retry semantic: with the abort removed, F3 loads for real.
  await page.unroute('**/models/floor_3.glb');
  await page.evaluate(() => {
    window.__hqStats = undefined;
  });
  const glbFloor3 = page.waitForResponse(
    (r) => r.url().endsWith('/models/floor_3.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /F3/ }).click();
  await glbFloor3;
  await expect
    .poll(() => page.evaluate(() => window.__hqStats?.floorId), { timeout: 60_000 })
    .toBe(3);
  await expect(page.getByText(/Gagal memuat model lantai/)).toHaveCount(0);

  // Only the induced floor_3 failure may surface as a page error.
  const unexpected = errors.filter((e) => !e.includes('floor_3'));
  expect(unexpected).toEqual([]);
});
