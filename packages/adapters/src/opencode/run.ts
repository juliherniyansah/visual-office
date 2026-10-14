import type { AdapterEvent, AdapterRunInput } from '@redhunter/shared';
import {
  createRunClient,
  errorText,
  labelFailure,
  type OpencodeClient,
  requestSignal,
} from './client';
import { OpencodeEventMapper } from './event-mapper';
import { CANCELLED, type OpencodeRun, STOPPED } from './run-state';

const STREAM_ENDED = 'opencode event stream ended before the session finished';

export interface RunContext {
  readonly input: AdapterRunInput;
  readonly agentName: string;
  readonly serverUrl: () => Promise<string>;
}

interface OpenedRun {
  readonly client: OpencodeClient;
  readonly sessionId: string;
  readonly first: unknown;
}

// Session first, then the SSE stream; its first event (server.connected) proves the stream
// is live before the prompt is sent, so no early event is missed.
async function openRun(run: OpencodeRun, ctx: RunContext): Promise<OpenedRun> {
  const client = createRunClient(await ctx.serverUrl(), ctx.input.cwd);
  const session = await labelFailure(
    'session.create',
    client.session.create({
      body: { title: `redhunter ${ctx.input.runId}` },
      throwOnError: true,
      signal: requestSignal(run.signal),
    }),
  );
  run.attach(client, session.data.id);
  await run.subscribe(client);
  const first = await run.nextEvent();
  if (first.done === true) {
    throw new Error(`opencode event stream failed: ${errorText(run.streamError ?? 'closed')}`);
  }
  return { client, sessionId: session.data.id, first: first.value };
}

async function sendPrompt(run: OpencodeRun, ctx: RunContext, opened: OpenedRun): Promise<void> {
  await labelFailure(
    'prompt',
    opened.client.session.promptAsync({
      path: { id: opened.sessionId },
      body: { agent: ctx.agentName, parts: [{ type: 'text', text: ctx.input.prompt }] },
      throwOnError: true,
      signal: requestSignal(run.signal),
    }),
  );
}

// Never throws: every failure becomes one `failed` event; a cancelled run just ends.
export async function* runEvents(run: OpencodeRun, ctx: RunContext): AsyncGenerator<AdapterEvent> {
  for await (const event of streamRun(run, ctx)) {
    // Terminal: stop first, so a late answerPermission() is rejected, never forwarded.
    if (event.type === 'completed' || event.type === 'failed') run.stop(CANCELLED);
    yield event;
  }
}

async function* streamRun(run: OpencodeRun, ctx: RunContext): AsyncGenerator<AdapterEvent> {
  let isCompleted = false;
  try {
    // Pre-aborted input: no server spawn, no session, no events.
    if (run.stopReason !== undefined) return yield* stopEvents(run);
    const opened = await run.until(openRun(run, ctx));
    if (opened === STOPPED) return yield* stopEvents(run);
    yield { type: 'started', vendorSessionId: opened.sessionId };
    const prompted = await run.until(sendPrompt(run, ctx, opened));
    if (prompted === STOPPED) return yield* stopEvents(run);
    const mapper = new OpencodeEventMapper(opened.sessionId);
    let raw: unknown = opened.first;
    for (;;) {
      for (const event of mapper.map(raw)) {
        if (run.stopReason !== undefined) return yield* stopEvents(run);
        if (event.type === 'permission_request') run.pending.add(event.permissionId);
        if (event.type === 'completed') isCompleted = true;
        yield event;
        if (event.type === 'completed' || event.type === 'failed') return;
      }
      const next = await run.until(run.nextEvent());
      if (next === STOPPED) return yield* stopEvents(run);
      if (next.done === true) return yield streamEnded(run.streamError);
      raw = next.value;
    }
  } catch (error) {
    if (run.stopReason === undefined) yield { type: 'failed', error: errorText(error) };
    else yield* stopEvents(run);
  } finally {
    run.stop(CANCELLED);
    await run.streamClosed.catch(() => undefined);
    // Best effort: the run is already over for the caller; a failed abort only leaves an idle
    // server-side session, and throwing here would break "never throws out of the iterator".
    if (!isCompleted) await run.abortSession().catch(() => undefined);
  }
}

function streamEnded(cause: unknown): AdapterEvent {
  return {
    type: 'failed',
    error: cause === undefined ? STREAM_ENDED : `${STREAM_ENDED}: ${errorText(cause)}`,
  };
}

function* stopEvents(run: OpencodeRun): Generator<AdapterEvent> {
  const reason = run.stopReason;
  if (reason?.kind === 'failed') yield { type: 'failed', error: reason.error };
}
