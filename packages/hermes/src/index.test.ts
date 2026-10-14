import { describe, expect, test } from 'bun:test';
import {
  assembleContext,
  CONTEXT_LAYER_IDS,
  createHermesModels,
  estimateTokens,
  HermesAccessError,
  HermesBudgetError,
  HermesNotFoundError,
  HermesStore,
  hydrateKnowledgeStore,
  InMemoryKnowledgeStore,
  PACKAGE_NAME,
  rankMemories,
  seedProfiles,
} from './index';

describe('package entry (src/index.ts)', () => {
  test('PACKAGE_NAME is @redhunter/hermes', () => {
    expect(PACKAGE_NAME).toBe('@redhunter/hermes');
  });

  // One symbol per re-exported module, so dropping any `export *` line is caught.
  test.each([
    ['context', assembleContext],
    ['context', rankMemories],
    ['errors', HermesAccessError],
    ['knowledge', InMemoryKnowledgeStore],
    ['knowledge', hydrateKnowledgeStore],
    ['models', createHermesModels],
    ['seed', seedProfiles],
    ['store', HermesStore],
    ['tokens', estimateTokens],
  ] as const)('re-exports %s module', (_module, exported) => {
    expect(typeof exported).toBe('function');
  });

  test('CONTEXT_LAYER_IDS order is profile, skills, memories, experience, rag', () => {
    expect(CONTEXT_LAYER_IDS).toEqual(['profile', 'skills', 'memories', 'experience', 'rag']);
  });
});

describe('error classes', () => {
  test('names and AccessError message are exact', () => {
    const access = new HermesAccessError('ceo', 'iot');
    expect(access.name).toBe('HermesAccessError');
    expect(access.message).toBe('Agent iot may not read Hermes data of ceo');
    expect(new HermesNotFoundError('x').name).toBe('HermesNotFoundError');
    expect(new HermesBudgetError('x').name).toBe('HermesBudgetError');
  });
});

describe('estimateTokens whitespace', () => {
  test('whitespace counts like any other character', () => {
    expect(estimateTokens('    ')).toBe(1);
    expect(estimateTokens('     ')).toBe(2);
    expect(estimateTokens(' ab ')).toBe(1);
  });
});
