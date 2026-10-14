import { expect, test } from 'bun:test';
import {
  AGENT_ACTIONS,
  AgentRuntime,
  AuthorizationError,
  authorize,
  HermesPromptSource,
  InvalidRunTransitionError,
  PolicyOverrideError,
  promptInputFromHermes,
  RUN_TRANSITIONS,
  RunNotActiveError,
  RunStateMachine,
  resolvePolicy,
  UnknownAdapterError,
  WorkerTracker,
} from './index';

test('barrel re-exports the runtime API', () => {
  expect(typeof AgentRuntime).toBe('function');
  expect(typeof RunStateMachine).toBe('function');
  expect(typeof HermesPromptSource).toBe('function');
  expect(typeof WorkerTracker).toBe('function');
  expect(typeof authorize).toBe('function');
  expect(typeof resolvePolicy).toBe('function');
  expect(typeof promptInputFromHermes).toBe('function');
  expect(AGENT_ACTIONS).toHaveLength(3);
  expect(RUN_TRANSITIONS.succeeded).toEqual([]);
  expect(new AuthorizationError('ceo', 'runAdapter').name).toBe('AuthorizationError');
  expect(new InvalidRunTransitionError('queued', 'succeeded').name).toBe(
    'InvalidRunTransitionError',
  );
  expect(new PolicyOverrideError({ kind: 'agent', id: 'ceo' }).name).toBe('PolicyOverrideError');
  expect(new RunNotActiveError('r').name).toBe('RunNotActiveError');
  expect(new UnknownAdapterError('codex').name).toBe('UnknownAdapterError');
});
