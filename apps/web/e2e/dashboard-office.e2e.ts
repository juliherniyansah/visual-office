import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.setTimeout(120_000);

// __dirname is apps/web/e2e, so the repo root is three levels up.
const EVIDENCE_DIR = path.resolve(__dirname, '../../../.omo/evidence/mvp-1-foundation');
const AGENT_TITLE_ANCHOR = 'Chief Executive Officer';
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
});

test('dashboard office canvas renders identically', async ({ page }) => {
  const phase = process.env.MVP1_PHASE ?? 'run';
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  const glb = page.waitForResponse(
    (r) => r.url().endsWith('/models/building.glb') && r.status() === 200,
    { timeout: 60_000 },
  );
  await page.goto('/dashboard');
  await glb;
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
  fs.writeFileSync(path.join(EVIDENCE_DIR, `14-renderer-${phase}.txt`), String(renderer));

  await expect(page.getByText(AGENT_TITLE_ANCHOR)).toBeVisible({ timeout: 30_000 });

  // Camera lerp converges well below 0.001 units within 3s; nothing else animates without input.
  await page.waitForTimeout(3000);

  // Hides the Next dev badge host; `mask` cannot reach its shadow root.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });

  await page.screenshot({ path: path.join(EVIDENCE_DIR, `10-dashboard-${phase}.png`) });

  // Negative self-check: PW_NEG=1 must make the snapshot comparison fail.
  if (process.env.PW_NEG) await page.addStyleTag({ content: 'canvas{filter:invert(1)}' });

  await expect(page.locator('main')).toHaveScreenshot('dashboard-office.png', {
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
  });

  fs.writeFileSync(path.join(EVIDENCE_DIR, `11-console-${phase}.json`), JSON.stringify(errors, null, 2));
  expect(errors.filter((e) => !ALLOWLIST.some((a) => e.includes(a)))).toEqual([]);
});
