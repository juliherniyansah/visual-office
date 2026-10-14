import { tmpdir } from 'node:os';
import type {
  AdapterEvent,
  AdapterId,
  AdapterRunInput,
  AgentAdapter,
  PermissionDecision,
} from '@redhunter/shared';
import { errorText, fetchVersion } from './client';
import { buildServerConfig, DEFAULT_AGENT_NAME } from './config';
import { runEvents } from './run';
import { CANCELLED, OpencodeRun } from './run-state';
import { launchServer, type ServerHandle } from './server';
import type { OpencodeAdapterOptions } from './types';

// One `opencode serve` per adapter instance (lazy, shared by all runs, closed by dispose()).
// Semantics mirror FakeAdapter: permission_request waits for answerPermission(); deny emits
// `failed` "Permission <id> denied"; cancel()/signal abort end the iterator without a terminal event.
export class OpencodeAdapter implements AgentAdapter {
  readonly id: AdapterId = 'opencode';
  readonly #options: OpencodeAdapterOptions;
  readonly #agentName: string;
  readonly #runs = new Map<string, OpencodeRun>();
  #server: Promise<ServerHandle> | undefined;

  constructor(options: OpencodeAdapterOptions = {}) {
    this.#options = options;
    this.#agentName = options.agentName ?? DEFAULT_AGENT_NAME;
  }

  start(input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    if (this.#runs.has(input.runId)) throw new Error(`Run ${input.runId} is already active`);
    const run = new OpencodeRun();
    this.#runs.set(input.runId, run);
    const onAbort = (): void => void this.#cancelRun(input.runId, run);
    if (input.signal?.aborted) onAbort();
    input.signal?.addEventListener('abort', onAbort, { once: true });
    return this.#iterate(input, run, onAbort);
  }

  async *#iterate(
    input: AdapterRunInput,
    run: OpencodeRun,
    onAbort: () => void,
  ): AsyncGenerator<AdapterEvent> {
    try {
      yield* runEvents(run, {
        input,
        agentName: this.#agentName,
        serverUrl: () => this.#serverUrl(),
      });
    } finally {
      input.signal?.removeEventListener('abort', onAbort);
      if (this.#runs.get(input.runId) === run) this.#runs.delete(input.runId);
    }
  }

  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    const run = this.#runs.get(runId);
    if (run === undefined || !run.pending.delete(permissionId)) {
      throw new Error(`No pending permission ${permissionId} for run ${runId}`);
    }
    await run.reply(permissionId, decision);
  }

  // Ends the iterator now; the server-side session abort is awaited but never throws.
  async cancel(runId: string): Promise<void> {
    const run = this.#runs.get(runId);
    if (run !== undefined) await this.#cancelRun(runId, run);
  }

  // Frees the runId at once (FakeAdapter parity), so a retry can start before the old
  // iterator has drained.
  async #cancelRun(runId: string, run: OpencodeRun): Promise<void> {
    if (this.#runs.get(runId) === run) this.#runs.delete(runId);
    run.stop(CANCELLED);
    await run.abortSession().catch(() => undefined);
  }

  // Resolves the server version; rejects "opencode healthcheck failed: <reason>" when unreachable.
  async healthcheck(): Promise<string> {
    try {
      return await fetchVersion(await this.#serverUrl());
    } catch (error) {
      throw new Error(`opencode healthcheck failed: ${errorText(error)}`, { cause: error });
    }
  }

  // Stops active runs and the spawned server (an external baseUrl server is left running).
  async dispose(): Promise<void> {
    await Promise.all([...this.#runs.keys()].map((runId) => this.cancel(runId)));
    const server = this.#server;
    this.#server = undefined;
    if (server !== undefined)
      await server.then(
        (handle) => handle.close(),
        () => undefined,
      );
  }

  async #serverUrl(): Promise<string> {
    if (this.#options.baseUrl !== undefined) return this.#options.baseUrl;
    this.#server ??= this.#launch();
    try {
      return (await this.#server).url;
    } catch (error) {
      // A failed launch is not cached: the next run retries.
      this.#server = undefined;
      throw new Error(`opencode server failed to start: ${errorText(error)}`, { cause: error });
    }
  }

  #launch(): Promise<ServerHandle> {
    const options = this.#options;
    return (options.launch ?? launchServer)({
      cwd: options.serverCwd ?? tmpdir(),
      config: buildServerConfig(this.#agentName),
      ...(options.binary === undefined ? {} : { binary: options.binary }),
      ...(options.env === undefined ? {} : { env: options.env }),
      ...(options.serverTimeoutMs === undefined ? {} : { timeoutMs: options.serverTimeoutMs }),
    });
  }
}
