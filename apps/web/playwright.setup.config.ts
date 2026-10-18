import { defineConfig } from '@playwright/test';

// Separate config for setup flow E2E tests.
// Uses a global-setup that starts servers but does NOT create a user,
// so tests can exercise the fresh-DB setup flow.
export default defineConfig({
  testDir: './e2e',
  testMatch: /setup\.spec\.ts/,
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  globalSetup: './e2e/setup-global-setup.ts',
});
