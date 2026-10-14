import { createHash } from 'node:crypto';
import {
  assertBudget,
  estimateTokens as defaultEstimate,
  fitFlexible,
  measureTokens,
  PromptBudgetError,
  type TokenEstimator,
} from './budget';
import {
  FIXED_LAYER_IDS,
  type FlexibleItems,
  type FlexibleLayerId,
  isFlexibleLayer,
  PROMPT_LAYER_IDS,
  type PromptInput,
  type PromptLayerId,
  renderFixedLayer,
  renderItemsLayer,
} from './layers';

// Bump when rendering or truncation rules change: part of the snapshot hash.
export const COMPOSER_VERSION = 1;

export interface ComposeDeps {
  readonly estimateTokens?: TokenEstimator;
}

export interface PromptLayerRecord {
  readonly id: PromptLayerId;
  readonly version: number;
  readonly tokens: number;
}

// JSON-serializable; {text, layers, hash} is stored on runs.promptSnapshot.
export interface PromptComposition {
  readonly text: string;
  readonly layers: readonly PromptLayerRecord[];
  readonly tokens: number;
  readonly hash: string;
  readonly version: number;
}

// Sorted keys at every level: hash must not depend on key insertion order.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const record = value as Record<string, unknown>;
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashComposition(
  version: number,
  layers: readonly PromptLayerRecord[],
  text: string,
): string {
  return createHash('sha256').update(canonicalJson({ version, layers, text })).digest('hex');
}

// Layer tokens are measured per rendered layer and summed, so the total is what the budget sees.
function fitInput(input: PromptInput, estimate: TokenEstimator): FlexibleItems {
  const budget = input.omoPolicy.policy.budgetTokens;
  assertBudget(budget);
  const reserve = FIXED_LAYER_IDS.reduce(
    (sum, id) => sum + measureTokens(estimate, renderFixedLayer(id, input)),
    0,
  );
  if (reserve > budget) {
    throw new PromptBudgetError(`Reserved layers need ${reserve} tokens, budget is ${budget}`);
  }
  const cost = (id: FlexibleLayerId, items: readonly string[]): number =>
    items.length === 0 ? 0 : measureTokens(estimate, renderItemsLayer(id, items));
  const items = {
    skills: input.skills.items,
    memory: input.memory.items,
    rag: input.rag.items,
    project: input.project.items,
  };
  return fitFlexible(items, cost, budget - reserve);
}

export function composePrompt(input: PromptInput, deps: ComposeDeps = {}): PromptComposition {
  const estimate = deps.estimateTokens ?? defaultEstimate;
  const kept = fitInput(input, estimate);
  const texts = PROMPT_LAYER_IDS.map((id) =>
    isFlexibleLayer(id) ? renderItemsLayer(id, kept[id]) : renderFixedLayer(id, input),
  );
  const layers = PROMPT_LAYER_IDS.map((id, index) => {
    const layerText = texts[index] ?? '';
    const tokens = layerText === '' ? 0 : measureTokens(estimate, layerText);
    return { id, version: input[id].version, tokens };
  });
  const text = texts.join('');
  const tokens = layers.reduce((sum, layer) => sum + layer.tokens, 0);
  return {
    text,
    layers,
    tokens,
    hash: hashComposition(COMPOSER_VERSION, layers, text),
    version: COMPOSER_VERSION,
  };
}
