import type { AgentId } from '@redhunter/shared';

// Agents may read only their own Hermes data (plan section 6, RH-HERMES-001 SECURITY).
export class HermesAccessError extends Error {
  override readonly name = 'HermesAccessError';

  constructor(
    readonly agentId: AgentId,
    readonly asAgent: AgentId,
  ) {
    super(`Agent ${asAgent} may not read Hermes data of ${agentId}`);
  }
}

export class HermesNotFoundError extends Error {
  override readonly name = 'HermesNotFoundError';
}

export class HermesBudgetError extends Error {
  override readonly name = 'HermesBudgetError';
}
