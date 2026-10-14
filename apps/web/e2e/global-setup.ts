import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

let webProcess: ChildProcess | null = null;

async function waitForPort(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${host}:${port}`);
      if (res.ok || res.status === 200) return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Server did not become ready at ${host}:${port} within ${timeoutMs}ms`);
}

async function globalSetup() {
  const host = 'http://127.0.0.1';

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
}

export default globalSetup;
