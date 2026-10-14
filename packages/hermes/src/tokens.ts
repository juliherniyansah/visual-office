export type TokenEstimator = (text: string) => number;

const CHARS_PER_TOKEN = 4;

// ponytail: chars/4 heuristic (code points, not UTF-16 units); swap for a real tokenizer per model.
export const estimateTokens: TokenEstimator = (text) =>
  Math.ceil([...text].length / CHARS_PER_TOKEN);
