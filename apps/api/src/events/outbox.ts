import { randomUUID } from 'node:crypto';
import { type DomainEvent, DomainEventSchema } from '@redhunter/shared';
import type { EventRecord, Models } from '../db/models';

// Distributes Pick over the union so type/payload stay correlated for callers.
type InputOf<E> = E extends DomainEvent
  ? Pick<E, 'type' | 'aggregate' | 'actor' | 'payload'>
  : never;
// Envelope fields (eventId, createdAt, attempts, dispatchedAt) are server-owned, never caller input.
export type EventInput = InputOf<DomainEvent>;

export class InvalidEventError extends Error {
  constructor(message: string) {
    super(`Invalid domain event: ${message}`);
    this.name = 'InvalidEventError';
  }
}

export interface Outbox {
  emit(input: EventInput): Promise<DomainEvent>;
}

export interface OutboxDeps {
  readonly models: Models;
  // Fast path: the in-process dispatcher ticks immediately instead of waiting for the poll.
  readonly onEmitted?: () => void;
}

function pickInput(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    return {};
  }
  const { type, aggregate, actor, payload } = input as Record<string, unknown>;
  return { type, aggregate, actor, payload };
}

function buildEvent(input: unknown): DomainEvent {
  const result = DomainEventSchema.safeParse({
    ...pickInput(input),
    eventId: randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new InvalidEventError(issues.join('; '));
  }
  return result.data;
}

export function toDomainEvent(row: EventRecord): DomainEvent {
  return DomainEventSchema.parse({
    eventId: row.eventId,
    type: row.type,
    aggregate: row.aggregate,
    actor: row.actor,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    attempts: row.attempts,
    ...(row.dispatchedAt === null ? {} : { dispatchedAt: row.dispatchedAt.toISOString() }),
  });
}

export function createOutbox(deps: OutboxDeps): Outbox {
  return {
    async emit(input) {
      const event = buildEvent(input);
      try {
        await deps.models.Event.create({
          ...event,
          createdAt: new Date(event.createdAt),
          dispatchedAt: null,
        });
      } catch (err) {
        throw new Error(`Failed to store event ${event.type}`, { cause: err });
      }
      deps.onEmitted?.();
      return event;
    },
  };
}
