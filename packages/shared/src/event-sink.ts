import type { DomainEvent, DomainEventType } from './events';

// Distributes Pick over the union so type/payload stay correlated for emitters.
type InputOf<E> = E extends DomainEvent
  ? Pick<E, 'type' | 'aggregate' | 'actor' | 'payload'>
  : never;

// Envelope fields (eventId, createdAt, attempts, dispatchedAt) are owned by the sink (outbox).
export type DomainEventInput = InputOf<DomainEvent>;
export type DomainEventInputOf<T extends DomainEventType> = Extract<DomainEventInput, { type: T }>;

// Port for packages that emit domain events without depending on apps/api (todo 9).
// apps/api supplies the outbox implementation; it validates and stores the event.
export interface EventSink {
  emit(input: DomainEventInput): Promise<void> | void;
}
