import { randomUUID } from 'node:crypto';
import type { ExperienceInput } from '@redhunter/hermes';
import {
  type Decision,
  type DomainEvent,
  type DomainEventInput,
  type DomainEventOf,
  DomainEventSchema,
  type DomainEventType,
  type EventSink,
  type HermesExperience,
  HermesExperienceSchema,
  type Run,
  type RunStatus,
} from '@redhunter/shared';
import type {
  DecisionRepository,
  ExperienceWriter,
  LogFields,
  Logger,
  RunPatch,
  RunRepository,
} from '../ports';
import { InvalidRunTransitionError } from '../state-machine';

export const TEST_NOW = new Date('2026-10-10T12:00:00.000Z');

export function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    taskId: 'task-1',
    agentId: 'programming',
    adapterId: 'opencode',
    status: 'queued',
    usage: { inputTokens: 0, outputTokens: 0 },
    ...overrides,
  };
}

export function sequentialIds(prefix = 'id'): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `${prefix}-${next}`;
  };
}

export class RecordingLogger implements Logger {
  readonly entries: { message: string; fields?: LogFields }[] = [];

  info(message: string, fields?: LogFields): void {
    this.entries.push(fields === undefined ? { message } : { message, fields });
  }
}

// CAS like apps/api transitionRun: the stored status must equal `from`.
export class InMemoryRunRepository implements RunRepository {
  readonly transitions: { runId: string; from: RunStatus; to: RunStatus }[] = [];
  readonly #rows = new Map<string, Run>();

  async create(run: Run): Promise<Run> {
    this.#rows.set(run.id, run);
    return run;
  }

  get(runId: string): Run | undefined {
    return this.#rows.get(runId);
  }

  async transition(runId: string, from: RunStatus, to: RunStatus, patch?: RunPatch): Promise<Run> {
    const current = this.#rows.get(runId);
    if (current === undefined) throw new Error(`Run ${runId} not found`);
    if (current.status !== from) throw new InvalidRunTransitionError(current.status, to);
    const updated: Run = { ...current, ...patch, status: to };
    this.#rows.set(runId, updated);
    this.transitions.push({ runId, from, to });
    return updated;
  }
}

export class InMemoryDecisionRepository implements DecisionRepository {
  readonly rows: Decision[] = [];

  async create(decision: Decision): Promise<Decision> {
    this.rows.push(decision);
    return decision;
  }

  async findById(id: string): Promise<Decision | null> {
    return this.rows.find((d) => d.id === id) ?? null;
  }

  async update(id: string, patch: Partial<Decision>): Promise<Decision> {
    const idx = this.rows.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Decision ${id} not found`);
    const existing = this.rows[idx];
    const updated = { ...existing, ...patch };
    this.rows[idx] = updated as Decision;
    return this.rows[idx];
  }

  async listPending(): Promise<Decision[]> {
    return this.rows.filter((d) => !d.answeredAt);
  }
}

export class InMemoryExperienceWriter implements ExperienceWriter {
  readonly rows: HermesExperience[] = [];

  async addExperience(input: ExperienceInput): Promise<HermesExperience> {
    const row = HermesExperienceSchema.parse({ ...input, id: `exp-${this.rows.length + 1}` });
    this.rows.push(row);
    return row;
  }
}

// Envelopes and validates every input, so a payload that breaks the shared catalog fails the test.
export class RecordingSink implements EventSink {
  readonly events: DomainEvent[] = [];
  readonly #listeners: ((event: DomainEvent) => void)[] = [];

  async emit(input: DomainEventInput): Promise<void> {
    const event = DomainEventSchema.parse({
      ...input,
      eventId: randomUUID(),
      createdAt: TEST_NOW.toISOString(),
      attempts: 0,
    });
    this.events.push(event);
    for (const listener of this.#listeners) listener(event);
  }

  types(): DomainEventType[] {
    return this.events.map((event) => event.type);
  }

  payloadsOf<T extends DomainEventType>(type: T): DomainEventOf<T>['payload'][] {
    return this.events
      .filter((event): event is DomainEventOf<T> => event.type === type)
      .map((event) => event.payload as DomainEventOf<T>['payload']);
  }

  agentStatuses(): string[] {
    return this.payloadsOf('agent.status_changed').map((payload) => payload.status);
  }

  // Resolves once an event of `type` has been emitted (already emitted counts).
  waitFor(type: DomainEventType, timeoutMs = 1_000): Promise<void> {
    // Settles one macrotask later so the emitter's follow-up emits (same tick) are recorded.
    const settle = (resolve: () => void) => setTimeout(resolve, 0);
    if (this.events.some((event) => event.type === type)) return new Promise(settle);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeoutMs);
      this.#listeners.push((event) => {
        if (event.type !== type) return;
        clearTimeout(timer);
        settle(resolve);
      });
    });
  }
}
