import { DomainEventSchema } from './events';
import {
  AgentSchema,
  DecisionSchema,
  DirectiveSchema,
  HermesExperienceSchema,
  HermesMemorySchema,
  HermesProfileSchema,
  HermesSkillSchema,
  KnowledgeDocSchema,
  OfficeStateSchema,
  ProjectSchema,
  ResultSchema,
  RunEventSchema,
  RunSchema,
  TaskSchema,
  UserSchema,
} from './schemas';

// Mongo collection name -> zod schema (plan sections 10, 11, 14).
export const COLLECTION_SCHEMAS = Object.freeze({
  users: UserSchema,
  agents: AgentSchema,
  hermes_profiles: HermesProfileSchema,
  hermes_memories: HermesMemorySchema,
  hermes_skills: HermesSkillSchema,
  hermes_experience: HermesExperienceSchema,
  knowledge_docs: KnowledgeDocSchema,
  projects: ProjectSchema,
  directives: DirectiveSchema,
  tasks: TaskSchema,
  runs: RunSchema,
  run_events: RunEventSchema,
  results: ResultSchema,
  decisions: DecisionSchema,
  events: DomainEventSchema,
  // Same row shape as `events`, moved after the 5th failed dispatch.
  events_dead: DomainEventSchema,
  office_state: OfficeStateSchema,
});

export type CollectionName = keyof typeof COLLECTION_SCHEMAS;

export const COLLECTION_NAMES: readonly CollectionName[] = Object.freeze(
  Object.keys(COLLECTION_SCHEMAS) as CollectionName[],
);
