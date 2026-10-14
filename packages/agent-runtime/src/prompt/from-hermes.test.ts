import { describe, expect, test } from 'bun:test';
import type { AssembledContext, ContextLayer, ContextLayerId } from '@redhunter/hermes';
import type { OmoPolicy } from '@redhunter/shared';
import { makeInput } from '../test-support/prompt-input';
import { HERMES_CONTEXT_VERSION, type PromptBase, promptInputFromHermes } from './from-hermes';

const POLICY: OmoPolicy = {
  maxRetries: 1,
  maxTurns: 9,
  budgetTokens: 4321,
  allowedTools: ['edit'],
  escalationChain: ['cto', 'human'],
};

function layer(id: ContextLayerId, texts: readonly string[]): ContextLayer {
  return {
    id,
    blocks: texts.map((text, index) => ({ id: `${id}-${index}`, text, tokens: 1 })),
    tokens: texts.length,
  };
}

function context(layers: Partial<Record<ContextLayerId, readonly string[]>>): AssembledContext {
  // Deliberately NOT in hermes order: mapping must go by layer id, not by position.
  const order: ContextLayerId[] = ['rag', 'experience', 'profile', 'memories', 'skills'];
  return {
    agentId: 'programming',
    budget: 100,
    layers: order.map((id) => layer(id, layers[id] ?? [])),
    totalTokens: 0,
    dropped: [],
  };
}

const fixture = makeInput();
const BASE: PromptBase = {
  constitution: fixture.constitution,
  identity: fixture.identity,
  rolePolicy: fixture.rolePolicy,
  omoPolicy: { version: 7, outputContract: 'JSON please' },
  project: fixture.project,
  task: fixture.task,
};

describe('promptInputFromHermes', () => {
  test('maps skills, merges memories then experience into layer 6, and maps rag', () => {
    const input = promptInputFromHermes(
      context({
        profile: ['Name: Pip'],
        skills: ['## TDD\nred first'],
        memories: ['[episodic] m1', '[semantic] m2'],
        experience: ['bugfix (pass): x'],
        rag: ['Doc: text'],
      }),
      BASE,
      POLICY,
    );
    expect(input.skills).toEqual({ version: HERMES_CONTEXT_VERSION, items: ['## TDD\nred first'] });
    expect(input.memory).toEqual({
      version: HERMES_CONTEXT_VERSION,
      items: ['[episodic] m1', '[semantic] m2', 'bugfix (pass): x'],
    });
    expect(input.rag).toEqual({ version: HERMES_CONTEXT_VERSION, items: ['Doc: text'] });
  });

  test('profile layer is not copied into any items layer (identity comes from base)', () => {
    const input = promptInputFromHermes(context({ profile: ['Name: Pip'] }), BASE, POLICY);
    expect([...input.skills.items, ...input.memory.items, ...input.rag.items]).toEqual([]);
    expect(input.identity).toBe(BASE.identity);
  });

  test('injects the resolved policy into layer 4 with the base version and contract', () => {
    const input = promptInputFromHermes(context({}), BASE, POLICY);
    expect(input.omoPolicy).toEqual({ version: 7, outputContract: 'JSON please', policy: POLICY });
  });

  test('passes base layers through untouched', () => {
    const input = promptInputFromHermes(context({}), BASE, POLICY);
    expect(input.constitution).toBe(BASE.constitution);
    expect(input.rolePolicy).toBe(BASE.rolePolicy);
    expect(input.project).toBe(BASE.project);
    expect(input.task).toBe(BASE.task);
  });

  test('missing hermes layers become empty items', () => {
    const empty: AssembledContext = { ...context({}), layers: [] };
    const input = promptInputFromHermes(empty, BASE, POLICY);
    expect(input.memory.items).toEqual([]);
    expect(input.skills.items).toEqual([]);
  });

  test('version is 1', () => {
    expect(HERMES_CONTEXT_VERSION).toBe(1);
  });
});
