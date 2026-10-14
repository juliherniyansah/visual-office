import { tmpdir } from 'node:os';
import type {
  AdapterEvent,
  AdapterId,
  AdapterRunInput,
  AgentAdapter,
  PermissionDecision,
} from '@redhunter/shared';
import { spawnChild } from '../spawn';
import { runCli } from './run';
import { CANCELLED, HeadlessRun } from './run-state';
import type { HeadlessAdapterOptions, HeadlessVendor } from './types';

export const DEFAULT_HEALTH_TIMEOUT_MS = 5_000;

// One child process per run (codex exec / claude -p). Semantics mirror FakeAdapter/Opencode:
// cancel()/signal abort end the iterator without a terminal event and kill the process group.
export class HeadlessAdapter implements AgentAdapter {
  readonly id: AdapterId;
  readonly #vendor: HeadlessVendor;
  readonly #options: HeadlessAdapterOptions;
  readonly #runs = new Map<string, HeadlessRun>();

  constructor(vendor: HeadlessVendor, options: HeadlessAdapterOptions = {}) {
    this.id = vendor.id;
    this.#vendor = vendor;
    this.#options = options;
  }

  get #binary(): string {
    return this.#options.binary ?? this.#vendor.defaultBinary;
  }

  start(input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    if (this.#runs.has(input.runId)) throw new Error(`Run ${input.runId} is already active`);
    const run = new HeadlessRun();
    this.#runs.set(input.runId, run);
    const onAbort = (): void => void this.#cancelRun(input.runId, run);
    if (input.signal?.aborted) onAbort();
    input.signal?.addEventListener('abort', onAbort, { once: true });
    return this.#iterate(input, run, onAbort);
  }

  async *#iterate(
    input: AdapterRunInput,
    run: HeadlessRun,
    onAbort: () => void,
  ): AsyncGenerator<AdapterEvent> {
    try {
      yield* runCli(run, {
        vendor: this.#vendor,
        binary: this.#binary,
        input,
        ...(this.#options.env === undefined ? {} : { env: this.#options.env }),
      });
    } finally {
      input.signal?.removeEventListener('abort', onAbort);
      if (this.#runs.get(input.runId) === run) this.#runs.delete(input.runId);
    }
  }

  // Headless CLIs have no channel to answer a prompt: with no permission host the vendor has
  // already denied the call when we see it. The human decision is recorded (audit + a future
  // retry with a widened allow-list); the run continues either way. Never 'always'.
  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    const run = this.#runs.get(runId);
    if (run === undefined || !run.pending.delete(permissionId)) {
      throw new Error(`No pending permission ${permissionId} for run ${runId}`);
    }
    run.decisions.set(permissionId, decision);
  }

  // Ends the iterator now; resolves once the child process group is gone. Never throws.
  async cancel(runId: string): Promise<void> {
    const run = this.#runs.get(runId);
    if (run !== undefined) await this.#cancelRun(runId, run);
  }

  async #cancelRun(runId: string, run: HeadlessRun): Promise<void> {
    if (this.#runs.get(runId) === run) this.#runs.delete(runId);
    run.stop(CANCELLED);
    await run.kill().catch(() => undefined);
  }

  // true when `<binary> --version` exits 0 within the timeout; false on missing binary/failure.
  async healthcheck(): Promise<boolean> {
    const timeout = AbortSignal.timeout(this.#options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS);
    try {
      const child = await spawnChild(this.#binary, ['--version'], {
        cwd: tmpdir(),
        signal: timeout,
        ...(this.#options.env === undefined ? {} : { env: this.#options.env }),
      });
      const drained = Promise.all([drain(child.stdout), drain(child.stderr)]);
      const exit = await child.exited;
      await drained;
      return exit.exitCode === 0 && !timeout.aborted;
    } catch {
      return false;
    }
  }
}

async function drain(lines: AsyncIterableIterator<string>): Promise<void> {
  for await (const _line of lines);
}
