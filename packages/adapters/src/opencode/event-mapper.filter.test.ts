import { describe, expect, test } from 'bun:test';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { OpencodeEventMapper } from './event-mapper';
import {
  BASH_INPUT,
  messageUpdated,
  patchPart,
  permissionAsked,
  permissionUpdatedV1,
  type RawEvent,
  SESSION_ID,
  sessionIdle,
  stepFinish,
  textDelta,
  textPart,
  toolPart,
} from './test-support/events';

const ASSISTANT = messageUpdated('msg_assistant', 'assistant');
const ERROR_STATE = {
  status: 'error',
  input: BASH_INPUT,
  error: 'boom',
  time: { start: 1, end: 2 },
};
const COMPLETED_STATE = { ...ERROR_STATE, status: 'completed', output: '', title: 't' };

function mapAll(raws: readonly unknown[]): AdapterEvent[] {
  const mapper = new OpencodeEventMapper(SESSION_ID);
  const events = raws.flatMap((raw) => mapper.map(raw));
  for (const event of events) AdapterEventSchema.parse(event);
  return events;
}

function completedTools(raws: readonly unknown[]): AdapterEvent[] {
  return mapAll(raws).filter((event) => event.type === 'tool' && event.status === 'completed');
}

describe('error-state tool never carries exitCode', () => {
  test.each([
    ['integer 1', 1],
    ['integer 0', 0],
    ['non-integer 1.5', 1.5],
    ['string "1"', '1'],
  ])('error state with metadata.exit %s -> completed without exitCode', (_label, exit) => {
    const events = completedTools([toolPart('c', { ...ERROR_STATE, metadata: { exit } })]);
    expect<unknown>(events).toEqual([
      { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'completed' },
    ]);
    expect(events.every((event) => !('exitCode' in event))).toBe(true);
  });

  test('control: the same metadata on a completed state does yield exitCode', () => {
    const events = completedTools([toolPart('c', { ...COMPLETED_STATE, metadata: { exit: 1 } })]);
    expect<unknown>(events).toEqual([
      { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'completed', exitCode: 1 },
    ]);
  });

  test('error first, then completed with exit: the single completed event has no exitCode', () => {
    const events = completedTools([
      toolPart('c', { ...ERROR_STATE, metadata: { exit: 1 } }),
      toolPart('c', { ...COMPLETED_STATE, metadata: { exit: 0 } }),
    ]);
    expect(events).toHaveLength(1);
    expect('exitCode' in (events[0] ?? {})).toBe(false);
  });

  test('started events never carry exitCode, even when running state has metadata.exit', () => {
    const running = { status: 'running', input: BASH_INPUT, metadata: { exit: 0 }, time: {} };
    const events = mapAll([toolPart('c', running)]);
    expect<unknown>(events).toEqual([
      { type: 'tool', name: 'bash', input: BASH_INPUT, status: 'started' },
    ]);
  });
});

// Hapus sessionID di semua level yang dibaca sessionOf(): properties, part, info.
function withoutSession(event: RawEvent): RawEvent {
  const { sessionID: _top, ...properties } = event.properties;
  for (const key of ['part', 'info'] as const) {
    const nested = properties[key];
    if (typeof nested === 'object' && nested !== null) {
      const { sessionID: _nested, ...rest } = nested as Record<string, unknown>;
      properties[key] = rest;
    }
  }
  return { ...event, properties };
}

function withSession(event: RawEvent, sessionID: string): RawEvent {
  return { ...event, properties: { ...event.properties, sessionID } };
}

describe('events without a sessionID are ignored (only session.error fails closed)', () => {
  const cases: ReadonlyArray<readonly [string, RawEvent, readonly string[]]> = [
    ['session.idle', sessionIdle(), ['completed']],
    ['permission.asked (v2)', permissionAsked('per_1'), ['permission_request']],
    ['permission.updated (v1)', permissionUpdatedV1('per_2'), ['permission_request']],
    ['tool part', toolPart('c', { ...COMPLETED_STATE, metadata: { exit: 0 } }), ['tool', 'tool']],
    ['patch part', patchPart('p', ['a.ts']), ['file_change']],
    [
      'step-finish part',
      stepFinish('s', { input: 1, output: 1, reasoning: 0, cache: {} }),
      ['usage'],
    ],
  ];

  test.each(cases)('%s without sessionID maps to nothing', (_label, valid, controlTypes) => {
    const sessionless = withoutSession(valid);
    expect(JSON.stringify(valid)).toContain('"sessionID"');
    expect(JSON.stringify(sessionless)).not.toContain('sessionID');
    expect(mapAll([valid]).map((event): string => event.type)).toEqual([...controlTypes]);
    expect(mapAll([sessionless])).toEqual([]);
  });

  test('session.idle with an empty sessionID maps to nothing', () => {
    expect(mapAll([withSession(withoutSession(sessionIdle()), '')])).toEqual([]);
  });

  test('message.updated without sessionID does not register an assistant message', () => {
    const answer = textPart('p', 'hello');
    expect<unknown>(mapAll([ASSISTANT, answer])).toEqual([{ type: 'text', text: 'hello' }]);
    expect(mapAll([withoutSession(ASSISTANT), answer])).toEqual([]);
  });

  test('message.part.delta without sessionID adds no text', () => {
    const prelude = [ASSISTANT, textPart('p', '')];
    const delta = textDelta('p', 'hi');
    expect<unknown>(mapAll([...prelude, delta])).toEqual([{ type: 'text', text: 'hi' }]);
    expect(mapAll([...prelude, withoutSession(delta)])).toEqual([]);
  });

  test('a whole session-less run yields no events at all', () => {
    const run = [ASSISTANT, textPart('p', 'x'), permissionAsked('per_3'), sessionIdle()];
    expect(mapAll(run.map(withoutSession))).toEqual([]);
  });
});
