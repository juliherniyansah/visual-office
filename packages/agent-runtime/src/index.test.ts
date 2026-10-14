import { expect, test } from 'bun:test';
import {
  COMPOSER_VERSION,
  CONSTITUTION_VERSION,
  composePrompt,
  loadConstitution,
  PACKAGE_NAME,
  PROMPT_LAYER_IDS,
  PromptBudgetError,
  TRUNCATION_ORDER,
} from './index';

test('barrel re-exports the prompt composer API', () => {
  expect(PACKAGE_NAME).toBe('@redhunter/agent-runtime');
  expect(typeof composePrompt).toBe('function');
  expect(typeof loadConstitution).toBe('function');
  expect(COMPOSER_VERSION).toBe(1);
  expect(CONSTITUTION_VERSION).toBe(1);
  expect(PROMPT_LAYER_IDS).toHaveLength(9);
  expect(TRUNCATION_ORDER).toHaveLength(4);
  expect(new PromptBudgetError('x').name).toBe('PromptBudgetError');
});
