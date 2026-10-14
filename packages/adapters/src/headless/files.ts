import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export interface RunDir {
  readonly path: string;
  // Idempotent, never throws (best effort: a leftover temp dir is harmless).
  remove(): void;
}

// Per-run temp dir for generated prompt/schema/settings files; never inside the sandbox cwd.
export function createRunDir(vendor: string): RunDir {
  const path = mkdtempSync(join(tmpdir(), `rh-${vendor}-`));
  return { path, remove: () => rmSync(path, { recursive: true, force: true }) };
}

export function writeRunFile(dir: RunDir, name: string, content: string): string {
  const path = join(dir.path, name);
  writeFileSync(path, content, { mode: 0o600 });
  return path;
}

// Writes a policy file inside the sandbox. An identical file is left alone; a different one is
// never overwritten (it could be a weaker policy someone else relies on, or a planted one).
export function writePolicyFile(vendor: string, cwd: string, relative: string, content: string) {
  if (!isAbsolute(cwd)) throw new Error(`${vendor} cwd must be absolute: "${cwd}"`);
  if (resolve(cwd) === '/') throw new Error(`${vendor} cwd must not be the filesystem root`);
  const file = join(cwd, relative);
  if (existsSync(file)) {
    if (readFileSync(file, 'utf8') === content) return file;
    throw new Error(`Refusing to overwrite existing ${file}`);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}
