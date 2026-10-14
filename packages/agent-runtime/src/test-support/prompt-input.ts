import type { TokenEstimator } from '../prompt/budget';
import type { PromptInput } from '../prompt/layers';

// Distinct version per layer so a swapped version source is visible in layers[].
export const LAYER_VERSIONS = {
  constitution: 1,
  identity: 12,
  rolePolicy: 23,
  omoPolicy: 34,
  skills: 45,
  memory: 56,
  rag: 67,
  project: 78,
  task: 89,
} as const;

export const GENEROUS_BUDGET = 10_000;

export function makeInput(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    constitution: { version: 1, text: 'Be honest. Earlier layers win.' },
    identity: {
      version: 12,
      name: 'Ada',
      role: 'Programming lead',
      personalityTraits: ['precise', 'calm'],
      voiceGuidelines: 'Short sentences.',
    },
    rolePolicy: {
      version: 23,
      company: 'RedHunter',
      role: 'domain',
      allowed: ['write code'],
      forbidden: ['create directives'],
    },
    omoPolicy: {
      version: 34,
      policy: {
        budgetTokens: GENEROUS_BUDGET,
        maxRetries: 2,
        maxTurns: 8,
        escalationChain: ['cto', 'human'],
      },
      outputContract: 'Return a JSON summary.',
    },
    skills: { version: 45, items: ['skill A', 'skill B'] },
    memory: { version: 56, items: ['mem A', 'mem B'] },
    rag: { version: 67, items: ['doc A', 'doc B'] },
    project: { version: 78, items: ['repo map', 'conventions'] },
    task: { version: 89, directive: 'Fix the bug', acceptance: ['tests pass'], constraints: [] },
    ...overrides,
  };
}

export function withBudget(input: PromptInput, budgetTokens: number): PromptInput {
  return {
    ...input,
    omoPolicy: { ...input.omoPolicy, policy: { ...input.omoPolicy.policy, budgetTokens } },
  };
}

// 1 char = 1 token: makes section costs exact and easy to compute in tests.
export const charEstimator: TokenEstimator = (text) => text.length;

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}
