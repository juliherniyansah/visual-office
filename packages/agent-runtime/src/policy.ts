import {
  type Actor,
  AGENT_DEFINITIONS,
  type OmoPolicy,
  OmoPolicyOverrideSchema,
  OmoPolicySchema,
} from '@redhunter/shared';
import type { PolicyOverrideRequest } from './ports';

export class PolicyOverrideError extends Error {
  override readonly name = 'PolicyOverrideError';

  constructor(readonly actor: Actor) {
    super(`Actor ${actor.kind}:${actor.id} may not override the OMO policy (manager only)`);
  }
}

// Plan section 7: per-task overrides are set by COO/CTO only (agent role `manager`).
function isManager(actor: Actor): boolean {
  if (actor.kind !== 'agent') return false;
  return AGENT_DEFINITIONS.some((agent) => agent.id === actor.id && agent.role === 'manager');
}

export interface ResolvePolicyInput {
  readonly agentPolicy: OmoPolicy;
  readonly override?: PolicyOverrideRequest;
}

// agent default < per-task override. Both sides are untrusted rows, so both are re-validated.
export function resolvePolicy(input: ResolvePolicyInput): OmoPolicy {
  const base = OmoPolicySchema.parse(input.agentPolicy);
  if (input.override === undefined) return base;
  const override = OmoPolicyOverrideSchema.parse(input.override.override);
  if (Object.keys(override).length === 0) return base;
  if (!isManager(input.override.actor)) throw new PolicyOverrideError(input.override.actor);
  return OmoPolicySchema.parse({ ...base, ...override });
}
