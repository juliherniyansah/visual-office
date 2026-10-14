import { defineConfig } from '@playwright/test';

// One worker: the harness api is a singleton on port 4000; parallel workers would race it.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'off',
  },
  webServer: {
    command: 'bun run next dev -p 3100',
    port: 3100,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:4100',
      BROWSER: 'none',
    },
  },
});
