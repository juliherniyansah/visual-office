import type { FlexibleItems, FlexibleLayerId } from './layers';

export const DEFAULT_CHARS_PER_TOKEN = 4;

export type TokenEstimator = (text: string) => number;

// ponytail: chars/4 over UTF-16 units (String.length), per task spec; Hermes counts code points.
// Swap via ComposeDeps.estimateTokens for a real per-model tokenizer.
export const estimateTokens: TokenEstimator = (text) =>
  Math.ceil(text.length / DEFAULT_CHARS_PER_TOKEN);

export class PromptBudgetError extends Error {
  override readonly name = 'PromptBudgetError';
}

// Drop order for layers 5-8 (priority 9 > 5 > 8 > 6 > 7): RAG first, skills last.
export const TRUNCATION_ORDER: readonly FlexibleLayerId[] = ['rag', 'memory', 'project', 'skills'];

const isTokenCount = (value: number): boolean => Number.isInteger(value) && value >= 0;

export function assertBudget(budget: number): void {
  if (!isTokenCount(budget)) {
    throw new PromptBudgetError(`Budget must be a non-negative integer, got ${budget}`);
  }
}

export function measureTokens(estimate: TokenEstimator, text: string): number {
  const tokens = estimate(text);
  if (!isTokenCount(tokens)) {
    throw new PromptBudgetError(
      `Token estimator must return a non-negative integer, got ${tokens}`,
    );
  }
  return tokens;
}

type LayerCost = (id: FlexibleLayerId, items: readonly string[]) => number;

const totalCost = (items: FlexibleItems, cost: LayerCost): number =>
  TRUNCATION_ORDER.reduce((sum, id) => sum + cost(id, items[id]), 0);

// Drops items from the tail of each layer in TRUNCATION_ORDER until the whole-layer costs fit.
// Whole-layer cost (not per item) so a layer header disappears together with its last item.
export function fitFlexible(
  items: FlexibleItems,
  cost: LayerCost,
  available: number,
): FlexibleItems {
  const kept: Record<FlexibleLayerId, readonly string[]> = { ...items };
  for (const id of TRUNCATION_ORDER) {
    while (kept[id].length > 0 && totalCost(kept, cost) > available) {
      kept[id] = kept[id].slice(0, -1);
    }
  }
  return kept;
}
