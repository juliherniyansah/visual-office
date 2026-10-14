import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_ENV_ALLOW_LIST,
  FORBIDDEN_ENV_NAMES,
  SpawnError,
  type SpawnOptions,
  spawnChild,
} from './spawn';

const WORK_DIR = mkdtempSync(join(tmpdir(), 'rh-t8-env-'));
const PARENT_VALUES: Record<string, string> = {
  HOME: '/t8/home',
  LANG: 'C.UTF-8',
  TERM: 'dumb',
  TMPDIR: '/t8/tmp',
  ANTHROPIC_AUTH_TOKEN: 'parent-token',
  WEBSOCKET_AUTH_FILE_DESCRIPTOR: '3',
  anthropic_auth_token: 'parent-lower',
  T8_PARENT_ONLY: 'must-not-leak',
};
const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const [name, value] of Object.entries(PARENT_VALUES)) {
    saved.set(name, process.env[name]);
    process.env[name] = value;
  }
});

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  saved.clear();
});

afterAll(() => rmSync(WORK_DIR, { recursive: true, force: true }));

async function childEnv(options: Omit<SpawnOptions, 'cwd'>): Promise<Record<string, string>> {
  const child = await spawnChild('env', [], { cwd: WORK_DIR, ...options });
  const lines: string[] = [];
  for await (const line of child.stdout) lines.push(line);
  expect(await child.exited).toEqual({ exitCode: 0, signal: null });
  return Object.fromEntries(
    lines.map((line) => [line.split('=')[0], line.slice(line.indexOf('=') + 1)]),
  );
}

describe('spawnChild env allow-list', () => {
  test('default allow-list is PATH, HOME, LANG, TERM, TMPDIR', () => {
    expect(DEFAULT_ENV_ALLOW_LIST).toEqual(['PATH', 'HOME', 'LANG', 'TERM', 'TMPDIR']);
    expect(FORBIDDEN_ENV_NAMES).toEqual(['ANTHROPIC_AUTH_TOKEN', 'WEBSOCKET_AUTH_FILE_DESCRIPTOR']);
  });

  test('child gets only allow-listed parent vars', async () => {
    expect(await childEnv({})).toEqual({
      PATH: process.env.PATH ?? '',
      HOME: '/t8/home',
      LANG: 'C.UTF-8',
      TERM: 'dumb',
      TMPDIR: '/t8/tmp',
    });
  });

  test('skips allow-listed vars the parent does not have', async () => {
    delete process.env.LANG;
    delete process.env.TMPDIR;
    expect(Object.keys(await childEnv({})).sort()).toEqual(['HOME', 'PATH', 'TERM']);
  });

  test('explicit env adds vars and overrides inherited values', async () => {
    const env = await childEnv({ env: { T8_EXTRA: 'extra', LANG: 'override' } });
    expect(env.T8_EXTRA).toBe('extra');
    expect(env.LANG).toBe('override');
    expect(env.T8_PARENT_ONLY).toBeUndefined();
  });
});

describe('spawnChild forbidden env (leak test)', () => {
  test('strips forbidden vars set in the parent and in explicit env, any case', async () => {
    const env = await childEnv({
      env: {
        ANTHROPIC_AUTH_TOKEN: 'explicit-token',
        WEBSOCKET_AUTH_FILE_DESCRIPTOR: '4',
        anthropic_auth_token: 'explicit-lower',
        Websocket_Auth_File_Descriptor: '5',
        T8_EXTRA: 'extra',
      },
    });
    const leaked = Object.keys(env).filter((name) =>
      FORBIDDEN_ENV_NAMES.some((forbidden) => forbidden === name.toUpperCase()),
    );
    expect(leaked).toEqual([]);
    expect(env.T8_EXTRA).toBe('extra');
    expect(env.HOME).toBe('/t8/home');
  });

  test.each([
    ['name with =', { 'ANTHROPIC_AUTH_TOKEN=smuggled': 'x' }],
    ['empty name', { '': 'x' }],
    ['name with NUL', { 'A\0B': 'x' }],
    ['name starting with a digit', { '1ABC': 'x' }],
  ])('rejects explicit env %s before spawning', async (_label, env) => {
    const marker = join(WORK_DIR, `marker-${crypto.randomUUID()}`);
    const error = await spawnChild('touch', [marker], { cwd: WORK_DIR, env }).catch((e) => e);
    expect(error).toBeInstanceOf(SpawnError);
    expect(error.code).toBe('invalid_env');
    expect(existsSync(marker)).toBe(false);
  });

  test('rejects an explicit env value with NUL before spawning', async () => {
    const error = await spawnChild('true', [], { cwd: WORK_DIR, env: { T8: 'a\0b' } }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(SpawnError);
    expect(error.code).toBe('invalid_env');
  });
});
