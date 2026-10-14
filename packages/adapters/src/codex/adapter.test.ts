import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFakeCli, type FakeCli } from '../headless/test-support/fake-cli';
import { collect, RUN_INPUT, types } from '../opencode/test-support/collect';
import { CodexAdapter } from './adapter';
import { buildCodexConfig, CODEX_CONFIG_PATH } from './config';

const FIXTURE = join(import.meta.dir, 'test-support/codex.jsonl');

let cli: FakeCli | undefined;
afterEach(() => cli?.scratch.remove());

function setup(body: string): { adapter: CodexAdapter; cli: FakeCli } {
  const fake = createFakeCli('codex', body);
  cli = fake;
  return { adapter: new CodexAdapter({ binary: fake.binary }), cli: fake };
}

test('fixture run: full event sequence, sandbox argv, generated config.toml', async () => {
  const { adapter, cli } = setup(`cat '${FIXTURE}'`);
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }), async (event) => {
    if (event.type === 'permission_request') {
      await adapter.answerPermission('run-1', event.permissionId, 'deny');
    }
  });
  expect(types(events)).toEqual([
    'started',
    'tool:started',
    'tool:completed',
    'tool:started',
    'tool:completed',
    'permission_request',
    'file_change',
    'file_change',
    'tool:started',
    'tool:completed',
    'text',
    'usage',
    'completed',
  ]);
  const argv = cli.argv();
  expect(argv.slice(0, 8)).toEqual([
    'exec',
    '--json',
    '--ephemeral',
    '-C',
    cli.cwd,
    '-s',
    'workspace-write',
    '--ignore-user-config',
  ]);
  expect(argv.at(-1)).toBe('say hello');
  expect(readFileSync(join(cli.cwd, CODEX_CONFIG_PATH), 'utf8')).toBe(buildCodexConfig());
});

test('resume: input.resumeVendorSessionId -> codex exec resume <thread_id>', async () => {
  const { adapter, cli } = setup(`cat '${FIXTURE}'`);
  await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd, resumeVendorSessionId: 'th_9' }));
  expect(cli.argv().slice(0, 3)).toEqual(['exec', 'resume', 'th_9']);
});

test('foreign .codex/config.toml in the sandbox -> single failed event, nothing spawned', async () => {
  const { adapter, cli } = setup(`cat '${FIXTURE}'`);
  Bun.spawnSync(['mkdir', '-p', join(cli.cwd, '.codex')]);
  await Bun.write(join(cli.cwd, CODEX_CONFIG_PATH), 'approval_policy = "never"\n');
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    type: 'failed',
    error: expect.stringContaining('Refusing to overwrite'),
  });
  expect(await Bun.file(cli.argvFile).exists()).toBe(false);
});

test('fake binary exits 2 -> exactly one failed event naming code and stderr', async () => {
  const { adapter, cli } = setup(
    `echo 'not json'\necho 'auth: missing OPENAI_API_KEY' >&2\nexit 2`,
  );
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect<unknown>(events).toEqual([
    { type: 'failed', error: 'codex exited with code 2: auth: missing OPENAI_API_KEY' },
  ]);
});

test('stream error line names the cause when codex exits without a turn result', async () => {
  const { adapter, cli } = setup(`echo '{"type":"error","message":"stream disconnected"}'\nexit 1`);
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect<unknown>(events).toEqual([
    { type: 'failed', error: 'codex exited with code 1: stream disconnected' },
  ]);
});

test('turn.failed -> single failed event even though codex then exits 1', async () => {
  const { adapter, cli } = setup(
    `echo '{"type":"thread.started","thread_id":"t"}'\necho '{"type":"turn.failed","error":{"message":"quota"}}'\nexit 1`,
  );
  const events = await collect(adapter.start({ ...RUN_INPUT, cwd: cli.cwd }));
  expect<unknown>(events).toEqual([
    { type: 'started', vendorSessionId: 't' },
    { type: 'failed', error: 'quota' },
  ]);
});

test('healthcheck: true for a fake binary printing a version, false when missing', async () => {
  const { adapter, cli } = setup('exit 0');
  expect(await adapter.healthcheck()).toBe(true);
  const missing = new CodexAdapter({ binary: join(cli.scratch.path, 'nope') });
  expect(await missing.healthcheck()).toBe(false);
});
