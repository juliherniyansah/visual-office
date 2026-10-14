import { z } from 'zod';
import { AgentIdSchema, MemoryKindSchema, VerdictSchema } from '../enums';
import { IdSchema, IsoDateTimeSchema, TagSchema } from './common';

// Hermes collections (plan section 6).
export const HermesProfileSchema = z.object({
  id: IdSchema,
  agentId: AgentIdSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  personalityTraits: z.array(z.string().min(1)),
  voiceGuidelines: z.string(),
  constitutionRef: z.string().min(1),
  version: z.number().int().positive(),
});
export type HermesProfile = z.infer<typeof HermesProfileSchema>;

export const HermesMemorySchema = z.object({
  id: IdSchema,
  agentId: AgentIdSchema,
  runId: IdSchema.optional(),
  kind: MemoryKindSchema,
  text: z.string().min(1),
  embedding: z.array(z.number()).optional(),
  importance: z.number().nonnegative(),
  createdAt: IsoDateTimeSchema,
  // Seconds until expiry; absent = keep forever.
  ttl: z.number().int().positive().optional(),
});
export type HermesMemory = z.infer<typeof HermesMemorySchema>;

export const HermesSkillSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  markdown: z.string(),
  appliesToRoles: z.array(z.string().min(1)),
  tags: z.array(TagSchema),
});
export type HermesSkill = z.infer<typeof HermesSkillSchema>;

export const HermesExperienceSchema = z.object({
  id: IdSchema,
  agentId: AgentIdSchema,
  taskType: z.string().min(1),
  outcome: VerdictSchema,
  lessons: z.array(z.string().min(1)),
  runId: IdSchema,
});
export type HermesExperience = z.infer<typeof HermesExperienceSchema>;

// RAG source documents hydrated into KnowledgeStore at boot.
export const KnowledgeDocSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  text: z.string(),
  tags: z.array(TagSchema),
});
export type KnowledgeDoc = z.infer<typeof KnowledgeDocSchema>;
