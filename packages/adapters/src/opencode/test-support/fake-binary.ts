import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ScratchDir {
  readonly path: string;
  remove(): void;
}

export function createScratchDir(): ScratchDir {
  const path = mkdtempSync(join(tmpdir(), 'rh-opencode-'));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

// Writes an executable /bin/sh script standing in for the `opencode` binary.
export function writeFakeBinary(dir: string, name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return path;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
