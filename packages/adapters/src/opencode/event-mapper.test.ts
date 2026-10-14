import { describe, expect, test } from 'bun:test';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { OpencodeEventMapper } from './event-mapper';
import {
  BASH_INPUT,
  happyScript,
  messageUpdated,
  OTHER_SESSION_ID,
  patchPart,
  permissionAsked,
  permissionUpdatedV1,
  type RawEvent,
  SESSION_ID,
  serverConnected,
  sessionError,
  sessionIdle,
  stepFinish,
  textDelta,
  textPart,
  toolPart,
} from './test-support/events';

const ASSISTANT = messageUpdated('msg_assistant', 'assistant');

function mapAll(raws: readonly unknown[]): AdapterEvent[] {
  const mapper = new OpencodeEventMapper(SESSION_ID);
  const events = raws.flatMap((raw) => mapper.map(raw));
  for (const event of events) AdapterEventSchema.parse(event);
  return events;
}

test('happy run maps to the normalized sequence, prompt echo never leaks into text', () => {
  expect<unknown>(mapAll(happyScript())).toEqual([
    { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'started' },
    { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'completed', exitCode: 0 },
    { type: 'file_change', path: 'src/a.ts', kind: 'modified' },
    { type: 'text', text: 'hel' },
    { type: 'text', text: 'lo' },
    { type: 'usage', inputTokens: 120, outputTokens: 10, costUsd: 0.25 },
    { type: 'completed', finalText: 'hello' },
  ]);
});

describe('text', () => {
  test('v1 delta on message.part.updated is emitted as-is', () => {
    const events = mapAll([
      ASSISTANT,
      { ...textPart('p', 'he') },
      withDelta(textPart('p', 'hey'), 'y'),
    ]);
    expect<unknown>(events).toEqual([text('he'), text('y')]);
  });

  test('snapshot-only updates emit the new suffix once', () => {
    const events = mapAll([
      ASSISTANT,
      textPart('p', 'he'),
      textPart('p', 'hello'),
      textPart('p', 'hello'),
    ]);
    expect<unknown>(events).toEqual([text('he'), text('llo')]);
  });

  test('ignored, synthetic, reasoning, non-text delta fields and unknown messages are skipped', () => {
    const reasoning = textPart('r', 'thinking');
    const events = mapAll([
      textPart('early', 'before role known'),
      ASSISTANT,
      textPart('a', 'x', { ignored: true }),
      textPart('b', 'y', { synthetic: true }),
      textDelta('a', 'x2'),
      textDelta('c', 'z', 'reasoning'),
      { ...reasoning, properties: { part: { ...partOf(reasoning), type: 'reasoning' } } },
      textDelta('r', 'more thinking'),
      textDelta('unseen', 'orphan'),
      sessionIdle(),
    ]);
    expect<unknown>(events).toEqual([{ type: 'completed', finalText: '' }]);
  });

  test('finalText joins assistant text parts in first-seen order', () => {
    const events = mapAll([ASSISTANT, textPart('a', 'one'), textPart('b', 'two'), sessionIdle()]);
    expect<unknown>(events.at(-1)).toEqual({ type: 'completed', finalText: 'one\ntwo' });
  });
});

describe('tool', () => {
  const completed = { status: 'completed', input: BASH_INPUT, output: '', title: 't', time: {} };

  test('repeated running updates emit one started; completed without running still pairs', () => {
    const running = { status: 'running', input: BASH_INPUT, time: { start: 1 } };
    const events = mapAll([
      toolPart('a', running),
      toolPart('a', running),
      toolPart('b', completed),
    ]);
    expect<unknown>(events.map((e) => (e.type === 'tool' ? e.status : e.type))).toEqual([
      'started',
      'started',
      'completed',
    ]);
  });

  test('error state completes without exitCode; non-integer exit is dropped', () => {
    const error = { status: 'error', input: BASH_INPUT, error: 'boom', time: {} };
    const odd = { ...completed, metadata: { exit: 'zero' } };
    const events = mapAll([toolPart('a', error), toolPart('b', odd)]);
    expect<unknown>(events.filter((e) => e.type === 'tool' && e.status === 'completed')).toEqual([
      { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'completed' },
      { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'completed' },
    ]);
  });
});

describe('permission', () => {
  test('v2 permission.asked (live shape) maps once per id', () => {
    const events = mapAll([permissionAsked('per_1'), permissionAsked('per_1')]);
    expect<unknown>(events).toEqual([
      { type: 'permission_request', permissionId: 'per_1', tool: 'bash', detail: 'echo hello' },
    ]);
  });

  test('v1 permission.updated uses type + title and pattern', () => {
    const events = mapAll([
      permissionUpdatedV1('p1'),
      permissionUpdatedV1('p2', 'src/*'),
      permissionUpdatedV1('p3', ['a', 'b']),
    ]);
    expect<unknown>(events.map((e) => (e.type === 'permission_request' ? e.detail : ''))).toEqual([
      'Edit src/a.ts',
      'Edit src/a.ts (src/*)',
      'Edit src/a.ts (a, b)',
    ]);
    expect(events.every((e) => e.type === 'permission_request' && e.tool === 'edit')).toBe(true);
  });
});

test('usage counts cache tokens as input and reasoning as output; zero cost is kept', () => {
  const events = mapAll([
    stepFinish('s', { input: 5, output: 2, reasoning: 1, cache: { read: 30, write: 4 } }, 0),
  ]);
  expect<unknown>(events).toEqual([
    { type: 'usage', inputTokens: 39, outputTokens: 3, costUsd: 0 },
  ]);
});

test('usage is sanitized to non-negative integers and deduped per step part', () => {
  const events = mapAll([
    stepFinish('s1', { input: 10.7, output: -3, reasoning: Number.NaN, cache: {} }, -1),
    stepFinish('s1', { input: 99, output: 99, reasoning: 0, cache: {} }),
  ]);
  expect<unknown>(events).toEqual([{ type: 'usage', inputTokens: 10, outputTokens: 0 }]);
});

test('patch parts emit one file_change per file, deduped by part id', () => {
  const events = mapAll([patchPart('p', ['a.ts', 'b.ts']), patchPart('p', ['a.ts', 'b.ts'])]);
  expect<unknown>(events.map((e) => (e.type === 'file_change' ? e.path : ''))).toEqual([
    'a.ts',
    'b.ts',
  ]);
});

describe('session.error', () => {
  test('named error with message', () => {
    const events = mapAll([
      sessionError({ name: 'APIError', data: { message: 'boom', isRetryable: false } }),
    ]);
    expect<unknown>(events).toEqual([{ type: 'failed', error: 'APIError: boom' }]);
  });

  test('named error without message and missing error', () => {
    const events = mapAll([
      sessionError({ name: 'MessageOutputLengthError', data: {} }),
      sessionError(undefined),
    ]);
    expect<unknown>(events).toEqual([
      { type: 'failed', error: 'MessageOutputLengthError' },
      { type: 'failed', error: 'opencode session error' },
    ]);
  });

  test('error without sessionID fails the run (fail closed)', () => {
    const raw = sessionError({ name: 'UnknownError', data: { message: 'x' } }, null);
    expect(Object.keys(raw.properties)).toEqual(['error']);
    expect<unknown>(mapAll([raw])).toEqual([{ type: 'failed', error: 'UnknownError: x' }]);
  });
});

test('events of other sessions and noise are ignored', () => {
  const other: RawEvent[] = [
    messageUpdated('msg_assistant', 'assistant', OTHER_SESSION_ID),
    toolPart('a', { status: 'running', input: {}, time: {} }, OTHER_SESSION_ID),
    permissionAsked('per_x', OTHER_SESSION_ID),
    sessionError({ name: 'UnknownError', data: { message: 'x' } }, OTHER_SESSION_ID),
    sessionIdle(OTHER_SESSION_ID),
  ];
  const noise = [
    serverConnected(),
    null,
    'text',
    42,
    { type: 'tui.toast.show', properties: {} },
    { type: 1 },
  ];
  expect(mapAll([...other, ...noise])).toEqual([]);
});

function text(value: string): AdapterEvent {
  return { type: 'text', text: value };
}

function partOf(event: RawEvent): Record<string, unknown> {
  return event.properties.part as Record<string, unknown>;
}

function withDelta(event: RawEvent, delta: string): RawEvent {
  return { ...event, properties: { ...event.properties, delta } };
}
