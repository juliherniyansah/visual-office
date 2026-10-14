import { afterAll, afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchServer } from './server';
import { createScratchDir, isProcessAlive, writeFakeBinary } from './test-support/fake-binary';

const scratch = createScratchDir();
afterAll(() => scratch.remove());

const LISTEN = 'echo "opencode server listening on http://127.0.0.1:4999"';
const SECRET_NAME = 'RH_T11_PARENT_SECRET';
const CONFIG = { agent: { build: { permission: { edit: 'ask' as const } } } };

afterEach(() => {
  delete process.env[SECRET_NAME];
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});

function readOut(name: string): string {
  return readFileSync(join(scratch.path, name), 'utf8');
}

test('resolves the url from the listening line and passes args + config, with allow-listed env', async () => {
  process.env[SECRET_NAME] = 'leak';
  process.env.ANTHROPIC_AUTH_TOKEN = 'leak';
  const binary = writeFakeBinary(
    scratch.path,
    'ok.sh',
    `echo "$@" > "$OUT_DIR/args"; env > "$OUT_DIR/env"; echo $$ > "$OUT_DIR/pid"\nprintf 'Warning: unsecured\\n'\n${LISTEN}\nexec sleep 30`,
  );
  const server = await launchServer({
    binary,
    cwd: scratch.path,
    config: CONFIG,
    env: {
      OUT_DIR: scratch.path,
      OPENAI_API_KEY: 'vendor-key',
      WEBSOCKET_AUTH_FILE_DESCRIPTOR: '3',
    },
  });
  try {
    expect(server.url).toBe('http://127.0.0.1:4999');
    expect(readOut('args').trim()).toBe('serve --hostname=127.0.0.1 --port=0');
    const env = readOut('env');
    expect(env).toContain(`OPENCODE_CONFIG_CONTENT=${JSON.stringify(CONFIG)}`);
    expect(env).toContain('OPENAI_API_KEY=vendor-key');
    expect(env).not.toContain(SECRET_NAME);
    expect(env).not.toContain('ANTHROPIC_AUTH_TOKEN');
    expect(env).not.toContain('WEBSOCKET_AUTH_FILE_DESCRIPTOR');
  } finally {
    await server.close();
  }
  expect(isProcessAlive(Number(readOut('pid')))).toBe(false);
});

test('close() is idempotent', async () => {
  const binary = writeFakeBinary(scratch.path, 'idem.sh', `${LISTEN}\nexec sleep 30`);
  const server = await launchServer({ binary, cwd: scratch.path, config: {} });
  await server.close();
  await server.close();
});

test('explicit config env cannot be overridden by opts.env', async () => {
  const binary = writeFakeBinary(
    scratch.path,
    'cfg.sh',
    `echo "$OPENCODE_CONFIG_CONTENT" > "$OUT_DIR/cfg"\n${LISTEN}\nexec sleep 30`,
  );
  const server = await launchServer({
    binary,
    cwd: scratch.path,
    config: CONFIG,
    env: { OUT_DIR: scratch.path, OPENCODE_CONFIG_CONTENT: '{"permission":{"bash":"allow"}}' },
  });
  await server.close();
  expect(readOut('cfg').trim()).toBe(JSON.stringify(CONFIG));
});

test('rejects with a timeout error and kills the child when no listening line arrives', async () => {
  const binary = writeFakeBinary(
    scratch.path,
    'mute.sh',
    `echo $$ > "$OUT_DIR/mute-pid"\nexec sleep 30`,
  );
  const launching = launchServer({
    binary,
    cwd: scratch.path,
    config: {},
    env: { OUT_DIR: scratch.path },
    timeoutMs: 300,
  });
  await expect(launching).rejects.toThrow('Timeout waiting for opencode server after 300ms');
  expect(isProcessAlive(Number(readOut('mute-pid')))).toBe(false);
});

test('rejects with exit code and output tail when the server exits before listening', async () => {
  const binary = writeFakeBinary(scratch.path, 'boom.sh', 'echo "bad config" >&2\nexit 3');
  const launching = launchServer({ binary, cwd: scratch.path, config: {} });
  await expect(launching).rejects.toThrow(/exited with code 3[\s\S]*bad config/);
});

test('missing binary rejects with SpawnError not_found', async () => {
  const launching = launchServer({
    binary: join(scratch.path, 'nope'),
    cwd: scratch.path,
    config: {},
  });
  await expect(launching).rejects.toMatchObject({ name: 'SpawnError', code: 'not_found' });
});
