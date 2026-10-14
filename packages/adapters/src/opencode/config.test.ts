import { expect, test } from 'bun:test';
import { buildServerConfig, DEFAULT_AGENT_NAME } from './config';

const SANDBOX = {
  edit: 'ask',
  bash: { '*': 'ask', 'bun test*': 'allow', 'git status*': 'allow' },
  webfetch: 'deny',
  external_directory: 'deny',
};

test('sandbox permission (plan s13) is set on the run agent and as the global default', () => {
  expect<unknown>(buildServerConfig('worker')).toEqual({
    permission: SANDBOX,
    agent: { worker: { permission: SANDBOX } },
  });
});

test('default agent is the built-in primary agent', () => {
  expect(DEFAULT_AGENT_NAME).toBe('build');
  expect(Object.keys(buildServerConfig(DEFAULT_AGENT_NAME).agent ?? {})).toEqual(['build']);
});

test('each call returns a fresh config, callers cannot mutate the shared policy', () => {
  const first = buildServerConfig('a');
  const bash = first.permission?.bash;
  if (typeof bash === 'object') bash['rm*'] = 'allow';
  expect<unknown>(buildServerConfig('a').permission?.bash).toEqual(SANDBOX.bash);
});
