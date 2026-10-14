import type {
  AdapterEvent,
  AdapterId,
  AdapterRunInput,
  AgentAdapter,
  PermissionDecision,
} from '@redhunter/shared';

export type FakeStep = AdapterEvent | { readonly event: AdapterEvent; readonly delayMs: number };

export interface FakeAdapterOptions {
  readonly script: readonly FakeStep[];
  readonly id?: AdapterId;
  // Used for delayed steps only; a script without delays never touches a timer.
  readonly sleep?: (ms: number) => Promise<void>;
}

const CANCELLED = 'cancelled';

interface FakeRun {
  readonly cancelled: Promise<typeof CANCELLED>;
  readonly cancel: () => void;
  isCancelled: boolean;
  pending?: { readonly permissionId: string; readonly resolve: (d: PermissionDecision) => void };
}

function createRun(): FakeRun {
  const { promise, resolve } = Promise.withResolvers<typeof CANCELLED>();
  const run: FakeRun = {
    cancelled: promise,
    isCancelled: false,
    cancel: () => {
      run.isCancelled = true;
      resolve(CANCELLED);
    },
  };
  return run;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scripted adapter for runtime tests. A `permission_request` pauses replay until
// answerPermission(); anything but 'allow' emits `failed` and ends the run (fail closed).
// cancel() or input.signal abort ends the iterator without a terminal event.
export class FakeAdapter implements AgentAdapter {
  readonly id: AdapterId;
  readonly #script: readonly FakeStep[];
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #runs = new Map<string, FakeRun>();

  constructor(options: FakeAdapterOptions) {
    this.id = options.id ?? 'opencode';
    this.#script = options.script;
    this.#sleep = options.sleep ?? defaultSleep;
  }

  start(input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    if (this.#runs.has(input.runId)) throw new Error(`Run ${input.runId} is already active`);
    const run = createRun();
    this.#runs.set(input.runId, run);
    const onAbort = () => this.#stop(input.runId, run);
    if (input.signal?.aborted) onAbort();
    input.signal?.addEventListener('abort', onAbort, { once: true });
    return this.#replay(input.runId, run, () =>
      input.signal?.removeEventListener('abort', onAbort),
    );
  }

  async *#replay(runId: string, run: FakeRun, cleanup: () => void): AsyncGenerator<AdapterEvent> {
    try {
      for (const step of this.#script) {
        if ('event' in step && (await race(run, this.#sleep(step.delayMs))) === CANCELLED) return;
        const event = 'event' in step ? step.event : step;
        if (run.isCancelled) return;
        if (event.type !== 'permission_request') {
          yield event;
          continue;
        }
        const decision = new Promise<PermissionDecision>((resolve) => {
          run.pending = { permissionId: event.permissionId, resolve };
        });
        yield event;
        const answer = await race(run, decision);
        if (answer === CANCELLED) return;
        if (answer !== 'allow') {
          yield { type: 'failed', error: `Permission ${event.permissionId} denied` };
          return;
        }
      }
    } finally {
      cleanup();
      this.#stop(runId, run);
    }
  }

  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    const run = this.#runs.get(runId);
    const pending = run?.pending;
    if (run === undefined || pending?.permissionId !== permissionId) {
      throw new Error(`No pending permission ${permissionId} for run ${runId}`);
    }
    run.pending = undefined;
    pending.resolve(decision);
  }

  async cancel(runId: string): Promise<void> {
    const run = this.#runs.get(runId);
    if (run !== undefined) this.#stop(runId, run);
  }

  #stop(runId: string, run: FakeRun): void {
    if (this.#runs.get(runId) === run) this.#runs.delete(runId);
    run.cancel();
  }
}

// Cancellation wins ties so a cancelled run never emits another event.
function race<T>(run: FakeRun, work: Promise<T>): Promise<T | typeof CANCELLED> {
  return Promise.race([run.cancelled, work]);
}
