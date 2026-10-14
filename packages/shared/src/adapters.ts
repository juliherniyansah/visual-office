import { z } from 'zod';
import { type AdapterId, AgentIdSchema } from './enums';
import type { AdapterEvent } from './schemas/adapter-event';
import { IdSchema } from './schemas/common';
import { OmoPolicySchema } from './schemas/org';

// Adapter contract (plan section 8). Runtime depends on these types only, never on vendor code.

export const PERMISSION_DECISIONS = ['allow', 'deny'] as const;
export const PermissionDecisionSchema = z.enum(PERMISSION_DECISIONS);
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;

// Adapter never receives Hermes data: only a composed prompt, sandbox cwd and policy.
// `cwd` shape is enforced again at spawn time (packages/adapters spawnChild rejects '/').
export const AdapterRunInputSchema = z.object({
  runId: IdSchema,
  agentId: AgentIdSchema,
  cwd: z.string().min(1),
  prompt: z.string().min(1),
  policy: OmoPolicySchema.optional(),
  // JSON Schema for structured final output (codex --output-schema, claude settings).
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  resumeVendorSessionId: z.string().min(1).optional(),
});

export interface AdapterRunInput extends z.infer<typeof AdapterRunInputSchema> {
  // Not serializable, so kept out of the schema; aborting equals cancel(runId).
  readonly signal?: AbortSignal;
}

export interface AgentAdapter {
  readonly id: AdapterId;
  start(input: AdapterRunInput): AsyncIterable<AdapterEvent>;
  answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void>;
  cancel(runId: string): Promise<void>;
}
