import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { makeInput, withBudget } from '../test-support/prompt-input';
import { composePrompt } from './composer';
import type { PromptInput } from './layers';

const BASE = makeInput();
const hashOf = (input: PromptInput): string => composePrompt(input).hash;

// Canonical form: keys sorted at every level, no whitespace (documented contract).
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

describe('snapshot hash', () => {
  test('is sha256 over the canonical {layers, text, version} of the output', () => {
    const composed = composePrompt(BASE);
    const expected = createHash('sha256')
      .update(
        canonical({ version: composed.version, layers: composed.layers, text: composed.text }),
      )
      .digest('hex');
    expect(composed.hash).toBe(expected);
  });

  test('same input gives the same hash across calls', () => {
    expect(hashOf(makeInput())).toBe(hashOf(makeInput()));
  });

  test('does not depend on object key insertion order', () => {
    const reordered: PromptInput = {
      task: { constraints: [], acceptance: ['tests pass'], directive: 'Fix the bug', version: 89 },
      project: { items: ['repo map', 'conventions'], version: 78 },
      rag: { items: ['doc A', 'doc B'], version: 67 },
      memory: { items: ['mem A', 'mem B'], version: 56 },
      skills: { items: ['skill A', 'skill B'], version: 45 },
      omoPolicy: {
        outputContract: 'Return a JSON summary.',
        policy: {
          escalationChain: ['cto', 'human'],
          maxTurns: 8,
          maxRetries: 2,
          budgetTokens: BASE.omoPolicy.policy.budgetTokens,
        },
        version: 34,
      },
      rolePolicy: {
        forbidden: ['create directives'],
        allowed: ['write code'],
        role: 'domain',
        company: 'RedHunter',
        version: 23,
      },
      identity: {
        voiceGuidelines: 'Short sentences.',
        personalityTraits: ['precise', 'calm'],
        role: 'Programming lead',
        name: 'Ada',
        version: 12,
      },
      constitution: { text: 'Be honest. Earlier layers win.', version: 1 },
    };
    expect(hashOf(reordered)).toBe(hashOf(BASE));
  });

  test('fixture composition (text, layers, hash) matches the stored snapshot', () => {
    expect(composePrompt(BASE)).toMatchSnapshot();
  });

  const contentChanges: [string, PromptInput][] = [
    ['constitution text', makeInput({ constitution: { version: 1, text: 'Be honest!' } })],
    ['identity name', makeInput({ identity: { ...BASE.identity, name: 'Bob' } })],
    ['role forbidden', makeInput({ rolePolicy: { ...BASE.rolePolicy, forbidden: ['x'] } })],
    ['omo contract', makeInput({ omoPolicy: { ...BASE.omoPolicy, outputContract: 'Text.' } })],
    ['skills item', makeInput({ skills: { version: 45, items: ['skill A', 'skill C'] } })],
    ['memory item', makeInput({ memory: { version: 56, items: ['mem A'] } })],
    ['rag item', makeInput({ rag: { version: 67, items: ['doc B', 'doc A'] } })],
    ['project item', makeInput({ project: { version: 78, items: ['repo map!', 'conventions'] } })],
    ['task directive', makeInput({ task: { ...BASE.task, directive: 'Fix the bugs' } })],
  ];
  const versionChanges: [string, PromptInput][] = [
    ['constitution', makeInput({ constitution: { ...BASE.constitution, version: 2 } })],
    ['identity', makeInput({ identity: { ...BASE.identity, version: 13 } })],
    ['rolePolicy', makeInput({ rolePolicy: { ...BASE.rolePolicy, version: 24 } })],
    ['omoPolicy', makeInput({ omoPolicy: { ...BASE.omoPolicy, version: 35 } })],
    ['skills', makeInput({ skills: { ...BASE.skills, version: 46 } })],
    ['memory', makeInput({ memory: { ...BASE.memory, version: 57 } })],
    ['rag', makeInput({ rag: { ...BASE.rag, version: 68 } })],
    ['project', makeInput({ project: { ...BASE.project, version: 79 } })],
    ['task', makeInput({ task: { ...BASE.task, version: 90 } })],
  ];

  test.each(contentChanges)('changes when %s content changes', (_name, changed) => {
    expect(hashOf(changed)).not.toBe(hashOf(BASE));
  });

  test.each(versionChanges)('changes when %s version changes', (_name, changed) => {
    expect(hashOf(changed)).not.toBe(hashOf(BASE));
  });

  test('all variant hashes are distinct from each other', () => {
    const hashes = [BASE, ...contentChanges.map(([, i]) => i), ...versionChanges.map(([, i]) => i)];
    expect(new Set(hashes.map(hashOf)).size).toBe(hashes.length);
  });

  test('a budget change that does not change the composition keeps the hash', () => {
    expect(hashOf(withBudget(BASE, 20_000))).toBe(hashOf(BASE));
  });

  test('a budget change that truncates a layer changes the hash', () => {
    const full = composePrompt(BASE);
    expect(hashOf(withBudget(BASE, full.tokens - 1))).not.toBe(full.hash);
  });
});
