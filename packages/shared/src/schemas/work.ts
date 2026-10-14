import { z } from 'zod';
import {
  AdapterIdSchema,
  AgentIdSchema,
  DirectiveStatusSchema,
  PrioritySchema,
  RunStatusSchema,
  TaskStatusSchema,
  VerdictSchema,
} from '../enums';
import { AdapterEventSchema } from './adapter-event';
import {
  ActorSchema,
  IdSchema,
  IsoDateTimeSchema,
  TagSchema,
  TokenCountSchema,
  UsageSchema,
} from './common';
import { OmoPolicyOverrideSchema } from './org';

// Core loop documents (plan sections 4 and 10).
export const DirectiveSchema = z.object({
  id: IdSchema,
  issuedBy: ActorSchema,
  text: z.string().min(1),
  status: DirectiveStatusSchema,
  priority: PrioritySchema,
  // Routing input: copied onto tasks, matched against agent capabilityTags (todo 13).
  capabilityTags: z.array(TagSchema),
});
export type Directive = z.infer<typeof DirectiveSchema>;

export const TaskSchema = z.object({
  id: IdSchema,
  directiveId: IdSchema,
  projectId: IdSchema,
  // Absent while `planned`; set when COO/CTO assigns the task.
  assigneeAgentId: AgentIdSchema.optional(),
  status: TaskStatusSchema,
  acceptance: z.array(z.string().min(1)),
  capabilityTags: z.array(TagSchema),
  omoPolicyOverride: OmoPolicyOverrideSchema.optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const PromptLayerRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  tokens: TokenCountSchema,
});
export type PromptLayerRef = z.infer<typeof PromptLayerRefSchema>;

// Composer output stored for audit/replay (plan section 9).
export const PromptSnapshotSchema = z.object({
  text: z.string(),
  layers: z.array(PromptLayerRefSchema),
  hash: z.string().min(1),
});
export type PromptSnapshot = z.infer<typeof PromptSnapshotSchema>;

export const RunSchema = z.object({
  id: IdSchema,
  taskId: IdSchema,
  agentId: AgentIdSchema,
  adapterId: AdapterIdSchema,
  status: RunStatusSchema,
  // Filled as the run advances: snapshot after `composing`, session/startedAt after `executing`.
  promptSnapshot: PromptSnapshotSchema.optional(),
  vendorSessionId: z.string().min(1).optional(),
  usage: UsageSchema,
  startedAt: IsoDateTimeSchema.optional(),
  endedAt: IsoDateTimeSchema.optional(),
  error: z.string().optional(),
});
export type Run = z.infer<typeof RunSchema>;

export const RunEventSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  seq: z.number().int().nonnegative(),
  adapterEvent: AdapterEventSchema,
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const ResultSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  summary: z.string(),
  artifacts: z.array(z.string().min(1)),
  verdict: VerdictSchema,
});
export type Result = z.infer<typeof ResultSchema>;

export const DecisionSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  question: z.string().min(1),
  options: z.array(z.string().min(1)),
  createdAt: z.string().datetime(),
  answeredBy: IdSchema.optional(),
  answer: z.string().optional(),
  answeredAt: z.string().datetime().optional(),
});
export type Decision = z.infer<typeof DecisionSchema>;
