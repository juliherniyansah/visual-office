import type { AgentConfig, Config } from '@opencode-ai/sdk';

// Built-in primary agent of `opencode serve`; the sandbox policy is attached to it per run.
export const DEFAULT_AGENT_NAME = 'build';

type PermissionPolicy = NonNullable<AgentConfig['permission']>;

// Plan section 13 sandbox. Prompt rules are not a security boundary: this config is.
function sandboxPermission(): PermissionPolicy {
  return {
    edit: 'ask',
    bash: { '*': 'ask', 'bun test*': 'allow', 'git status*': 'allow' },
    webfetch: 'deny',
    external_directory: 'deny',
  };
}

// Also set as the global default so subagents spawned via the task tool inherit the sandbox.
export function buildServerConfig(agentName: string): Config {
  return {
    permission: sandboxPermission(),
    agent: { [agentName]: { permission: sandboxPermission() } },
  };
}
