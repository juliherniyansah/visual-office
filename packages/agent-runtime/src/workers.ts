import type { AdapterEvent } from '@redhunter/shared';

// OMO subagents (sisyphus-junior, oracle, explore, ...) surface as `tool` events named 'task'.
export const WORKER_TOOL_NAME = 'task';
const FALLBACK_LABEL = 'task';

export interface Worker {
  readonly workerId: string;
  readonly label: string;
}

export interface WorkerChange {
  readonly kind: 'spawned' | 'despawned';
  readonly worker: Worker;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function workerLabel(input: unknown): string {
  if (typeof input !== 'object' || input === null) return FALLBACK_LABEL;
  const record = input as Record<string, unknown>;
  return readString(record, 'subagent_type') ?? readString(record, 'description') ?? FALLBACK_LABEL;
}

// Adapter events carry no call id, so completion pairs with the oldest open worker of the same
// label (FIFO), falling back to the oldest open worker.
export class WorkerTracker {
  readonly #open: Worker[] = [];

  constructor(private readonly newId: () => string) {}

  observe(event: AdapterEvent): WorkerChange | undefined {
    if (event.type !== 'tool' || event.name !== WORKER_TOOL_NAME) return undefined;
    const label = workerLabel(event.input);
    if (event.status === 'started') {
      const worker = { workerId: this.newId(), label };
      this.#open.push(worker);
      return { kind: 'spawned', worker };
    }
    const sameLabel = this.#open.findIndex((worker) => worker.label === label);
    const index = sameLabel === -1 ? 0 : sameLabel;
    const [worker] = this.#open.splice(index, 1);
    return worker === undefined ? undefined : { kind: 'despawned', worker };
  }

  drain(): Worker[] {
    return this.#open.splice(0);
  }
}
