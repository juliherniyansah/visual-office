import type { DomainEventOf } from '@redhunter/shared';
import type { EventInput } from '../events/outbox';

export function agentStatusInput(
  agentId: DomainEventOf<'agent.status_changed'>['payload']['agentId'] = 'ceo',
  runId?: string,
): EventInput {
  return {
    type: 'agent.status_changed',
    aggregate: { kind: 'agent', id: agentId },
    actor: { kind: 'system', id: 'test' },
    payload: { agentId, status: 'working', ...(runId === undefined ? {} : { runId }) },
  };
}

export function runCompletedInput(runId: string): EventInput {
  return {
    type: 'run.completed',
    aggregate: { kind: 'run', id: runId },
    actor: { kind: 'system', id: 'test' },
    payload: { runId },
  };
}

// Polls until the predicate holds; fails loudly instead of hanging a test.
export async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2_000,
  stepMs = 10,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) {
      throw new Error(`waitUntil timed out after ${timeoutMs} ms`);
    }
    await Bun.sleep(stepMs);
  }
}

export const silentLogger = { error: (): void => {} };
