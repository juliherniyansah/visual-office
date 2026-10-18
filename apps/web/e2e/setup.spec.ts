import { test, expect } from '@playwright/test';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve(__dirname, '../../.omo/evidence/vyron-setup-flow');

test.describe('Setup flow (F2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('google-analytics.com') || url.includes('fonts.googleapis.com')) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  });

  test('Test 1: Root page redirects to /setup when no users exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/setup', { timeout: 15000 });
    await expect(page).toHaveURL(/\/setup$/);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test1-redirect-to-setup.png'), fullPage: true });
  });

  test('Test 2: Setup page renders with email/password/confirmPassword fields', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/^password$/i);
    const confirmPasswordField = page.getByLabel(/confirm password/i);
    const createAccountButton = page.getByRole('button', { name: /create admin account/i });

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(confirmPasswordField).toBeVisible();
    await expect(createAccountButton).toBeVisible();

    await expect(page.getByRole('heading', { name: /initial setup/i })).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test2-setup-form-rendered.png'), fullPage: true });
  });

  test('Test 3: Form validation shows errors for invalid input', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/^password$/i);
    const confirmPasswordField = page.getByLabel(/confirm password/i);
    const createAccountButton = page.getByRole('button', { name: /create admin account/i });

    await createAccountButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test3a-empty-form-submit.png'), fullPage: true });

    await emailField.fill('not-an-email');
    await passwordField.fill('12345');
    await confirmPasswordField.fill('54321');
    await createAccountButton.click();
    await page.waitForTimeout(500);

    const errorElement = page.locator('.text-red-600, .text-red-500, [role="alert"], .error-message');
    const errorCount = await errorElement.count();
    expect(errorCount).toBeGreaterThan(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test3b-validation-errors.png'), fullPage: true });
  });

  test('Test 4: Successful setup redirects to home/dashboard', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/^password$/i);
    const confirmPasswordField = page.getByLabel(/confirm password/i);
    const createAccountButton = page.getByRole('button', { name: /create admin account/i });

    const uniqueEmail = `admin-${Date.now()}@example.com`;
    await emailField.fill(uniqueEmail);
    await passwordField.fill('SecurePass123!');
    await confirmPasswordField.fill('SecurePass123!');

    await createAccountButton.click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/dashboard', { timeout: 15000 });

    expect(page.url()).toMatch(/\/($|dashboard)/);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test4-setup-success-redirect.png'), fullPage: true });
  });

  test('Test 5: SETUP_CONFLICT error displays when users exist', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const emailField = page.getByLabel(/email/i);
    const passwordField = page.getByLabel(/^password$/i);
    const confirmPasswordField = page.getByLabel(/confirm password/i);
    const createAccountButton = page.getByRole('button', { name: /create admin account/i });

    await emailField.fill('second-admin@example.com');
    await passwordField.fill('AnotherPass123!');
    await confirmPasswordField.fill('AnotherPass123!');

    await createAccountButton.click();

    const errorElement = page.locator('.text-red-600, .text-red-500, [role="alert"], .error-message');
    await expect(errorElement.first()).toBeVisible({ timeout: 10000 });

    const errorText = await errorElement.first().textContent();
    expect(errorText?.toLowerCase()).toMatch(/setup|conflict|exist|already|failed/i);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'test5-setup-conflict-error.png'), fullPage: true });
  });
});
