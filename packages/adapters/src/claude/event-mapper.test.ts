import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AdapterEvent, AdapterEventSchema } from '@redhunter/shared';
import { ClaudeEventMapper } from './event-mapper';

const FIXTURE = join(import.meta.dir, 'test-support/claude.stream.jsonl');
const SESSION = '550e8400-e29b-41d4-a716-446655440000';

function mapAll(mapper: ClaudeEventMapper, lines: readonly unknown[]): AdapterEvent[] {
  return lines.flatMap((line) => mapper.map(line).map((event) => AdapterEventSchema.parse(event)));
}

const assistant = (content: unknown[], parent: string | null = null) => ({
  type: 'assistant',
  parent_tool_use_id: parent,
  message: { role: 'assistant', content },
});
const toolResult = (id: string, isError = false) => ({
  type: 'user',
  parent_tool_use_id: null,
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError }] },
});
const toolUse = (id: string, name: string, input: unknown) => ({
  type: 'tool_use',
  id,
  name,
  input,
});
const success = (extra: Record<string, unknown> = {}) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result: 'final',
  total_cost_usd: 0,
  usage: { input_tokens: 1, output_tokens: 2 },
  permission_denials: [],
  ...extra,
});

test('claude.stream.jsonl fixture parses to the expected AdapterEvent sequence', () => {
  const lines = readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line): unknown => JSON.parse(line));
  const edit = { file_path: '/tmp/work/src/a.ts', old_string: 'teh', new_string: 'the' };
  const bash = { command: 'rm -rf dist' };
  expect<unknown>(mapAll(new ClaudeEventMapper(), lines)).toEqual([
    { type: 'started', vendorSessionId: SESSION },
    { type: 'text', text: 'Fixing the typo.' },
    { type: 'tool', name: 'Edit', input: edit, status: 'started' },
    { type: 'tool', name: 'Edit', input: edit, status: 'completed' },
    { type: 'file_change', path: '/tmp/work/src/a.ts', kind: 'update' },
    { type: 'tool', name: 'Bash', input: bash, status: 'started' },
    { type: 'permission_request', permissionId: 'toolu_2', tool: 'Bash', detail: 'rm -rf dist' },
    { type: 'tool', name: 'Bash', input: bash, status: 'completed' },
    { type: 'text', text: 'Typo fixed in src/a.ts.' },
    { type: 'usage', inputTokens: 450, outputTokens: 80, costUsd: 0.0123 },
    { type: 'completed', finalText: 'Typo fixed in src/a.ts.' },
  ]);
});

describe('ClaudeEventMapper guards', () => {
  test('system/init starts once; other system subtypes and unknown lines are ignored', () => {
    const mapper = new ClaudeEventMapper();
    const init = { type: 'system', subtype: 'init', session_id: 's1' };
    const ignored = [
      null,
      42,
      [],
      { type: 'system', subtype: 'init', session_id: '' },
      { type: 'system', subtype: 'api_retry', session_id: 's1', error: 'overloaded' },
      { type: 'system', subtype: 'compact_boundary', session_id: 's1' },
      { type: 'stream_event', event: { delta: { type: 'text_delta', text: 'x' } } },
      { type: 'future' },
    ];
    expect<unknown>(mapAll(mapper, ignored)).toEqual([]);
    expect(mapAll(mapper, [init, init])).toHaveLength(1);
    expect(mapper.lastError).toBe('overloaded');
  });

  test('subagent text (parent_tool_use_id set) is not user-facing; its tools are', () => {
    const mapper = new ClaudeEventMapper();
    const events = mapAll(mapper, [
      assistant([{ type: 'text', text: 'sub' }, toolUse('t1', 'Read', {})], 'toolu_parent'),
      assistant([{ type: 'text', text: 'main' }]),
      success({ result: 42 }),
    ]);
    expect(events.map((event): string => event.type)).toEqual([
      'tool',
      'text',
      'usage',
      'completed',
    ]);
    expect<unknown>(events.at(-1)).toEqual({ type: 'completed', finalText: 'main' });
  });

  test('tool_use and tool_result are deduped per id; unknown tool_result ids are ignored', () => {
    const mapper = new ClaudeEventMapper();
    const use = assistant([toolUse('t1', 'Bash', { command: 'ls' })]);
    const events = mapAll(mapper, [
      use,
      use,
      toolResult('t1'),
      toolResult('t1'),
      toolResult('nope'),
    ]);
    expect(events.map((event): string => (event.type === 'tool' ? event.status : ''))).toEqual([
      'started',
      'completed',
    ]);
  });

  test('file_change only for a successful write tool with a path', () => {
    const run = (name: string, input: unknown, isError: boolean) =>
      mapAll(new ClaudeEventMapper(), [
        assistant([toolUse('t', name, input)]),
        toolResult('t', isError),
      ]).filter((event) => event.type === 'file_change');
    expect<unknown>(run('Write', { file_path: '/a' }, false)).toEqual([
      { type: 'file_change', path: '/a', kind: 'write' },
    ]);
    expect(run('Write', { file_path: '/a' }, true)).toHaveLength(0);
    expect(run('Read', { file_path: '/a' }, false)).toHaveLength(0);
    expect(run('Edit', { file_path: '' }, false)).toHaveLength(0);
    expect(run('NotebookEdit', { notebook_path: '/n.ipynb' }, false)).toHaveLength(1);
  });

  test('permission denial: system event and result.permission_denials emit one request', () => {
    const mapper = new ClaudeEventMapper();
    const denied = {
      type: 'system',
      subtype: 'permission_denied',
      tool_name: 'Bash',
      tool_use_id: 'p1',
      message: 'denied',
    };
    const denial = { tool_name: 'Bash', tool_use_id: 'p1', tool_input: { command: 'rm -rf /' } };
    const events = mapAll(mapper, [denied, denied, success({ permission_denials: [denial] })]);
    expect<unknown>(events.filter((event) => event.type === 'permission_request')).toEqual([
      { type: 'permission_request', permissionId: 'p1', tool: 'Bash', detail: 'denied' },
    ]);
    const late = mapAll(new ClaudeEventMapper(), [success({ permission_denials: [denial, 'x'] })]);
    expect<unknown>(late[0]).toEqual({
      type: 'permission_request',
      permissionId: 'p1',
      tool: 'Bash',
      detail: 'rm -rf /',
    });
    expect(late.map((event): string => event.type)).toEqual([
      'permission_request',
      'usage',
      'completed',
    ]);
  });

  test('result: structured output, missing cost, error subtypes', () => {
    const structured = mapAll(new ClaudeEventMapper(), [
      success({ structured_output: { ok: true }, total_cost_usd: 'x' }),
    ]);
    expect<unknown>(structured).toEqual([
      { type: 'usage', inputTokens: 1, outputTokens: 2 },
      { type: 'completed', finalText: 'final', structured: { ok: true } },
    ]);
    const maxTurns = mapAll(new ClaudeEventMapper(), [
      { type: 'result', subtype: 'error_max_turns', is_error: true, errors: [], usage: {} },
    ]);
    expect<unknown>(maxTurns.at(-1)).toEqual({ type: 'failed', error: 'error_max_turns' });
    const errored = mapAll(new ClaudeEventMapper(), [
      success({ is_error: true, result: 'Invalid API key' }),
    ]);
    expect<unknown>(errored.at(-1)).toEqual({ type: 'failed', error: 'Invalid API key' });
    const listed = new ClaudeEventMapper().map({
      type: 'result',
      subtype: 'error_during_execution',
      errors: ['a', 'b'],
    });
    expect<unknown>(listed.at(-1)).toEqual({ type: 'failed', error: 'a; b' });
  });
});
