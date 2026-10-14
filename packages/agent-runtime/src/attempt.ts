import type { AdapterEvent, AgentAdapter, DomainEventInput, Usage } from '@redhunter/shared';
import type { Completion } from './ports';
import type { RunEvents } from './run-events';
import type { WorkerTracker } from './workers';

export const NO_TERMINAL_EVENT = 'Adapter ended without a terminal event';

export type AttemptResult =
  | { readonly kind: 'completed'; readonly completion: Completion }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'ended' };

// Mutable per-run state shared by all attempts (seq continues across retries).
export interface RunProgress {
  seq: number;
  usage: Usage;
  vendorSessionId?: string;
}

export interface AttemptHooks {
  readonly emit: (input: DomainEventInput) => Promise<void>;
  readonly onPermission: (permissionId: string, tool: string, detail: string) => Promise<void>;
}

export interface AttemptContext {
  readonly adapter: AgentAdapter;
  readonly start: () => AsyncIterable<AdapterEvent>;
  readonly events: RunEvents;
  readonly workers: WorkerTracker;
  readonly progress: RunProgress;
  readonly hooks: AttemptHooks;
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function addUsage(total: Usage, event: Extract<AdapterEvent, { type: 'usage' }>): Usage {
  const costUsd =
    total.costUsd === undefined && event.costUsd === undefined
      ? undefined
      : (total.costUsd ?? 0) + (event.costUsd ?? 0);
  return {
    inputTokens: total.inputTokens + event.inputTokens,
    outputTokens: total.outputTokens + event.outputTokens,
    ...(costUsd === undefined ? {} : { costUsd }),
  };
}

async function handleEvent(ctx: AttemptContext, event: AdapterEvent, artifacts: Set<string>) {
  const { progress, hooks, events } = ctx;
  await hooks.emit(events.progress(progress.seq, event));
  progress.seq += 1;
  if (event.type === 'started') progress.vendorSessionId = event.vendorSessionId;
  if (event.type === 'usage') progress.usage = addUsage(progress.usage, event);
  if (event.type === 'file_change') artifacts.add(event.path);
  if (event.type === 'permission_request') {
    await hooks.onPermission(event.permissionId, event.tool, event.detail);
  }
  const change = ctx.workers.observe(event);
  if (change !== undefined) await hooks.emit(events.worker(change.kind, change.worker));
}

async function consume(ctx: AttemptContext): Promise<AttemptResult> {
  const artifacts = new Set<string>();
  for await (const event of ctx.start()) {
    await handleEvent(ctx, event, artifacts);
    if (event.type === 'failed') return { kind: 'failed', error: event.error };
    if (event.type === 'completed') {
      const { finalText, structured } = event;
      return {
        kind: 'completed',
        completion: { finalText, structured, artifacts: [...artifacts] },
      };
    }
  }
  return { kind: 'ended' };
}

// One adapter attempt. A throwing adapter counts as a failed attempt; open workers are
// despawned when the attempt ends, whatever the outcome.
export async function runAttempt(ctx: AttemptContext): Promise<AttemptResult> {
  try {
    return await consume(ctx);
  } catch (error) {
    return { kind: 'failed', error: errorMessage(error) };
  } finally {
    for (const worker of ctx.workers.drain()) {
      await ctx.hooks.emit(ctx.events.worker('despawned', worker));
    }
  }
}
