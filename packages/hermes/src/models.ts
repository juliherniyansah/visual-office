import {
  AGENT_IDS,
  type AgentId,
  type CollectionName,
  type HermesExperience,
  type HermesMemory,
  type HermesProfile,
  type HermesSkill,
  MEMORY_KINDS,
  VERDICTS,
} from '@redhunter/shared';
import { type Connection, type Model, Schema } from 'mongoose';

const PROFILES_COLLECTION: CollectionName = 'hermes_profiles';
const MEMORIES_COLLECTION: CollectionName = 'hermes_memories';
const SKILLS_COLLECTION: CollectionName = 'hermes_skills';
const EXPERIENCE_COLLECTION: CollectionName = 'hermes_experience';
// Not in COLLECTION_SCHEMAS: storage-only pointer, never exposed as a shared document.
export const PROFILE_POINTERS_COLLECTION = 'hermes_profile_pointers';

// Append-only profile versions: `_id` = `hermes-<agentId>-v<version>`, rows are never updated.
export type ProfileRecord = Omit<HermesProfile, 'id'> & { _id: string; createdAt: Date };
// One row per agent, `_id` = `hermes-<agentId>` (= agents.hermesProfileId).
export interface ProfilePointerRecord {
  _id: string;
  agentId: AgentId;
  activeVersion: number;
}
export type MemoryRecord = Omit<HermesMemory, 'id' | 'createdAt'> & {
  _id: string;
  createdAt: Date;
};
export type SkillRecord = Omit<HermesSkill, 'id'> & { _id: string };
export type ExperienceRecord = Omit<HermesExperience, 'id'> & { _id: string; createdAt: Date };

export interface HermesModels {
  readonly Profile: Model<ProfileRecord>;
  readonly ProfilePointer: Model<ProfilePointerRecord>;
  readonly Memory: Model<MemoryRecord>;
  readonly Skill: Model<SkillRecord>;
  readonly Experience: Model<ExperienceRecord>;
}

const agentIdField = { type: String, required: true, enum: [...AGENT_IDS] };

const profileSchema = new Schema<ProfileRecord>(
  {
    _id: { type: String, required: true },
    agentId: agentIdField,
    name: { type: String, required: true },
    role: { type: String, required: true },
    personalityTraits: { type: [String], required: true },
    voiceGuidelines: { type: String, default: '' },
    constitutionRef: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    createdAt: { type: Date, required: true },
  },
  { collection: PROFILES_COLLECTION, versionKey: false },
);
profileSchema.index({ agentId: 1, version: 1 }, { unique: true });

const profilePointerSchema = new Schema<ProfilePointerRecord>(
  {
    _id: { type: String, required: true },
    agentId: agentIdField,
    activeVersion: { type: Number, required: true, min: 1 },
  },
  { collection: PROFILE_POINTERS_COLLECTION, versionKey: false },
);

const memorySchema = new Schema<MemoryRecord>(
  {
    _id: { type: String, required: true },
    agentId: agentIdField,
    runId: { type: String },
    kind: { type: String, required: true, enum: [...MEMORY_KINDS] },
    text: { type: String, required: true },
    // default undefined: mongoose would otherwise store `[]` for an absent embedding.
    embedding: { type: [Number], default: undefined },
    importance: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, required: true },
    ttl: { type: Number },
  },
  { collection: MEMORIES_COLLECTION, versionKey: false },
);
memorySchema.index({ agentId: 1, createdAt: -1 });

const skillSchema = new Schema<SkillRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    markdown: { type: String, default: '' },
    appliesToRoles: { type: [String], default: [] },
    tags: { type: [String], default: [] },
  },
  { collection: SKILLS_COLLECTION, versionKey: false },
);
// Mongo cannot compound-index two array fields; tags is the selective one.
skillSchema.index({ tags: 1 });

const experienceSchema = new Schema<ExperienceRecord>(
  {
    _id: { type: String, required: true },
    agentId: agentIdField,
    taskType: { type: String, required: true },
    outcome: { type: String, required: true, enum: [...VERDICTS] },
    lessons: { type: [String], default: [] },
    runId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: EXPERIENCE_COLLECTION, versionKey: false },
);
experienceSchema.index({ agentId: 1, createdAt: -1 });

export async function createHermesModels(connection: Connection): Promise<HermesModels> {
  const models: HermesModels = {
    Profile: connection.model<ProfileRecord>('HermesProfile', profileSchema),
    ProfilePointer: connection.model<ProfilePointerRecord>(
      'HermesProfilePointer',
      profilePointerSchema,
    ),
    Memory: connection.model<MemoryRecord>('HermesMemory', memorySchema),
    Skill: connection.model<SkillRecord>('HermesSkill', skillSchema),
    Experience: connection.model<ExperienceRecord>('HermesExperience', experienceSchema),
  };
  await Promise.all(Object.values(models).map((model: Model<unknown>) => model.init()));
  return models;
}
