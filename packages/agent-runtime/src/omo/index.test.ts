import { expect, test } from 'bun:test';
import {
  NO_ACCEPTANCE,
  PlanError,
  prometheus,
  RISK_LEVELS,
  verify,
  verifyCompletion,
  WorkPlanSchema,
} from '../index';

test('package barrel re-exports the omo plan/verify API', () => {
  expect(typeof prometheus.plan).toBe('function');
  expect(typeof verify).toBe('function');
  expect(typeof verifyCompletion).toBe('function');
  expect(typeof WorkPlanSchema.safeParse).toBe('function');
  expect(RISK_LEVELS).toEqual(['low', 'medium', 'high']);
  expect(NO_ACCEPTANCE).toBe('No acceptance criteria');
  expect(new PlanError('invalid_output', 'x').name).toBe('PlanError');
});
