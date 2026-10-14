import type { PermissionDecision } from '@redhunter/shared';
import { labelFailure, type OpencodeClient, requestSignal } from './client';

export type RunStop =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly error: string };

export const CANCELLED: RunStop = { kind: 'cancelled' };
export const STOPPED = Symbol('stopped');
const ABORT_TIMEOUT_MS = 5_000;
const DONE: IteratorResult<unknown> = { done: true, value: undefined };

interface EventStream {
  readonly stream: AsyncGenerator<unknown>;
  readonly controller: AbortController;
  isReading: boolean;
}

// Mutable state of one adapter run. stop() is idempotent: the first reason wins.
export class OpencodeRun {
  readonly pending = new Set<string>();
  readonly #controller = new AbortController();
  readonly #stopped = Promise.withResolvers<typeof STOPPED>();
  #stop: RunStop | undefined;
  #client: OpencodeClient | undefined;
  #sessionId: string | undefined;
  #events: EventStream | undefined;
  #streamClosed: Promise<void> = Promise.resolve();
  #abortSession: Promise<void> | undefined;

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get stopReason(): RunStop | undefined {
    return this.#stop;
  }

  #lastStreamError: () => unknown = () => undefined;

  get streamError(): unknown {
    return this.#lastStreamError();
  }

  // Resolves once the SSE connection is released (awaited by the iterator's cleanup).
  get streamClosed(): Promise<void> {
    return this.#streamClosed;
  }

  attach(client: OpencodeClient, sessionId: string): void {
    this.#client = client;
    this.#sessionId = sessionId;
  }

  stop(reason: RunStop): void {
    if (this.#stop !== undefined) return;
    this.#stop = reason;
    this.pending.clear();
    this.#controller.abort();
    this.#streamClosed = this.#closeStream();
    this.#stopped.resolve(STOPPED);
  }

  // Stop wins ties so a stopped run emits nothing more. An AbortError caused by stop() still
  // rejects; the caller's catch checks stopReason before reporting it.
  async until<T>(work: Promise<T>): Promise<T | typeof STOPPED> {
    const result = await Promise.race([work, this.#stopped.promise]);
    return this.#stop === undefined ? result : STOPPED;
  }

  async subscribe(client: OpencodeClient): Promise<void> {
    const controller = new AbortController();
    let lastError: unknown;
    const { stream } = await client.event.subscribe({
      signal: controller.signal,
      // ponytail: no reconnect; add Last-Event-ID resume if long runs see dropped streams.
      sseMaxRetryAttempts: 1,
      onSseError: (error) => {
        lastError = error;
      },
    });
    this.#events = { stream, controller, isReading: false };
    this.#lastStreamError = () => lastError;
    if (this.#stop !== undefined) this.#streamClosed = this.#closeStream();
  }

  async nextEvent(): Promise<IteratorResult<unknown>> {
    const events = this.#events;
    if (events === undefined || this.#stop !== undefined) return DONE;
    events.isReading = true;
    try {
      return await events.stream.next();
    } finally {
      events.isReading = false;
    }
  }

  // The SDK SSE client calls `void reader.cancel()` on abort; on a reset connection that
  // rejects unhandled unless a read is pending. So an idle stream is return()ed (its finally
  // drops the abort listener) before abort; a pending read is aborted directly.
  async #closeStream(): Promise<void> {
    const events = this.#events;
    if (events === undefined) return;
    this.#events = undefined;
    if (!events.isReading) await events.stream.return(undefined);
    events.controller.abort();
  }

  // allow -> 'once' (never 'always': each grant stays per call). Any failure fails the run closed.
  async reply(permissionId: string, decision: PermissionDecision): Promise<void> {
    const client = this.#client;
    const id = this.#sessionId;
    if (client === undefined || id === undefined) throw new Error('opencode session not started');
    try {
      await labelFailure(
        'permission reply',
        client.postSessionIdPermissionsPermissionId({
          path: { id, permissionID: permissionId },
          body: { response: decision === 'allow' ? 'once' : 'reject' },
          throwOnError: true,
          signal: requestSignal(this.signal),
        }),
      );
    } catch (error) {
      this.stop({ kind: 'failed', error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
    if (decision !== 'allow')
      this.stop({ kind: 'failed', error: `Permission ${permissionId} denied` });
  }

  // Memoized once a session exists: cancel() and the iterator's cleanup share one POST.
  abortSession(): Promise<void> {
    const client = this.#client;
    const id = this.#sessionId;
    if (client === undefined || id === undefined) return Promise.resolve();
    this.#abortSession ??= labelFailure(
      'session.abort',
      client.session.abort({
        path: { id },
        throwOnError: true,
        signal: AbortSignal.timeout(ABORT_TIMEOUT_MS),
      }),
    ).then(() => undefined);
    return this.#abortSession;
  }
}
