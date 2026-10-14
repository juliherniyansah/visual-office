import { describe, expect, test } from 'bun:test';
import {
  type DomainEvent,
  type DomainEventInput,
  type DomainEventInputOf,
  DomainEventSchema,
  type EventSink,
} from './index';

const ENVELOPE = {
  eventId: '0b8f1c1e-4a1f-4c3a-9d2e-5f6a7b8c9d0e',
  createdAt: '2026-10-10T12:00:00.000Z',
  attempts: 0,
};

const COMPLETED: DomainEventInputOf<'run.completed'> = {
  type: 'run.completed',
  aggregate: { kind: 'run', id: 'run-1' },
  actor: { kind: 'agent', id: 'programming' },
  payload: { runId: 'run-1' },
};

// Mirrors what an outbox does: the envelope is owned by the sink, never by the emitter.
function collectingSink(): { sink: EventSink; stored: DomainEvent[] } {
  const stored: DomainEvent[] = [];
  const sink: EventSink = {
    emit: (input: DomainEventInput) => {
      stored.push(DomainEventSchema.parse({ ...input, ...ENVELOPE }));
    },
  };
  return { sink, stored };
}

describe('EventSink', () => {
  test('a sync sink receives an input that becomes a valid DomainEvent with an envelope', async () => {
    const { sink, stored } = collectingSink();
    await sink.emit(COMPLETED);
    expect<unknown>(stored).toEqual([{ ...COMPLETED, ...ENVELOPE }]);
  });

  test('an async sink also satisfies the interface', async () => {
    const stored: DomainEvent[] = [];
    const sink: EventSink = {
      emit: async (input) => {
        await Bun.sleep(1);
        stored.push(DomainEventSchema.parse({ ...input, ...ENVELOPE }));
      },
    };
    await sink.emit(COMPLETED);
    expect(stored.map((event) => event.type)).toEqual(['run.completed']);
  });

  test('input with a payload of the wrong event type is rejected once enveloped', () => {
    const wrong = { ...COMPLETED, payload: { runId: 'run-1', escalatedTo: 'nobody' } };
    expect(
      DomainEventSchema.safeParse({ ...wrong, type: 'run.escalated', ...ENVELOPE }).success,
    ).toBe(false);
  });
});
