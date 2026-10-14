import { expect, test } from 'bun:test';
import * as fake from './fake';
import {
  DEFAULT_ENV_ALLOW_LIST,
  DEFAULT_KILL_GRACE_MS,
  FakeAdapter,
  FORBIDDEN_ENV_NAMES,
  PACKAGE_NAME,
  SpawnError,
  spawnChild,
} from './index';
import * as opencode from './opencode';
import * as opencodeAdapter from './opencode/adapter';
import * as spawn from './spawn';

test('barrel re-exports the opencode adapter surface', async () => {
  const barrel = await import('./index');
  expect(barrel.OpencodeAdapter).toBe(opencodeAdapter.OpencodeAdapter);
  expect(opencode.OpencodeAdapter).toBe(opencodeAdapter.OpencodeAdapter);
  expect(barrel.buildServerConfig).toBe(opencode.buildServerConfig);
  expect(barrel.launchServer).toBe(opencode.launchServer);
  expect(barrel.OpencodeEventMapper).toBe(opencode.OpencodeEventMapper);
  expect(barrel.DEFAULT_AGENT_NAME).toBe('build');
  expect(barrel.DEFAULT_SERVER_TIMEOUT_MS).toBe(opencode.DEFAULT_SERVER_TIMEOUT_MS);
});

test('barrel re-exports the codex and claude adapter surfaces', async () => {
  const barrel = await import('./index');
  const codex = await import('./codex');
  const claude = await import('./claude');
  expect(barrel.CodexAdapter).toBe(codex.CodexAdapter);
  expect(barrel.CodexEventMapper).toBe(codex.CodexEventMapper);
  expect(barrel.buildCodexConfig).toBe(codex.buildCodexConfig);
  expect(barrel.buildCodexArgs).toBe(codex.buildCodexArgs);
  expect(barrel.CODEX_CONFIG_PATH).toBe('.codex/config.toml');
  expect(barrel.ClaudeAdapter).toBe(claude.ClaudeAdapter);
  expect(barrel.ClaudeEventMapper).toBe(claude.ClaudeEventMapper);
  expect(barrel.buildClaudeSettings).toBe(claude.buildClaudeSettings);
  expect(barrel.buildClaudeArgs).toBe(claude.buildClaudeArgs);
  expect(new barrel.CodexAdapter().id).toBe('codex');
  expect(new barrel.ClaudeAdapter().id).toBe('claude');
});

test('barrel re-exports the fake adapter and spawn util', () => {
  expect(PACKAGE_NAME).toBe('@redhunter/adapters');
  expect(FakeAdapter).toBe(fake.FakeAdapter);
  expect(spawnChild).toBe(spawn.spawnChild);
  expect(SpawnError).toBe(spawn.SpawnError);
  expect(DEFAULT_ENV_ALLOW_LIST).toBe(spawn.DEFAULT_ENV_ALLOW_LIST);
  expect(FORBIDDEN_ENV_NAMES).toBe(spawn.FORBIDDEN_ENV_NAMES);
  expect(DEFAULT_KILL_GRACE_MS).toBe(spawn.DEFAULT_KILL_GRACE_MS);
});
