import { afterEach, expect, test } from 'bun:test';
import { join } from 'node:path';
import { createFakeCli, type FakeCli } from '../headless/test-support/fake-cli';
import { collect, RUN_INPUT, types } from '../opencode/test-support/collect';
import { ClaudeAdapter } from './adapter';
import { buildClaudeSettings, CLAUDE_TASK_QUERY } from './settings';

const FIXTURE = join(import.meta.dir, 'test-support/claude.stream.jsonl');

let cli: FakeCli | undefined;
afterEach(() => cli?.scratch.remove());

function setup(
  body: string,
  env?: Record<string, string>,
): { adapter: ClaudeAdapter; cli: FakeCli } {
  const fake = createFakeCli('claude', body);
  cli = fake;
  return {
    adapter: new ClaudeAdapter({ binary: fake.binary, ...(env === undefined ? {} : { env }) }),
    cli: fake,
  };
}

test('fixture run: full sequence, finalText from result, stdin closed, argv policy', async () => {
  const { adapter, cli } = setup(`cat '${FIXTURE}'`);
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }), async (event) => {
    if (event.type === 'permission_request') {
      await adapter.answerPermission('run-1', event.permissionId, 'allow');
    }
  });
  expect(types(events)).toEqual([
    'started',
    'text',
    'tool:started',
    'tool:completed',
    'file_change',
    'tool:started',
    'permission_request',
    'tool:completed',
    'text',
    'usage',
    'completed',
  ]);
  expect(events.at(-1)).toMatchObject({ finalText: 'Typo fixed in src/a.ts.' });
  expect(await Bun.file(cli.stdinFile).text()).toBe('closed\n');
  const argv = cli.argv();
  const settingsFile = argv[argv.indexOf('--settings') + 1] ?? '';
  expect(argv.slice(0, 7)).toEqual([
    '-p',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'default',
    '--permission-prompts',
    'all',
  ]);
  expect(argv.slice(-3)).toEqual(['--disallowedTools', 'Bash(rm -rf*)', CLAUDE_TASK_QUERY]);
  // Temp settings/prompt files are removed once the run ends.
  expect(await Bun.file(settingsFile).exists()).toBe(false);
  expect(buildClaudeSettings().permissions.deny).toContain('Bash(rm -rf*)');
});

test('env: only opts.env + allow-list reach the child; forbidden names stripped', async () => {
  const { adapter, cli } = setup(`cat '${FIXTURE}'`, {
    ANTHROPIC_API_KEY: 'k1',
    ANTHROPIC_AUTH_TOKEN: 'leak',
    WEBSOCKET_AUTH_FILE_DESCRIPTOR: '3',
  });
  process.env.RH_T12_PARENT_SECRET = 'parent';
  try {
    await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  } finally {
    delete process.env.RH_T12_PARENT_SECRET;
  }
  const env = cli.env();
  expect(env).toContain('ANTHROPIC_API_KEY=k1');
  expect(env).not.toContain('ANTHROPIC_AUTH_TOKEN');
  expect(env).not.toContain('WEBSOCKET_AUTH_FILE_DESCRIPTOR');
  expect(env).not.toContain('RH_T12_PARENT_SECRET');
});

test('fake binary exits 2 -> exactly one failed event', async () => {
  const { adapter, cli } = setup('exit 2');
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect<unknown>(events).toEqual([{ type: 'failed', error: 'claude exited with code 2' }]);
});

test('clean exit 0 without a result line is still a failure', async () => {
  const { adapter, cli } = setup(`head -n 2 '${FIXTURE}'`);
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect(types(events)).toEqual(['started', 'text', 'tool:started', 'failed']);
  expect(events.at(-1)).toMatchObject({ error: 'claude exited before finishing the run' });
});

test('missing binary -> single failed event and healthcheck false', async () => {
  const fake = createFakeCli('claude', 'exit 0');
  cli = fake;
  const adapter = new ClaudeAdapter({ binary: join(fake.scratch.path, 'missing') });
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: fake.cwd }));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'failed', error: expect.stringContaining('not found') });
  expect(await adapter.healthcheck()).toBe(false);
});

test('healthcheck: true on version, false on nonzero --version and on timeout', async () => {
  const ok = setup('exit 0');
  expect(await ok.adapter.healthcheck()).toBe(true);
  const bad = createFakeCli('claude-bad', 'exit 0', "x' ; exit 3 ; echo '");
  const slow = createFakeCli('claude-slow', 'exit 0', "x' ; sleep 5 ; echo '");
  try {
    expect(await new ClaudeAdapter({ binary: bad.binary }).healthcheck()).toBe(false);
    const slowAdapter = new ClaudeAdapter({ binary: slow.binary, healthTimeoutMs: 100 });
    expect(await slowAdapter.healthcheck()).toBe(false);
  } finally {
    bad.scratch.remove();
    slow.scratch.remove();
  }
});
