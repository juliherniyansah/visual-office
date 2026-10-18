import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

let apiProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

async function waitForPort(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${host}:${port}`);
      // Any HTTP response (even 404) means the server is up
      if (res.status > 0) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Server did not become ready at ${host}:${port} within ${timeoutMs}ms`);
}

async function globalSetup() {
  const host = 'http://127.0.0.1';
  const testDbName = 'redhunter_setup_e2e';

  // Clean test database before starting
  try {
    const { execSync } = await import('node:child_process');
    execSync(`mongosh mongodb://127.0.0.1:27017/${testDbName} --eval "db.dropDatabase()"`, { stdio: 'ignore' });
    console.log(`Cleaned test database: ${testDbName}`);
  } catch (err) {
    console.warn('Failed to clean test database:', err);
  }

  // Start API server (port 4100 to match apps/web/.env.local NEXT_PUBLIC_API_URL)
  apiProcess = spawn('bun', ['run', 'start'], {
    cwd: '/home/programer/work/visual-office/apps/api',
    stdio: 'ignore',
    detached: true,
    env: {
      ...process.env,
      PORT: '4100',
      HOST: '127.0.0.1',
      MONGO_URL: 'mongodb://127.0.0.1:27017/redhunter_setup_e2e',
      JWT_SECRET: 'test-jwt-secret-for-e2e-tests-minimum-32-chars-long',
      OWNER_EMAIL: '',
      OWNER_PASSWORD: '',
      EVENTS_DISPATCH: 'off',
      CORS_ORIGINS: 'http://localhost:3100,http://127.0.0.1:3100',
    },
  });
  apiProcess.unref();
  if (apiProcess.pid) {
    process.env.__API_PID__ = String(apiProcess.pid);
  }
  await waitForPort(host, 4100);

  // Start web server (port 3100)
  webProcess = spawn('bun', ['run', 'dev'], {
    cwd: '/home/programer/work/visual-office/apps/web',
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: '3100' },
  });
  webProcess.unref();
  if (webProcess.pid) {
    process.env.__WEB_PID__ = String(webProcess.pid);
  }
  await waitForPort(host, 3100);

  console.log('Setup global setup complete (fresh DB, no users).');
}

export default globalSetup;
