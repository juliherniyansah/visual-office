import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildClaudeArgs,
  buildClaudeSettings,
  CLAUDE_TASK_QUERY,
  DEFAULT_MAX_TURNS,
  prepareClaudeRun,
} from './settings';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const POLICY = {
  maxRetries: 1,
  maxTurns: 7,
  budgetTokens: 1000,
  allowedTools: ['edit'],
  escalationChain: [],
};

test('generated settings.json: allow/ask/deny per section 13, rm -rf denied', () => {
  expect<unknown>(buildClaudeSettings()).toEqual({
    permissions: {
      allow: ['Bash(bun test*)', 'Bash(git status*)'],
      ask: ['Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'],
      deny: ['Bash(rm -rf*)', 'WebFetch'],
      defaultMode: 'default',
    },
  });
});

test('each call returns a fresh settings object', () => {
  buildClaudeSettings().permissions.deny.pop();
  expect(buildClaudeSettings().permissions.deny).toContain('Bash(rm -rf*)');
});

test('argv: exact plan section 8 + section 13 flags, query last', () => {
  const argv = buildClaudeArgs({
    maxTurns: 5,
    sessionId: UUID,
    settingsFile: '/t/settings.json',
    systemPromptFile: '/t/prompt.md',
  });
  expect(argv).toEqual([
    '-p',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'default',
    '--permission-prompts',
    'all',
    '--max-turns',
    '5',
    '--session-id',
    UUID,
    '--settings',
    '/t/settings.json',
    '--append-system-prompt-file',
    '/t/prompt.md',
    '--disallowedTools',
    'Bash(rm -rf*)',
    CLAUDE_TASK_QUERY,
  ]);
  expect(argv.some((arg) => arg.includes('dangerously') || arg === 'bypassPermissions')).toBe(
    false,
  );
});

test('prepareClaudeRun: prompt and settings in temp files, uuid session, policy max turns', async () => {
  const input = { runId: 'r', agentId: 'programming' as const, cwd: '/w', prompt: '--yolo task' };
  const launch = await prepareClaudeRun({ ...input, policy: POLICY });
  const arg = (flag: string): string => launch.args[launch.args.indexOf(flag) + 1] ?? '';
  expect(readFileSync(arg('--append-system-prompt-file'), 'utf8')).toBe('--yolo task');
  expect(JSON.parse(readFileSync(arg('--settings'), 'utf8'))).toEqual(buildClaudeSettings());
  expect(arg('--max-turns')).toBe('7');
  expect(arg('--session-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-/);
  // The composed prompt never reaches argv (no flag injection, no ps leak).
  expect(launch.args).not.toContain('--yolo task');
  launch.cleanup();
  launch.cleanup();
  expect(existsSync(arg('--settings'))).toBe(false);
  const plain = await prepareClaudeRun(input);
  expect(plain.args[plain.args.indexOf('--max-turns') + 1]).toBe(String(DEFAULT_MAX_TURNS));
  plain.cleanup();
});
