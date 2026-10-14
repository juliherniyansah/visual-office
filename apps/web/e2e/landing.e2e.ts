import { test, expect } from '@playwright/test';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve(__dirname, '../../.omo/evidence/vyron-landing-page');

test.describe('Landing page', () => {
  test('(a) page loads with correct h1', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('Where Humans and AI Work Together.');
  });

  test('(b) zero console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('(c) no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(overflow).toBe(false);
  });

  test('(d) nav anchors resolve', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('nav a[href^="#"]').all();
    const existingIds = ['hero', 'audience', 'final-cta'];
    for (const link of links) {
      const href = await link.getAttribute('href');
      const id = href?.slice(1);
      if (existingIds.includes(id || '')) {
        const section = page.locator(`#${id}`);
        await expect(section).toHaveCount(1);
      }
    }
  });

  test('(e) mailto CTAs', async ({ page }) => {
    await page.goto('/');
    const ctas = await page.locator('a[href*="mailto"]').all();
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const cta of ctas) {
      const href = await cta.getAttribute('href');
      expect(href).toMatch(/^mailto:hello@vyron\.ai/);
    }
  });

  test('(f) reduced-motion respected', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const elements = await page.locator('[data-visible]').all();
    for (const el of elements) {
      await expect(el).toHaveAttribute('data-visible', 'true');
      await expect(el).toHaveCSS('opacity', '1');
    }
  });

  test('(g) screenshots', async ({ page }, testInfo) => {
    const sections = ['hero', 'platform', 'office', 'workforce', 'how-it-works', 'ai-core', 'capabilities', 'about', 'cta'];
    await page.goto('/');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `task-11-full-${testInfo.project.name}.png`), fullPage: true });
    for (const id of sections) {
      const section = page.locator(`#${id}`);
      if (await section.count() > 0) {
        await section.screenshot({ path: path.join(EVIDENCE_DIR, `task-11-${id}-${testInfo.project.name}.png`) });
      }
    }
  });

  test('(h) nav structure', async ({ page }, testInfo) => {
    await page.goto('/');
    const navLinks = await page.locator('nav a').count();
    expect(navLinks).toBe(6);
    if (testInfo.project.name === 'mobile') {
      const toggle = page.locator('button[aria-expanded]');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
  });

  test('(i) footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('VYRON');
    await expect(footer.locator('a[href*="mailto"]')).toHaveCount(1);
  });

  test('(j) no forms', async ({ page }) => {
    await page.goto('/');
    const forms = await page.locator('form').count();
    expect(forms).toBe(0);
  });
});
