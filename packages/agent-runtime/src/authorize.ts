import { AGENT_DEFINITIONS, type AgentRole } from '@redhunter/shared';

// Agent-role RBAC (plan section 13). Enforced in code: prompt rules are not security boundaries.
export const AGENT_ACTIONS = ['createDirective', 'assignTask', 'runAdapter'] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

const ROLE_ACTIONS: Readonly<Record<AgentRole, readonly AgentAction[]>> = {
  executive: ['createDirective'],
  manager: ['assignTask'],
  domain: ['runAdapter'],
};

export class AuthorizationError extends Error {
  override readonly name = 'AuthorizationError';

  constructor(
    readonly agentId: string,
    readonly action: string,
  ) {
    super(`Agent ${agentId} is not allowed to ${action}`);
  }
}

// Deny by default: unknown agents and unknown actions are rejected. Plain strings on purpose,
// since callers may pass untrusted input (e.g. an action parsed from model output).
export function authorize(agentId: string, action: string): boolean {
  const definition = AGENT_DEFINITIONS.find((agent) => agent.id === agentId);
  if (definition === undefined) return false;
  return (ROLE_ACTIONS[definition.role] as readonly string[]).includes(action);
}

export function assertAuthorized(agentId: string, action: AgentAction): void {
  if (!authorize(agentId, action)) throw new AuthorizationError(agentId, action);
}
