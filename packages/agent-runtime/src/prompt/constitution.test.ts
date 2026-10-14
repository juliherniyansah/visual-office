import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { makeInput } from '../test-support/prompt-input';
import { composePrompt } from './composer';
import { CONSTITUTION_PATH, CONSTITUTION_VERSION, loadConstitution } from './constitution';

const SECURITY_SENTENCE = 'prompt rules are not security boundaries';

describe('constitution.md', () => {
  test('lives at packages/agent-runtime/constitution.md (absolute path)', () => {
    expect(isAbsolute(CONSTITUTION_PATH)).toBe(true);
    expect(CONSTITUTION_PATH.endsWith('/packages/agent-runtime/constitution.md')).toBe(true);
  });

  test('version 1 file says prompt rules are not security boundaries', () => {
    expect(CONSTITUTION_VERSION).toBe(1);
    expect(readFileSync(CONSTITUTION_PATH, 'utf8')).toContain(SECURITY_SENTENCE);
  });
});

describe('loadConstitution', () => {
  test('default loader reads the file verbatim and tags the version', () => {
    const source = loadConstitution();
    expect(source).toEqual({ version: 1, text: readFileSync(CONSTITUTION_PATH, 'utf8') });
    expect(source.text).toContain(SECURITY_SENTENCE);
  });

  test('injected reader receives the constitution path', () => {
    const paths: string[] = [];
    const source = loadConstitution((path) => {
      paths.push(path);
      return 'custom constitution';
    });
    expect(paths).toEqual([CONSTITUTION_PATH]);
    expect(source).toEqual({ version: CONSTITUTION_VERSION, text: 'custom constitution' });
  });

  test.each(['', '  \n\t'])('rejects an empty constitution %p', (text) => {
    expect(() => loadConstitution(() => text)).toThrow('Constitution is empty');
  });
});

describe('constitution in the composed prompt', () => {
  test('layer 1 carries the loaded text and version', () => {
    const composed = composePrompt(makeInput({ constitution: loadConstitution() }));
    expect(composed.layers[0]).toMatchObject({ id: 'constitution', version: CONSTITUTION_VERSION });
    expect(composed.text.startsWith(`## 1. Constitution\n${loadConstitution().text}\n`)).toBe(true);
    expect(composed.text).toContain(SECURITY_SENTENCE);
  });

  test('the real constitution adds no "## " layer-level headers', () => {
    const composed = composePrompt(makeInput({ constitution: loadConstitution() }));
    const headers = composed.text.split('\n').filter((line) => line.startsWith('## '));
    expect(headers).toHaveLength(9);
    expect(headers[1]).toBe('## 2. Identity');
  });
});
