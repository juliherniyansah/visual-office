import type { LaunchServerOptions, ServerHandle } from './server';

export type LaunchServer = (options: LaunchServerOptions) => Promise<ServerHandle>;

export interface OpencodeAdapterOptions {
  // Existing server: nothing is spawned and dispose() leaves it running.
  readonly baseUrl?: string;
  // Spawned server only. Default 'opencode' from the allow-listed PATH.
  readonly binary?: string;
  // Server process cwd; each run still scopes its session to `input.cwd`. Default os.tmpdir().
  readonly serverCwd?: string;
  // Agent that runs prompts and carries the sandbox permission. Default DEFAULT_AGENT_NAME.
  readonly agentName?: string;
  // Vendor keys for the server process; merged over the spawn allow-list (plan s13).
  readonly env?: Readonly<Record<string, string>>;
  readonly serverTimeoutMs?: number;
  // Test seam; default launchServer.
  readonly launch?: LaunchServer;
}
