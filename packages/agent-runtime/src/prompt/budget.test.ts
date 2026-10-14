import { describe, expect, test } from 'bun:test';
import {
  assertBudget,
  DEFAULT_CHARS_PER_TOKEN,
  estimateTokens,
  fitFlexible,
  measureTokens,
  PromptBudgetError,
  TRUNCATION_ORDER,
} from './budget';
import type { FlexibleItems, FlexibleLayerId } from './layers';

describe('estimateTokens (default chars/4, ceil)', () => {
  test.each([
    ['', 0],
    ['a', 1],
    ['abcd', 1],
    ['abcde', 2],
    ['abcdefgh', 2],
    ['abcdefghi', 3],
  ])('%p -> %p', (text, expected) => {
    expect(estimateTokens(text)).toBe(expected);
  });

  test('counts UTF-16 units, not code points', () => {
    // 3 emoji = 6 UTF-16 units -> 2 tokens (code-point math would give 1).
    expect(estimateTokens('😀😀😀')).toBe(2);
  });

  test('does not trim whitespace', () => {
    expect(estimateTokens('     ')).toBe(2);
  });

  test('chars per token constant is 4', () => {
    expect(DEFAULT_CHARS_PER_TOKEN).toBe(4);
  });
});

describe('PromptBudgetError', () => {
  test('is a typed Error with its own name', () => {
    const error = new PromptBudgetError('too small');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PromptBudgetError);
    expect(error.name).toBe('PromptBudgetError');
    expect(error.message).toBe('too small');
  });
});

describe('assertBudget', () => {
  test.each([0, 1, 16000])('accepts %p', (budget) => {
    expect(() => assertBudget(budget)).not.toThrow();
  });

  test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (budget) => {
    expect(() => assertBudget(budget)).toThrow(PromptBudgetError);
    expect(() => assertBudget(budget)).toThrow(
      `Budget must be a non-negative integer, got ${budget}`,
    );
  });
});

describe('measureTokens', () => {
  test('returns the estimator value for the text', () => {
    expect(measureTokens((text) => text.length * 2, 'abc')).toBe(6);
    expect(measureTokens(() => 0, 'abc')).toBe(0);
  });

  test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects estimator output %p',
    (value) => {
      expect(() => measureTokens(() => value, 'abc')).toThrow(PromptBudgetError);
      expect(() => measureTokens(() => value, 'abc')).toThrow(
        `Token estimator must return a non-negative integer, got ${value}`,
      );
    },
  );
});

describe('TRUNCATION_ORDER', () => {
  test('drops RAG first, then memory, then project, skills last', () => {
    expect(TRUNCATION_ORDER).toEqual(['rag', 'memory', 'project', 'skills']);
  });
});

describe('fitFlexible', () => {
  const ITEMS: FlexibleItems = Object.freeze({
    skills: Object.freeze(['s1', 's2']),
    memory: Object.freeze(['m1', 'm2']),
    rag: Object.freeze(['r1', 'r2']),
    project: Object.freeze(['p1', 'p2']),
  });
  const PER_ITEM = 10;
  const cost = (_id: FlexibleLayerId, items: readonly string[]): number => items.length * PER_ITEM;

  test.each<[number, FlexibleItems]>([
    [80, ITEMS],
    [79, { skills: ['s1', 's2'], memory: ['m1', 'm2'], rag: ['r1'], project: ['p1', 'p2'] }],
    [70, { skills: ['s1', 's2'], memory: ['m1', 'm2'], rag: ['r1'], project: ['p1', 'p2'] }],
    [69, { skills: ['s1', 's2'], memory: ['m1', 'm2'], rag: [], project: ['p1', 'p2'] }],
    [50, { skills: ['s1', 's2'], memory: ['m1'], rag: [], project: ['p1', 'p2'] }],
    [40, { skills: ['s1', 's2'], memory: [], rag: [], project: ['p1', 'p2'] }],
    [30, { skills: ['s1', 's2'], memory: [], rag: [], project: ['p1'] }],
    [20, { skills: ['s1', 's2'], memory: [], rag: [], project: [] }],
    [10, { skills: ['s1'], memory: [], rag: [], project: [] }],
    [9, { skills: [], memory: [], rag: [], project: [] }],
    [0, { skills: [], memory: [], rag: [], project: [] }],
  ])('available %p keeps the expected items', (available, expected) => {
    expect(fitFlexible(ITEMS, cost, available)).toEqual(expected);
  });

  test('a large available keeps everything and does not mutate the input', () => {
    expect(fitFlexible(ITEMS, cost, 1000)).toEqual(ITEMS);
    expect(ITEMS.rag).toEqual(['r1', 'r2']);
  });

  test('uses the cost of the whole layer, not per item (fixed overhead drops with the layer)', () => {
    const HEADER = 7;
    const withHeader = (_id: FlexibleLayerId, items: readonly string[]): number =>
      items.length === 0 ? 0 : HEADER + items.length * PER_ITEM;
    // all = 4 * (7 + 20) = 108; rag with one item = 17 -> total 98.
    expect(fitFlexible(ITEMS, withHeader, 98).rag).toEqual(['r1']);
    expect(fitFlexible(ITEMS, withHeader, 97).rag).toEqual([]);
    expect(fitFlexible(ITEMS, withHeader, 97).memory).toEqual(['m1', 'm2']);
  });
});
