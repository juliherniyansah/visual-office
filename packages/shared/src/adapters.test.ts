import { describe, expect, test } from 'bun:test';
import {
  type AdapterEvent,
  AdapterEventSchema,
  AdapterRunInputSchema,
  PERMISSION_DECISIONS,
  PermissionDecisionSchema,
} from './index';

// Plan section 8, in order. Each sample carries every field (optional ones included).
const EVENT_SAMPLES: readonly AdapterEvent[] = [
  { type: 'started', vendorSessionId: 'ses_1' },
  { type: 'text', text: 'Working...' },
  { type: 'tool', name: 'bash', input: { command: 'bun test' }, status: 'completed', exitCode: 0 },
  { type: 'file_change', path: 'src/a.ts', kind: 'modified' },
  { type: 'permission_request', permissionId: 'perm-1', tool: 'bash', detail: 'rm -rf dist' },
  { type: 'usage', inputTokens: 100, outputTokens: 20, costUsd: 0.01 },
  { type: 'completed', finalText: 'done', structured: { ok: true } },
  { type: 'failed', error: 'boom' },
];

const RUN_INPUT = {
  runId: 'run-1',
  agentId: 'programming',
  cwd: '/srv/repos/redhunter',
  prompt: 'Fix the login bug.',
};

describe('AdapterEventSchema', () => {
  test('has exactly the plan section 8 variants in order', () => {
    const types = AdapterEventSchema.options.map((option) => option.shape.type.value);
    expect(types).toEqual(EVENT_SAMPLES.map((event) => event.type));
  });

  test.each(EVENT_SAMPLES.map((event) => [event.type, event] as const))(
    'round-trips %s with all fields',
    (_type, event) => {
      expect(AdapterEventSchema.parse(event)).toEqual(event);
    },
  );

  test.each([
    ['started without vendorSessionId', { type: 'started' }],
    ['tool with unknown status', { type: 'tool', name: 'bash', input: {}, status: 'running' }],
    [
      'tool with fractional exitCode',
      { type: 'tool', name: 'x', input: 1, status: 'completed', exitCode: 1.5 },
    ],
    [
      'permission_request without permissionId',
      { type: 'permission_request', tool: 'b', detail: '' },
    ],
    ['usage with negative tokens', { type: 'usage', inputTokens: -1, outputTokens: 0 }],
    ['failed without error', { type: 'failed' }],
    ['unknown type', { type: 'teleport' }],
  ])('rejects %s', (_label, value) => {
    expect(AdapterEventSchema.safeParse(value).success).toBe(false);
  });
});

describe('PermissionDecisionSchema', () => {
  test('accepts only allow and deny', () => {
    expect(PERMISSION_DECISIONS).toEqual(['allow', 'deny']);
    expect(PermissionDecisionSchema.safeParse('allow').success).toBe(true);
    expect(PermissionDecisionSchema.safeParse('deny').success).toBe(true);
    expect(PermissionDecisionSchema.safeParse('ask').success).toBe(false);
  });
});

describe('AdapterRunInputSchema', () => {
  test('accepts the minimal input', () => {
    expect<unknown>(AdapterRunInputSchema.parse(RUN_INPUT)).toEqual(RUN_INPUT);
  });

  test('keeps optional policy, output schema and resume session id', () => {
    const full = {
      ...RUN_INPUT,
      policy: {
        maxRetries: 2,
        maxTurns: 30,
        budgetTokens: 16000,
        allowedTools: ['edit'],
        escalationChain: ['cto', 'human'],
      },
      outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      resumeVendorSessionId: 'ses_prev',
    };
    expect<unknown>(AdapterRunInputSchema.parse(full)).toEqual(full);
  });

  test.each([
    ['empty runId', { ...RUN_INPUT, runId: '' }],
    ['unknown agent', { ...RUN_INPUT, agentId: 'intern' }],
    ['empty cwd', { ...RUN_INPUT, cwd: '' }],
    ['empty prompt', { ...RUN_INPUT, prompt: '' }],
    ['empty resume id', { ...RUN_INPUT, resumeVendorSessionId: '' }],
    ['non-object output schema', { ...RUN_INPUT, outputSchema: 'json' }],
  ])('rejects %s', (_label, value) => {
    expect(AdapterRunInputSchema.safeParse(value).success).toBe(false);
  });
});
