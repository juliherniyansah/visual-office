import { describe, expect, test } from 'bun:test';
import type { z } from 'zod';
import {
  AGENT_IDS,
  AGENT_STATUSES,
  AgentIdSchema,
  AgentStatusSchema,
  FloorIdSchema,
  HUMAN_ROLES,
  HumanRoleSchema,
  RUN_STATUSES,
  RunStatusSchema,
  TASK_STATUSES,
  TaskStatusSchema,
} from './enums';

const INVALID_VALUE = 'dancing';

const ENUM_CASES: ReadonlyArray<[string, z.ZodType, readonly string[]]> = [
  [
    'AgentStatus',
    AgentStatusSchema,
    ['idle', 'thinking', 'working', 'blocked', 'waiting_permission', 'offline'],
  ],
  [
    'RunStatus',
    RunStatusSchema,
    ['queued', 'composing', 'executing', 'verifying', 'succeeded', 'failed', 'escalated', 'paused'],
  ],
  [
    'TaskStatus',
    TaskStatusSchema,
    ['planned', 'assigned', 'in_progress', 'paused', 'cancelled', 'done', 'escalated'],
  ],
  ['HumanRole', HumanRoleSchema, ['owner', 'operator', 'viewer']],
  ['AgentId', AgentIdSchema, ['ceo', 'coo', 'cto', 'programming', 'game', 'iot', 'ai_development']],
];

describe('status enums', () => {
  for (const [name, schema, values] of ENUM_CASES) {
    test(`${name} accepts every valid value`, () => {
      for (const value of values) {
        expect(schema.parse(value)).toBe(value);
      }
    });

    test(`${name} rejects '${INVALID_VALUE}'`, () => {
      expect(schema.safeParse(INVALID_VALUE).success).toBe(false);
    });
  }

  test("AgentStatusSchema.parse('dancing') throws", () => {
    expect(() => AgentStatusSchema.parse(INVALID_VALUE)).toThrow();
  });

  test('value lists match the plan exactly', () => {
    expect([...AGENT_STATUSES]).toEqual([
      'idle',
      'thinking',
      'working',
      'blocked',
      'waiting_permission',
      'offline',
    ]);
    expect([...RUN_STATUSES]).toEqual([
      'queued',
      'composing',
      'executing',
      'verifying',
      'succeeded',
      'failed',
      'escalated',
      'paused',
    ]);
    expect([...TASK_STATUSES]).toEqual([
      'planned',
      'assigned',
      'in_progress',
      'paused',
      'cancelled',
      'done',
      'escalated',
    ]);
    expect([...HUMAN_ROLES]).toEqual(['owner', 'operator', 'viewer']);
    expect(AGENT_IDS).toHaveLength(7);
  });

  test('FloorIdSchema accepts 1..4 only', () => {
    for (const floor of [1, 2, 3, 4] as const) {
      expect(FloorIdSchema.parse(floor)).toBe(floor);
    }
    expect(FloorIdSchema.safeParse(0).success).toBe(false);
    expect(FloorIdSchema.safeParse(5).success).toBe(false);
  });
});
