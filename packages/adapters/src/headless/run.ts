import type { AdapterEvent, AdapterRunInput } from '@redhunter/shared';
import { errorText } from '../opencode/client';
import { type ChildExit, type ChildHandle, SpawnError, spawnChild } from '../spawn';
import { CANCELLED, type HeadlessRun, STOPPED } from './run-state';
import type { CliLaunch, HeadlessVendor, StreamMapper } from './types';

// A finished CLI gets this long to exit on its own before its process group is killed.
export const EXIT_GRACE_MS = 2_000;
const STDERR_TAIL_CHARS = 2_000;

export interface CliRunContext {
  readonly vendor: HeadlessVendor;
  readonly binary: string;
  readonly input: AdapterRunInput;
  readonly env?: Readonly<Record<string, string>>;
}

// Never throws: every failure becomes one `failed` event; a cancelled run just ends.
export async function* runCli(run: HeadlessRun, ctx: CliRunContext): AsyncGenerator<AdapterEvent> {
  for await (const event of streamCli(run, ctx)) {
    // Terminal: stop first, so a late answerPermission() is rejected, never recorded.
    if (event.type === 'completed' || event.type === 'failed') run.stop(CANCELLED);
    yield event;
  }
}

async function* streamCli(run: HeadlessRun, ctx: CliRunContext): AsyncGenerator<AdapterEvent> {
  const id = ctx.vendor.id;
  let launch: CliLaunch | undefined;
  let child: ChildHandle | undefined;
  let isFinished = false;
  try {
    // Pre-aborted input: no files, no spawn, no events.
    if (run.stopReason !== undefined) return yield* stopEvents(run);
    launch = await ctx.vendor.prepare(ctx.input);
    if (run.stopReason !== undefined) return yield* stopEvents(run);
    child = await spawnChild(ctx.binary, launch.args, {
      cwd: ctx.input.cwd,
      ...(ctx.env === undefined ? {} : { env: ctx.env }),
    });
    run.attach(child);
    const stderr = collectTail(child.stderr);
    for (;;) {
      const next = await run.until(child.stdout.next());
      if (next === STOPPED) return yield* stopEvents(run);
      if (next.done === true) break;
      for (const event of mapLine(launch.mapper, next.value)) {
        if (run.stopReason !== undefined) return yield* stopEvents(run);
        if (event.type === 'permission_request') run.pending.add(event.permissionId);
        isFinished = event.type === 'completed' || event.type === 'failed';
        yield event;
        if (isFinished) return;
      }
    }
    const exit = await run.until(child.exited);
    if (exit === STOPPED) return yield* stopEvents(run);
    yield { type: 'failed', error: exitError(id, exit, await stderr, launch.mapper.lastError) };
  } catch (error) {
    if (run.stopReason !== undefined) yield* stopEvents(run);
    else yield { type: 'failed', error: spawnErrorText(id, ctx.binary, error) };
  } finally {
    run.stop(CANCELLED);
    if (child !== undefined && isFinished) await settle(child);
    await run.kill();
    launch?.cleanup();
  }
}

// One stdout line = one JSON value. Blank or malformed lines (vendor log noise) are skipped.
function mapLine(mapper: StreamMapper, line: string): AdapterEvent[] {
  if (line.trim() === '') return [];
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return [];
  }
  return mapper.map(raw);
}

async function settle(child: ChildHandle): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, EXIT_GRACE_MS);
  });
  await Promise.race([child.exited, grace]);
  clearTimeout(timer);
}

async function collectTail(lines: AsyncIterableIterator<string>): Promise<string> {
  let tail = '';
  for await (const line of lines) tail = `${tail}${line}\n`.slice(-STDERR_TAIL_CHARS);
  return tail.trim();
}

function exitError(id: string, exit: ChildExit, stderr: string, lastError?: string): string {
  const cause = stderr || lastError;
  const how =
    exit.exitCode === 0
      ? `${id} exited before finishing the run`
      : exit.signal !== null
        ? `${id} was killed by ${exit.signal}`
        : `${id} exited with code ${exit.exitCode}`;
  return cause ? `${how}: ${cause}` : how;
}

function spawnErrorText(id: string, binary: string, error: unknown): string {
  if (error instanceof SpawnError && error.code === 'not_found') {
    return `${id} binary not found: "${binary}"`;
  }
  return `${id} run failed: ${errorText(error)}`;
}

function* stopEvents(run: HeadlessRun): Generator<AdapterEvent> {
  const reason = run.stopReason;
  if (reason?.kind === 'failed') yield { type: 'failed', error: reason.error };
}
