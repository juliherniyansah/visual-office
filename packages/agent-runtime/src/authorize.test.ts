import { describe, expect, test } from 'bun:test';
import { AGENT_IDS } from '@redhunter/shared';
import {
  AGENT_ACTIONS,
  type AgentAction,
  AuthorizationError,
  assertAuthorized,
  authorize,
} from './authorize';

// Full role x action matrix (plan section 13): one allowed action per role.
const EXPECTED: Readonly<Record<string, AgentAction>> = {
  ceo: 'createDirective',
  coo: 'assignTask',
  cto: 'assignTask',
  programming: 'runAdapter',
  game: 'runAdapter',
  iot: 'runAdapter',
  ai_development: 'runAdapter',
};

describe('authorize', () => {
  test('acceptance pins', () => {
    expect(authorize('programming', 'createDirective')).toBe(false);
    expect(authorize('coo', 'assignTask')).toBe(true);
  });

  test('actions are exactly createDirective, assignTask, runAdapter', () => {
    expect(AGENT_ACTIONS).toEqual(['createDirective', 'assignTask', 'runAdapter']);
  });

  test.each(AGENT_IDS.flatMap((agentId) => AGENT_ACTIONS.map((action) => [agentId, action])))(
    '%s may %s only when it is the role action',
    (agentId, action) => {
      expect(authorize(agentId, action)).toBe(EXPECTED[agentId] === action);
    },
  );

  test.each([
    ['unknown agent', 'intern', 'runAdapter'],
    ['unknown action', 'ceo', 'deleteCompany'],
    ['prototype key as action', 'ceo', 'toString'],
    ['prototype key as agent', 'constructor', 'runAdapter'],
    ['empty strings', '', ''],
  ])('denies by default: %s', (_label, agentId, action) => {
    expect(authorize(agentId, action)).toBe(false);
  });
});

describe('assertAuthorized', () => {
  test('passes silently when allowed', () => {
    expect(() => assertAuthorized('ceo', 'createDirective')).not.toThrow();
  });

  test('throws a typed AuthorizationError with agent and action', () => {
    let caught: unknown;
    try {
      assertAuthorized('programming', 'createDirective');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthorizationError);
    const error = caught as AuthorizationError;
    expect(error.name).toBe('AuthorizationError');
    expect(error.agentId).toBe('programming');
    expect(error.action).toBe('createDirective');
    expect(error.message).toBe('Agent programming is not allowed to createDirective');
  });
});
