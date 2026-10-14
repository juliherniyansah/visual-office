import { z } from 'zod';
import {
  AdapterIdSchema,
  AgentIdSchema,
  AgentRoleSchema,
  AgentStatusSchema,
  EscalationTargetSchema,
  FloorIdSchema,
  HumanRoleSchema,
} from '../enums';
import { IdSchema, TagSchema, TokenCountSchema } from './common';

// Human accounts (plan section 13). Never send `passwordHash` to clients: use PublicUserSchema.
export const UserSchema = z.object({
  id: IdSchema,
  email: z.email(),
  passwordHash: z.string().min(1),
  role: HumanRoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const PublicUserSchema = UserSchema.omit({ passwordHash: true });
export type PublicUser = z.infer<typeof PublicUserSchema>;

// OMO policy per agent, overridable per task by COO/CTO (plan section 7).
export const OmoPolicySchema = z.object({
  maxRetries: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive(),
  budgetTokens: TokenCountSchema,
  allowedTools: z.array(z.string().min(1)),
  escalationChain: z.array(EscalationTargetSchema),
});
export type OmoPolicy = z.infer<typeof OmoPolicySchema>;

export const OmoPolicyOverrideSchema = OmoPolicySchema.partial();
export type OmoPolicyOverride = z.infer<typeof OmoPolicyOverrideSchema>;

// Permanent agent document (plan section 5); static part mirrors AGENT_DEFINITIONS.
export const AgentSchema = z.object({
  id: AgentIdSchema,
  title: z.string().min(1),
  role: AgentRoleSchema,
  reportsTo: z.array(AgentIdSchema),
  floor: FloorIdSchema,
  deskSlot: z.string().min(1),
  hermesProfileId: IdSchema,
  allowedAdapters: z.array(AdapterIdSchema),
  capabilityTags: z.array(TagSchema),
  status: AgentStatusSchema,
  currentRunId: IdSchema.optional(),
  omoPolicy: OmoPolicySchema,
});
export type Agent = z.infer<typeof AgentSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  repoPath: z.string().min(1),
  defaultAdapter: AdapterIdSchema,
});
export type Project = z.infer<typeof ProjectSchema>;
