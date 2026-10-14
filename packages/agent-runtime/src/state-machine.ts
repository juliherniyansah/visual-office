import type { Run, RunStatus } from '@redhunter/shared';
import { type Logger, NOOP_LOGGER, type RunPatch, type RunRepository } from './ports';

// Mirror of apps/api/src/services/transitions.ts RUN_TRANSITIONS (packages may not import apps).
// Plan section 4 chain; any non-terminal state may pause, fail or escalate.
export const RUN_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ['composing', 'paused', 'failed'],
  composing: ['executing', 'paused', 'failed'],
  executing: ['verifying', 'paused', 'failed', 'escalated'],
  verifying: ['succeeded', 'paused', 'failed', 'escalated'],
  paused: ['queued', 'composing', 'executing', 'verifying', 'failed', 'escalated'],
  succeeded: [],
  failed: [],
  escalated: [],
};

export class InvalidRunTransitionError extends Error {
  override readonly name = 'InvalidRunTransitionError';

  constructor(
    readonly from: RunStatus,
    readonly to: RunStatus,
  ) {
    super(`Invalid run transition ${from} -> ${to}`);
  }
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!RUN_TRANSITIONS[from].includes(to)) throw new InvalidRunTransitionError(from, to);
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return RUN_TRANSITIONS[status].length === 0;
}

export interface RunStateMachineDeps {
  readonly runs: RunRepository;
  readonly logger?: Logger;
}

// No run.status_changed event exists in the catalog: transitions are reported through the
// repository (CAS) and logged; lifecycle milestones are emitted by the runtime.
export class RunStateMachine {
  readonly #runs: RunRepository;
  readonly #logger: Logger;

  constructor(deps: RunStateMachineDeps) {
    this.#runs = deps.runs;
    this.#logger = deps.logger ?? NOOP_LOGGER;
  }

  async transition(runId: string, from: RunStatus, to: RunStatus, patch?: RunPatch): Promise<Run> {
    assertRunTransition(from, to);
    const run = await this.#runs.transition(runId, from, to, patch);
    this.#logger.info('run transition', { runId, from, to });
    return run;
  }
}
