// Vendor adapters are exported only as AgentAdapter implementations; vendor SDK types stay inside.
export const PACKAGE_NAME = '@redhunter/adapters';

export {
  buildClaudeArgs,
  buildClaudeSettings,
  ClaudeAdapter,
  ClaudeEventMapper,
  type ClaudeSettings,
} from './claude';
export {
  buildCodexArgs,
  buildCodexConfig,
  CODEX_CONFIG_PATH,
  CodexAdapter,
  CodexEventMapper,
} from './codex';
export { FakeAdapter, type FakeAdapterOptions, type FakeStep } from './fake';
export type { HeadlessAdapterOptions } from './headless/types';
export {
  buildServerConfig,
  DEFAULT_AGENT_NAME,
  DEFAULT_SERVER_TIMEOUT_MS,
  type LaunchServer,
  type LaunchServerOptions,
  launchServer,
  OpencodeAdapter,
  type OpencodeAdapterOptions,
  OpencodeEventMapper,
  type ServerHandle,
} from './opencode';
export {
  type ChildExit,
  type ChildHandle,
  DEFAULT_ENV_ALLOW_LIST,
  DEFAULT_KILL_GRACE_MS,
  FORBIDDEN_ENV_NAMES,
  type SetTimer,
  SpawnError,
  type SpawnErrorCode,
  type SpawnOptions,
  spawnChild,
} from './spawn';
export { type CrashRetryOptions, withCrashRetry } from './crash-retry';
