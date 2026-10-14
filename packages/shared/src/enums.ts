import { z } from 'zod';

// Seven permanent agents (plan section 5). Order = reporting hierarchy.
export const AGENT_IDS = [
  'ceo',
  'coo',
  'cto',
  'programming',
  'game',
  'iot',
  'ai_development',
] as const;
export const AgentIdSchema = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const AGENT_STATUSES = [
  'idle',
  'thinking',
  'working',
  'blocked',
  'waiting_permission',
  'offline',
] as const;
export const AgentStatusSchema = z.enum(AGENT_STATUSES);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

// Agent roles for runtime RBAC (plan section 13).
export const AGENT_ROLES = ['executive', 'manager', 'domain'] as const;
export const AgentRoleSchema = z.enum(AGENT_ROLES);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

// Human roles for API RBAC (plan section 13).
export const HUMAN_ROLES = ['owner', 'operator', 'viewer'] as const;
export const HumanRoleSchema = z.enum(HUMAN_ROLES);
export type HumanRole = z.infer<typeof HumanRoleSchema>;

export const RUN_STATUSES = [
  'queued',
  'composing',
  'executing',
  'verifying',
  'succeeded',
  'failed',
  'escalated',
  'paused',
] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const TASK_STATUSES = [
  'planned',
  'assigned',
  'in_progress',
  'paused',
  'cancelled',
  'done',
  'escalated',
] as const;
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Section 4: Directive(draft) -> Directive(issued).
export const DIRECTIVE_STATUSES = ['draft', 'issued'] as const;
export const DirectiveStatusSchema = z.enum(DIRECTIVE_STATUSES);
export type DirectiveStatus = z.infer<typeof DirectiveStatusSchema>;

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export const PrioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof PrioritySchema>;

export const ADAPTER_IDS = ['opencode', 'codex', 'claude'] as const;
export const AdapterIdSchema = z.enum(ADAPTER_IDS);
export type AdapterId = z.infer<typeof AdapterIdSchema>;

// OMO verify outcome (plan section 7).
export const VERDICTS = ['pass', 'fail'] as const;
export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

export const MEMORY_KINDS = ['episodic', 'semantic', 'procedural'] as const;
export const MemoryKindSchema = z.enum(MEMORY_KINDS);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

// Escalation goes to COO/CTO (agents) and finally a human (plan section 7).
export const HUMAN_ESCALATION = 'human';
export const EscalationTargetSchema = z.enum([...AGENT_IDS, HUMAN_ESCALATION] as const);
export type EscalationTarget = z.infer<typeof EscalationTargetSchema>;

export const ACTOR_KINDS = ['human', 'agent', 'system'] as const;
export const ActorKindSchema = z.enum(ACTOR_KINDS);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const POSES = ['sitting', 'standing', 'walking', 'talking'] as const;
export const PoseSchema = z.enum(POSES);
export type Pose = z.infer<typeof PoseSchema>;

// F1 lobby + Server Room, F2 domain, F3 operations, F4 CEO (Option A).
export const FLOOR_IDS = [1, 2, 3, 4] as const;
export const FloorIdSchema = z.literal(FLOOR_IDS);
export type FloorId = z.infer<typeof FloorIdSchema>;
