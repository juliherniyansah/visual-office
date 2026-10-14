import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { CodexEventMapper } from './event-mapper';

const FIXTURE = join(import.meta.dir, 'test-support/codex.jsonl');

function mapAll(mapper: CodexEventMapper, lines: readonly unknown[]): AdapterEvent[] {
  return lines.flatMap((line) => mapper.map(line).map((event) => AdapterEventSchema.parse(event)));
}

const item = (kind: 'started' | 'completed', body: Record<string, unknown>) => ({
  type: `item.${kind}`,
  item: body,
});
const command = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  type: 'command_execution',
  command: 'ls',
  aggregated_output: '',
  exit_code: null,
  status,
  ...extra,
});

test('codex.jsonl fixture parses to the expected AdapterEvent sequence', () => {
  const lines = readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line): unknown => JSON.parse(line));
  expect<unknown>(mapAll(new CodexEventMapper(), lines)).toEqual([
    { type: 'started', vendorSessionId: '0199a213-81c0-7800-8aa1-bbab2a035a53' },
    { type: 'tool', name: 'bash', input: { command: 'bash -lc ls' }, status: 'started' },
    {
      type: 'tool',
      name: 'bash',
      input: { command: 'bash -lc ls' },
      status: 'completed',
      exitCode: 0,
    },
    { type: 'tool', name: 'bash', input: { command: "bash -lc 'rm -rf dist'" }, status: 'started' },
    {
      type: 'tool',
      name: 'bash',
      input: { command: "bash -lc 'rm -rf dist'" },
      status: 'completed',
    },
    {
      type: 'permission_request',
      permissionId: 'item_2',
      tool: 'bash',
      detail: "bash -lc 'rm -rf dist'",
    },
    { type: 'file_change', path: 'src/a.ts', kind: 'update' },
    { type: 'file_change', path: 'src/b.ts', kind: 'add' },
    { type: 'tool', name: 'docs.search', input: { q: 'x' }, status: 'started' },
    { type: 'tool', name: 'docs.search', input: { q: 'x' }, status: 'completed' },
    { type: 'text', text: 'Done: README.md listed.' },
    { type: 'usage', inputTokens: 1200, outputTokens: 95 },
    { type: 'completed', finalText: 'Done: README.md listed.' },
  ]);
});

describe('CodexEventMapper guards', () => {
  test('thread.started is emitted once; empty thread id is ignored', () => {
    const mapper = new CodexEventMapper();
    const started = { type: 'thread.started', thread_id: 't1' };
    expect<unknown>(mapAll(mapper, [{ type: 'thread.started', thread_id: '' }])).toEqual([]);
    expect(mapAll(mapper, [started, started])).toHaveLength(1);
  });

  test('unknown, malformed and ignored event types map to nothing', () => {
    const mapper = new CodexEventMapper();
    const ignored = [
      null,
      'text',
      [],
      { type: 'turn.started' },
      { type: 'future.event' },
      { notype: true },
      item('completed', { id: 'r', type: 'reasoning', text: 'secret thoughts' }),
      item('completed', { id: 't', type: 'todo_list', items: [] }),
      item('completed', { id: 'e', type: 'error', message: 'non fatal' }),
      item('completed', { type: 'agent_message', text: 'no id' }),
      { type: 'item.completed' },
    ];
    expect<unknown>(mapAll(mapper, ignored)).toEqual([]);
  });

  test('agent text is accumulated into finalText in order', () => {
    const mapper = new CodexEventMapper();
    const events = mapAll(mapper, [
      item('completed', { id: 'a', type: 'agent_message', text: 'one' }),
      item('completed', { id: 'b', type: 'agent_message', text: 'two' }),
      item('completed', { id: 'b', type: 'agent_message', text: 'two' }),
      { type: 'turn.completed', usage: {} },
    ]);
    expect<unknown>(events.at(-1)).toEqual({ type: 'completed', finalText: 'one\ntwo' });
    expect(events.filter((event) => event.type === 'text')).toHaveLength(2);
  });

  test('tool started/completed are emitted once per item id', () => {
    const mapper = new CodexEventMapper();
    const events = mapAll(mapper, [
      item('started', command('in_progress')),
      item('started', command('in_progress')),
      item('completed', command('completed', { exit_code: 1 })),
      item('completed', command('completed', { exit_code: 1 })),
    ]);
    expect(events.map((event): string => (event.type === 'tool' ? event.status : ''))).toEqual([
      'started',
      'completed',
    ]);
    expect(events.at(-1)).toMatchObject({ exitCode: 1 });
  });

  test('completed without a started event still yields started then completed', () => {
    const events = mapAll(new CodexEventMapper(), [item('completed', command('failed'))]);
    expect(events.map((event): string => (event.type === 'tool' ? event.status : ''))).toEqual([
      'started',
      'completed',
    ]);
  });

  test('exit code is kept only when it is an integer', () => {
    for (const exit of [1.5, '1', null]) {
      const events = mapAll(new CodexEventMapper(), [
        item('completed', command('completed', { exit_code: exit })),
      ]);
      expect(events.at(-1)).not.toHaveProperty('exitCode');
    }
  });

  test('only a declined command asks for permission, once', () => {
    const declined = item('completed', command('declined'));
    const permissions = (raw: unknown[]) =>
      mapAll(new CodexEventMapper(), raw).filter((event) => event.type === 'permission_request');
    expect(permissions([declined, declined])).toHaveLength(1);
    expect(permissions([item('completed', command('failed'))])).toHaveLength(0);
  });

  test('file changes: failed patch and repeated item emit nothing more', () => {
    const change = (status: string, id = 'f1') =>
      item('completed', {
        id,
        type: 'file_change',
        changes: [{ path: 'x.ts', kind: 'delete' }, { path: '' }, 'bad'],
        status,
      });
    const mapper = new CodexEventMapper();
    expect<unknown>(mapAll(mapper, [change('completed'), change('completed')])).toEqual([
      { type: 'file_change', path: 'x.ts', kind: 'delete' },
    ]);
    expect<unknown>(mapAll(mapper, [change('failed', 'f2')])).toEqual([]);
  });

  test('turn.completed usage: invalid counts become 0', () => {
    const events = mapAll(new CodexEventMapper(), [
      { type: 'turn.completed', usage: { input_tokens: -3, output_tokens: 'x' } },
    ]);
    expect<unknown>(events[0]).toEqual({ type: 'usage', inputTokens: 0, outputTokens: 0 });
  });

  test('structured output: final message parsed as JSON only when requested', () => {
    const lines = [
      item('completed', { id: 'a', type: 'agent_message', text: '{"ok":true}' }),
      { type: 'turn.completed', usage: {} },
    ];
    expect(mapAll(new CodexEventMapper({ isStructured: true }), lines).at(-1)).toMatchObject({
      structured: { ok: true },
    });
    expect(mapAll(new CodexEventMapper(), lines).at(-1)).not.toHaveProperty('structured');
    const broken = [item('completed', { id: 'a', type: 'agent_message', text: 'not json' })];
    const last = mapAll(new CodexEventMapper({ isStructured: true }), [
      ...broken,
      { type: 'turn.completed', usage: {} },
    ]).at(-1);
    expect(last).not.toHaveProperty('structured');
  });

  test('turn.failed -> failed with the message; error lines are remembered, not terminal', () => {
    const mapper = new CodexEventMapper();
    expect<unknown>(mapAll(mapper, [{ type: 'error', message: 'Reconnecting... 1/5' }])).toEqual(
      [],
    );
    expect(mapper.lastError).toBe('Reconnecting... 1/5');
    expect<unknown>(mapAll(mapper, [{ type: 'turn.failed', error: { message: 'boom' } }])).toEqual([
      { type: 'failed', error: 'boom' },
    ]);
    expect<unknown>(new CodexEventMapper().map({ type: 'turn.failed' })).toEqual([
      { type: 'failed', error: 'codex turn failed' },
    ]);
  });
});
