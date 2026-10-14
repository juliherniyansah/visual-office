import { FakeAdapter, type FakeStep } from '@redhunter/adapters';
import type {
  AdapterEvent,
  AdapterId,
  AdapterRunInput,
  AgentAdapter,
  PermissionDecision,
} from '@redhunter/shared';

// One FakeAdapter per start(): attempt N replays scripts[N] (last script repeats).
export class SequenceAdapter implements AgentAdapter {
  readonly inputs: AdapterRunInput[] = [];
  readonly answers: { runId: string; permissionId: string; decision: PermissionDecision }[] = [];
  readonly cancels: string[] = [];
  readonly #fakes: FakeAdapter[];
  #current: FakeAdapter | undefined;

  constructor(
    scripts: readonly (readonly FakeStep[])[],
    readonly id: AdapterId = 'opencode',
  ) {
    this.#fakes = scripts.map((script) => new FakeAdapter({ script, id }));
  }

  get starts(): number {
    return this.inputs.length;
  }

  start(input: AdapterRunInput): AsyncIterable<AdapterEvent> {
    const fake = this.#fakes[Math.min(this.inputs.length, this.#fakes.length - 1)];
    if (fake === undefined) throw new Error('SequenceAdapter has no scripts');
    this.inputs.push(input);
    this.#current = fake;
    return fake.start(input);
  }

  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    this.answers.push({ runId, permissionId, decision });
    await this.#current?.answerPermission(runId, permissionId, decision);
  }

  async cancel(runId: string): Promise<void> {
    this.cancels.push(runId);
    await this.#current?.cancel(runId);
  }
}

// start() throws synchronously, like a vendor binary that cannot be spawned.
export class ThrowingAdapter implements AgentAdapter {
  readonly id: AdapterId = 'opencode';
  starts = 0;

  start(): AsyncIterable<AdapterEvent> {
    this.starts += 1;
    throw new Error(`spawn failed #${this.starts}`);
  }

  async answerPermission(): Promise<void> {}

  async cancel(): Promise<void> {}
}

export const COMPLETED: AdapterEvent = { type: 'completed', finalText: 'Fixed the bug.' };
export const FAILED: AdapterEvent = { type: 'failed', error: 'tests red' };
