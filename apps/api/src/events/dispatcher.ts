import type { DomainEvent } from '@redhunter/shared';
import type { EventRecord, Models } from '../db/models';
import { toDomainEvent } from './outbox';

export const MAX_DISPATCH_ATTEMPTS = 5;
export const DEFAULT_POLL_INTERVAL_MS = 250;
const BATCH_SIZE = 100;

export type EventSink = (event: DomainEvent) => void | Promise<void>;

export interface Logger {
  error(...args: unknown[]): void;
}

export interface EventDispatcher {
  start(): void;
  stop(): Promise<void>;
  // Fast path from the outbox; no-op unless started.
  notify(): void;
  // One drain of the queue; concurrent calls share the in-flight drain. Resolves to deliveries.
  tick(): Promise<number>;
}

export interface DispatcherOptions {
  readonly models: Models;
  readonly sinks: readonly EventSink[];
  // EVENTS_DISPATCH=off: events stay in `events`, nothing is delivered.
  readonly enabled?: boolean;
  readonly pollIntervalMs?: number;
  readonly logger?: Logger;
}

type RowOutcome = 'delivered' | 'blocked' | 'dead';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createEventDispatcher(options: DispatcherOptions): EventDispatcher {
  const { models, sinks } = options;
  const enabled = options.enabled ?? true;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const logger = options.logger ?? console;
  // Delivered but not yet marked (mark failed): retry only the mark, never re-deliver in-process.
  const awaitingMark = new Set<string>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  let stopped = false;
  let inFlight: Promise<number> | undefined;
  let rerun = false;

  async function markDispatched(eventId: string): Promise<boolean> {
    try {
      await models.Event.updateOne(
        { eventId, dispatchedAt: null },
        { $set: { dispatchedAt: new Date() } },
      );
      awaitingMark.delete(eventId);
      return true;
    } catch (err) {
      logger.error(`events: failed to mark ${eventId} dispatched`, errorMessage(err));
      return false;
    }
  }

  async function recordFailure(row: EventRecord, err: unknown): Promise<RowOutcome> {
    const attempts = row.attempts + 1;
    const lastError = errorMessage(err);
    logger.error(
      `events: dispatch ${row.eventId} (${row.type}) attempt ${attempts} failed`,
      lastError,
    );
    if (attempts < MAX_DISPATCH_ATTEMPTS) {
      await models.Event.updateOne({ eventId: row.eventId }, { $set: { attempts, lastError } });
      return 'blocked';
    }
    // Copy first, delete second: a crash in between leaves a duplicate, never a lost event.
    await models.EventDead.updateOne(
      { eventId: row.eventId },
      { $setOnInsert: { ...row, attempts, lastError, deadAt: new Date() } },
      { upsert: true },
    );
    await models.Event.deleteOne({ eventId: row.eventId });
    return 'dead';
  }

  async function processRow(row: EventRecord): Promise<RowOutcome> {
    if (awaitingMark.has(row.eventId)) {
      return (await markDispatched(row.eventId)) ? 'delivered' : 'blocked';
    }
    try {
      const event = toDomainEvent(row);
      for (const sink of sinks) {
        await sink(event);
      }
    } catch (err) {
      return recordFailure(row, err);
    }
    awaitingMark.add(row.eventId);
    return (await markDispatched(row.eventId)) ? 'delivered' : 'blocked';
  }

  // ponytail: strict createdAt order, so a failing head event stalls the queue for up to
  // MAX_DISPATCH_ATTEMPTS ticks (~1.25 s at 250 ms) and no backoff. Add per-aggregate ordering
  // + exponential backoff when a slow/flaky sink (e.g. a remote webhook) appears.
  async function drainBatch(): Promise<number> {
    const rows = await models.Event.find({ dispatchedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .limit(BATCH_SIZE)
      .lean<EventRecord[]>();
    let delivered = 0;
    for (const row of rows) {
      if (stopped) {
        return delivered;
      }
      const outcome = await processRow(row);
      if (outcome === 'blocked') {
        return delivered;
      }
      delivered += outcome === 'delivered' ? 1 : 0;
    }
    rerun ||= rows.length === BATCH_SIZE;
    return delivered;
  }

  async function drain(): Promise<number> {
    let total = 0;
    do {
      rerun = false;
      try {
        total += await drainBatch();
      } catch (err) {
        logger.error('events: dispatcher tick failed', errorMessage(err));
        return total;
      }
    } while (rerun && !stopped);
    return total;
  }

  function tick(): Promise<number> {
    if (!enabled || stopped) {
      return Promise.resolve(0);
    }
    if (inFlight !== undefined) {
      // An emit landed mid-drain; run one more pass so it is not left for the next poll.
      rerun = true;
      return inFlight;
    }
    inFlight = drain().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return {
    start() {
      if (started || stopped || !enabled) {
        return;
      }
      started = true;
      timer = setInterval(() => void tick(), pollIntervalMs);
      void tick();
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
    notify() {
      if (started && !stopped) {
        void tick();
      }
    },
    tick,
  };
}
