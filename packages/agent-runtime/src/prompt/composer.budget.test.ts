import { describe, expect, test } from 'bun:test';
import { charEstimator, makeInput, withBudget } from '../test-support/prompt-input';
import { estimateTokens, PromptBudgetError, type TokenEstimator } from './budget';
import { composePrompt } from './composer';
import {
  FIXED_LAYER_IDS,
  type FlexibleItems,
  type FlexibleLayerId,
  isFlexibleLayer,
  PROMPT_LAYER_IDS,
  type PromptInput,
  renderFixedLayer,
  renderItemsLayer,
} from './layers';

const BASE = makeInput();
const ALL: FlexibleItems = {
  skills: BASE.skills.items,
  memory: BASE.memory.items,
  rag: BASE.rag.items,
  project: BASE.project.items,
};
const NONE: FlexibleItems = { skills: [], memory: [], rag: [], project: [] };

const reserveOf = (input: PromptInput, estimate: TokenEstimator): number =>
  FIXED_LAYER_IDS.reduce((sum, id) => sum + estimate(renderFixedLayer(id, input)), 0);
const costOf = (id: FlexibleLayerId, items: readonly string[], estimate: TokenEstimator): number =>
  items.length === 0 ? 0 : estimate(renderItemsLayer(id, items));
const expectedText = (input: PromptInput, kept: FlexibleItems): string =>
  PROMPT_LAYER_IDS.map((id) =>
    isFlexibleLayer(id) ? renderItemsLayer(id, kept[id]) : renderFixedLayer(id, input),
  ).join('');
const fixedHead = (input: PromptInput): string =>
  FIXED_LAYER_IDS.slice(0, 4)
    .map((id) => renderFixedLayer(id, input))
    .join('');
const composeChars = (budget: number) =>
  composePrompt(withBudget(BASE, budget), { estimateTokens: charEstimator });

const RESERVE = reserveOf(BASE, charEstimator);
const FULL = {
  skills: costOf('skills', ALL.skills, charEstimator),
  memory: costOf('memory', ALL.memory, charEstimator),
  rag: costOf('rag', ALL.rag, charEstimator),
  project: costOf('project', ALL.project, charEstimator),
};
const FLEX_TOTAL = FULL.skills + FULL.memory + FULL.rag + FULL.project;

describe('truncation order 7 -> 6 -> 8 -> 5', () => {
  test.each<[string, number, FlexibleItems]>([
    ['everything fits', RESERVE + FLEX_TOTAL, ALL],
    [
      'one token short: rag loses its last item',
      RESERVE + FLEX_TOTAL - 1,
      { ...ALL, rag: ['doc A'] },
    ],
    ['rag is emptied before memory shrinks', RESERVE + FLEX_TOTAL - FULL.rag, { ...ALL, rag: [] }],
    [
      'memory shrinks after rag is empty',
      RESERVE + FLEX_TOTAL - FULL.rag - 1,
      { ...ALL, rag: [], memory: ['mem A'] },
    ],
    [
      'project shrinks after memory is empty',
      RESERVE + FULL.skills + FULL.project - 1,
      { ...NONE, skills: ALL.skills, project: ['repo map'] },
    ],
    ['skills shrink last', RESERVE + FULL.skills - 1, { ...NONE, skills: ['skill A'] }],
    ['budget == reserve keeps only layers 1-4 and 9', RESERVE, NONE],
  ])('%s', (_name, budget, kept) => {
    const composed = composeChars(budget);
    expect(composed.text).toBe(expectedText(BASE, kept));
    expect(composed.tokens).toBeLessThanOrEqual(budget);
  });

  test('budget == reserve + 1 still drops every flexible layer (no layer fits in 1 token)', () => {
    const composed = composeChars(RESERVE + 1);
    expect(composed.text).toBe(expectedText(BASE, NONE));
    expect(composed.tokens).toBe(RESERVE);
  });

  test('budget == reserve uses the whole budget exactly', () => {
    expect(composeChars(RESERVE).tokens).toBe(RESERVE);
  });
});

describe('reserve for layers 1-4 and 9', () => {
  test('budget below the reserve throws PromptBudgetError', () => {
    const run = () => composeChars(RESERVE - 1);
    expect(run).toThrow(PromptBudgetError);
    expect(run).toThrow(`Reserved layers need ${RESERVE} tokens, budget is ${RESERVE - 1}`);
  });

  test('budget 0 throws PromptBudgetError', () => {
    expect(() => composePrompt(withBudget(BASE, 0))).toThrow(PromptBudgetError);
  });

  test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'non-integer or negative budget %p throws PromptBudgetError',
    (budget) => {
      const run = () => composePrompt(withBudget(BASE, budget));
      expect(run).toThrow(PromptBudgetError);
      expect(run).toThrow(`Budget must be a non-negative integer, got ${budget}`);
    },
  );
});

describe('oversized RAG input', () => {
  const RAG_ITEMS = Array.from({ length: 50 }, (_, i) => `doc ${i} ${'x'.repeat(400)}`);
  const big = makeInput({ rag: { version: 67, items: RAG_ITEMS } });
  const reserve = reserveOf(big, estimateTokens);
  const others = (['skills', 'memory', 'project'] as const).reduce(
    (sum, id) => sum + costOf(id, ALL[id], estimateTokens),
    0,
  );
  const RAG_ROOM = 1000;
  const budget = reserve + others + RAG_ROOM;
  const roomy = composePrompt(withBudget(big, 1_000_000));
  const tight = composePrompt(withBudget(big, budget));

  test('output stays within budget and only layer 7 shrinks', () => {
    expect(tight.tokens).toBeLessThanOrEqual(budget);
    tight.layers.forEach((layer, index) => {
      if (layer.id === 'rag') {
        expect(layer.tokens).toBeLessThan(roomy.layers[index]?.tokens ?? 0);
        expect(layer.tokens).toBeGreaterThan(0);
        return;
      }
      expect(layer).toEqual(roomy.layers[index] ?? layer);
    });
  });

  test('keeps the longest prefix of RAG items that fits; layers 1-4 and 9 intact', () => {
    let kept = 0;
    while (
      kept < RAG_ITEMS.length &&
      costOf('rag', RAG_ITEMS.slice(0, kept + 1), estimateTokens) <= RAG_ROOM
    ) {
      kept += 1;
    }
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(RAG_ITEMS.length);
    expect(tight.text).toBe(expectedText(big, { ...ALL, rag: RAG_ITEMS.slice(0, kept) }));
    expect(tight.text.startsWith(fixedHead(big))).toBe(true);
    expect(tight.text.endsWith(renderFixedLayer('task', big))).toBe(true);
  });
});

describe('budget sweep (boundary safety)', () => {
  test.each<[string, TokenEstimator]>([
    ['char estimator', charEstimator],
    ['default estimator', estimateTokens],
  ])('%s: every budget from reserve to full fits, fixed layers intact, monotonic', (_n, est) => {
    const reserve = reserveOf(BASE, est);
    const full = composePrompt(withBudget(BASE, 1_000_000), { estimateTokens: est });
    let previous = 0;
    for (let budget = reserve; budget <= full.tokens + 1; budget += 1) {
      const composed = composePrompt(withBudget(BASE, budget), { estimateTokens: est });
      expect(composed.tokens).toBeLessThanOrEqual(budget);
      expect(composed.tokens).toBeGreaterThanOrEqual(previous);
      expect(composed.text.startsWith(fixedHead(BASE))).toBe(true);
      expect(composed.text.endsWith(renderFixedLayer('task', BASE))).toBe(true);
      previous = composed.tokens;
    }
    expect(previous).toBe(full.tokens);
  });

  test('truncation is deterministic', () => {
    const budget = RESERVE + FLEX_TOTAL - FULL.rag - 1;
    expect(composeChars(budget)).toEqual(composeChars(budget));
  });
});
