import { describe, expect, test } from 'bun:test';
import type { Actor, OmoPolicy } from '@redhunter/shared';
import { PolicyOverrideError, resolvePolicy } from './policy';

const AGENT_DEFAULT: OmoPolicy = {
  maxRetries: 2,
  maxTurns: 30,
  budgetTokens: 32_000,
  allowedTools: ['edit'],
  escalationChain: ['coo', 'cto', 'human'],
};

const agent = (id: string): Actor => ({ kind: 'agent', id });

describe('resolvePolicy', () => {
  test('without override returns the agent default', () => {
    expect(resolvePolicy({ agentPolicy: AGENT_DEFAULT })).toEqual(AGENT_DEFAULT);
  });

  test('returns a copy, never the stored object', () => {
    const resolved = resolvePolicy({ agentPolicy: AGENT_DEFAULT });
    expect(resolved).not.toBe(AGENT_DEFAULT);
    expect(resolved.escalationChain).not.toBe(AGENT_DEFAULT.escalationChain);
  });

  test.each(['coo', 'cto'])('override by manager %s wins per field', (managerId) => {
    const resolved = resolvePolicy({
      agentPolicy: AGENT_DEFAULT,
      override: { override: { maxRetries: 0, allowedTools: [] }, actor: agent(managerId) },
    });
    expect(resolved).toEqual({ ...AGENT_DEFAULT, maxRetries: 0, allowedTools: [] });
  });

  test('every override field is applied', () => {
    const full: OmoPolicy = {
      maxRetries: 5,
      maxTurns: 3,
      budgetTokens: 1000,
      allowedTools: ['bash'],
      escalationChain: ['human'],
    };
    expect(
      resolvePolicy({
        agentPolicy: AGENT_DEFAULT,
        override: { override: full, actor: agent('cto') },
      }),
    ).toEqual(full);
  });

  test('empty override needs no RBAC and changes nothing', () => {
    expect(
      resolvePolicy({
        agentPolicy: AGENT_DEFAULT,
        override: { override: {}, actor: agent('iot') },
      }),
    ).toEqual(AGENT_DEFAULT);
  });

  test.each([
    ['ceo (executive)', agent('ceo')],
    ['programming (domain)', agent('programming')],
    ['unknown agent', agent('intern')],
    ['human owner', { kind: 'human', id: 'coo' } as Actor],
    ['system', { kind: 'system', id: 'cto' } as Actor],
  ])('override by %s is rejected with PolicyOverrideError', (_label, actor) => {
    let caught: unknown;
    try {
      resolvePolicy({
        agentPolicy: AGENT_DEFAULT,
        override: { override: { maxRetries: 9 }, actor },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PolicyOverrideError);
    expect((caught as Error).name).toBe('PolicyOverrideError');
    expect((caught as Error).message).toBe(
      `Actor ${actor.kind}:${actor.id} may not override the OMO policy (manager only)`,
    );
  });

  test('corrupt agent default is rejected by OmoPolicySchema', () => {
    const corrupt = { ...AGENT_DEFAULT, maxTurns: 0 };
    expect(() => resolvePolicy({ agentPolicy: corrupt })).toThrow(
      expect.objectContaining({ name: 'ZodError' }),
    );
  });

  test('corrupt override value is rejected by the schema even from a manager', () => {
    expect(() =>
      resolvePolicy({
        agentPolicy: AGENT_DEFAULT,
        override: { override: { maxRetries: -1 }, actor: agent('coo') },
      }),
    ).toThrow(expect.objectContaining({ name: 'ZodError' }));
  });

  test('unknown escalation target in override is rejected', () => {
    const override = { escalationChain: ['janitor'] } as unknown as Partial<OmoPolicy>;
    expect(() =>
      resolvePolicy({ agentPolicy: AGENT_DEFAULT, override: { override, actor: agent('coo') } }),
    ).toThrow(expect.objectContaining({ name: 'ZodError' }));
  });
});
