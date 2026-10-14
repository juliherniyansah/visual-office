import { afterEach, expect, test } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createScratchDir, type ScratchDir } from '../opencode/test-support/fake-binary';
import {
  buildCodexArgs,
  buildCodexConfig,
  CODEX_CONFIG_PATH,
  prepareCodexRun,
  writeCodexConfig,
} from './config';

let scratch: ScratchDir | undefined;
afterEach(() => scratch?.remove());

const EXPECTED_TOML = 'approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n';
const FORBIDDEN = ['--yolo', '--dangerously-bypass-approvals-and-sandbox', 'danger-full-access'];

test('generated config.toml carries the section 13 policy', () => {
  expect(buildCodexConfig()).toBe(EXPECTED_TOML);
  expect(CODEX_CONFIG_PATH).toBe('.codex/config.toml');
});

test('argv: exact plan flags, prompt last, never a bypass flag', () => {
  const argv = buildCodexArgs({ cwd: '/w', outputFile: '/t/out.txt', prompt: 'do it' });
  expect(argv).toEqual([
    'exec',
    '--json',
    '--ephemeral',
    '-C',
    '/w',
    '-s',
    'workspace-write',
    '--ignore-user-config',
    '-o',
    '/t/out.txt',
    'do it',
  ]);
  expect(argv.some((arg) => FORBIDDEN.some((flag) => arg.includes(flag)))).toBe(false);
});

test('argv: --output-schema only when a schema file is given', () => {
  const argv = buildCodexArgs({ cwd: '/w', outputFile: '/o', schemaFile: '/s.json', prompt: 'p' });
  expect(argv.slice(-3)).toEqual(['--output-schema', '/s.json', 'p']);
});

test('resume argv: codex exec resume <thread_id> with the same sandbox flags', () => {
  const argv = buildCodexArgs({ cwd: '/w', outputFile: '/o', prompt: 'next', resumeId: 'th_1' });
  expect(argv.slice(0, 3)).toEqual(['exec', 'resume', 'th_1']);
  expect(argv).toContain('workspace-write');
  expect(argv.at(-1)).toBe('next');
});

test('a prompt starting with "-" is passed after "--" so it is never read as a flag', () => {
  const argv = buildCodexArgs({ cwd: '/w', outputFile: '/o', prompt: '--yolo' });
  expect(argv.slice(-2)).toEqual(['--', '--yolo']);
});

test('writeCodexConfig writes once, is idempotent, and refuses to clobber a foreign file', () => {
  scratch = createScratchDir();
  const file = join(scratch.path, CODEX_CONFIG_PATH);
  writeCodexConfig(scratch.path);
  writeCodexConfig(scratch.path);
  expect(readFileSync(file, 'utf8')).toBe(EXPECTED_TOML);
  writeFileSync(file, 'approval_policy = "never"\n');
  expect(() => writeCodexConfig(scratch?.path ?? '')).toThrow(
    `Refusing to overwrite existing ${file}`,
  );
  expect(readFileSync(file, 'utf8')).toBe('approval_policy = "never"\n');
});

test('writeCodexConfig rejects the filesystem root and relative paths', () => {
  expect(() => writeCodexConfig('/')).toThrow('codex cwd must not be the filesystem root');
  expect(() => writeCodexConfig('rel')).toThrow('codex cwd must be absolute');
});

test('prepareCodexRun: temp files hold the schema; cleanup removes them', async () => {
  scratch = createScratchDir();
  const launch = await prepareCodexRun({
    runId: 'r',
    agentId: 'programming',
    cwd: scratch.path,
    prompt: 'p',
    outputSchema: { type: 'object' },
  });
  const schemaFile = launch.args[launch.args.indexOf('--output-schema') + 1] ?? '';
  expect(JSON.parse(readFileSync(schemaFile, 'utf8'))).toEqual({ type: 'object' });
  launch.cleanup();
  launch.cleanup();
  expect(existsSync(schemaFile)).toBe(false);
  expect(existsSync(join(scratch.path, CODEX_CONFIG_PATH))).toBe(true);
});
