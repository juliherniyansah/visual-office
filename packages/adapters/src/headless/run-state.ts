import type { ChildHandle } from '../spawn';

export type RunStop =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly error: string };

export const CANCELLED: RunStop = { kind: 'cancelled' };
export const STOPPED = Symbol('stopped');

// Mutable state of one headless CLI run. stop() (no more events) is idempotent: the first
// reason wins. kill() (child gone) is separate: a finished run lets its child exit on its own.
export class HeadlessRun {
  readonly pending = new Set<string>();
  // Human answers to after-the-fact permission requests (headless CLIs have no reply channel).
  readonly decisions = new Map<string, 'allow' | 'deny'>();
  readonly #stopped = Promise.withResolvers<typeof STOPPED>();
  #stop: RunStop | undefined;
  #child: ChildHandle | undefined;
  #isKilled = false;

  get stopReason(): RunStop | undefined {
    return this.#stop;
  }

  stop(reason: RunStop): void {
    if (this.#stop !== undefined) return;
    this.#stop = reason;
    this.pending.clear();
    this.#stopped.resolve(STOPPED);
  }

  // Stop wins ties so a stopped run emits nothing more.
  async until<T>(work: Promise<T>): Promise<T | typeof STOPPED> {
    const result = await Promise.race([work, this.#stopped.promise]);
    return this.#stop === undefined ? result : STOPPED;
  }

  // A child that arrives after kill() is cancelled at once (spawn raced a cancel).
  attach(child: ChildHandle): void {
    this.#child = child;
    if (this.#isKilled) void child.cancel();
  }

  // Idempotent; resolves once the child process group is gone (spawnChild cancel()).
  async kill(): Promise<void> {
    this.#isKilled = true;
    await this.#child?.cancel();
  }
}
