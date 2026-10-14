import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConstitutionSource } from './layers';

// Bump together with any edit to constitution.md: the version is part of the snapshot hash.
export const CONSTITUTION_VERSION = 1;
export const CONSTITUTION_PATH = fileURLToPath(new URL('../../constitution.md', import.meta.url));

export type ReadText = (path: string) => string;

const readUtf8: ReadText = (path) => readFileSync(path, 'utf8');

// IO lives here, not in layers.ts: the composer only receives the loaded source.
export function loadConstitution(read: ReadText = readUtf8): ConstitutionSource {
  const text = read(CONSTITUTION_PATH);
  if (text.trim() === '') {
    throw new Error('Constitution is empty');
  }
  return { version: CONSTITUTION_VERSION, text };
}
