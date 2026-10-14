import { expect, test } from 'bun:test';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { OpencodeEventMapper } from './event-mapper';
import { BASH_INPUT, SESSION_ID, toolPart } from './test-support/events';

const COMPLETED = {
  status: 'completed',
  input: BASH_INPUT,
  output: 'hello\n',
  title: 'echo hello',
  metadata: { exit: 0 },
  time: { start: 1, end: 2 },
};
const ERROR = {
  status: 'error',
  input: BASH_INPUT,
  error: 'late failure',
  time: { start: 1, end: 3 },
};

function toolStatuses(raws: readonly unknown[]): string[] {
  const mapper = new OpencodeEventMapper(SESSION_ID);
  const events: AdapterEvent[] = raws.flatMap((raw) => mapper.map(raw));
  for (const event of events) AdapterEventSchema.parse(event);
  return events.map((event) => (event.type === 'tool' ? event.status : event.type));
}

test('repeated completed updates for one callID emit exactly one completed tool event', () => {
  const statuses = toolStatuses([
    toolPart('call_1', COMPLETED),
    toolPart('call_1', COMPLETED),
    toolPart('call_1', { ...COMPLETED, output: 'hello\nagain' }),
  ]);
  expect(statuses).toEqual(['started', 'completed']);
});

test('completed then error for one callID emits exactly one completed tool event', () => {
  expect(toolStatuses([toolPart('call_1', COMPLETED), toolPart('call_1', ERROR)])).toEqual([
    'started',
    'completed',
  ]);
});

test('completed dedupe is per callID: another call still completes', () => {
  const statuses = toolStatuses([
    toolPart('call_1', COMPLETED),
    toolPart('call_1', COMPLETED),
    toolPart('call_2', ERROR),
  ]);
  expect(statuses).toEqual(['started', 'completed', 'started', 'completed']);
});
