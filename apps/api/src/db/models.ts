import {
  ACTOR_KINDS,
  ADAPTER_IDS,
  AGENT_IDS,
  AGENT_ROLES,
  AGENT_STATUSES,
  AGGREGATE_KINDS,
  type Agent,
  type CollectionName,
  DIRECTIVE_STATUSES,
  type Directive,
  DOMAIN_EVENT_TYPES,
  type DomainEvent,
  FLOOR_IDS,
  HUMAN_ESCALATION,
  HUMAN_ROLES,
  type HumanRole,
  type KnowledgeDoc,
  type OfficeState,
  type OmoPolicy,
  PRIORITIES,
  type Project,
  RUN_STATUSES,
  type Run,
  TASK_STATUSES,
  type Task,
} from '@redhunter/shared';
import { type Connection, type Model, Schema, type Types } from 'mongoose';

// Collection names typed against COLLECTION_SCHEMAS keys from @redhunter/shared.
const USERS_COLLECTION: CollectionName = 'users';
const AGENTS_COLLECTION: CollectionName = 'agents';
const EVENTS_COLLECTION: CollectionName = 'events';
const EVENTS_DEAD_COLLECTION: CollectionName = 'events_dead';
const DIRECTIVES_COLLECTION: CollectionName = 'directives';
const TASKS_COLLECTION: CollectionName = 'tasks';
const RUNS_COLLECTION: CollectionName = 'runs';
const PROJECTS_COLLECTION: CollectionName = 'projects';
const KNOWLEDGE_COLLECTION: CollectionName = 'knowledge_docs';
const OFFICE_STATE_COLLECTION: CollectionName = 'office_state';

export interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: HumanRole;
}

// Agent ids are stable slugs stored directly as `_id`.
export type AgentRecord = Omit<Agent, 'id'> & { _id: Agent['id'] };

// Outbox row (plan section 11): shared envelope with Mongo Dates; dispatchedAt null = pending.
export type EventRecord = Omit<DomainEvent, 'createdAt' | 'dispatchedAt'> & {
  createdAt: Date;
  dispatchedAt: Date | null;
  lastError?: string;
};

export type DeadEventRecord = EventRecord & { deadAt: Date };

// Core loop documents: uuid string `_id`, createdAt for stable list order (not part of the API shape).
type WorkRecord<T extends { id: string }> = Omit<T, 'id'> & { _id: string; createdAt: Date };
export type DirectiveRecord = WorkRecord<Directive>;
export type TaskRecord = WorkRecord<Task>;
export type RunRecord = Omit<WorkRecord<Run>, 'startedAt' | 'endedAt'> & {
  startedAt?: Date;
  endedAt?: Date;
};
export type ProjectRecord = WorkRecord<Project>;
export type KnowledgeRecord = WorkRecord<KnowledgeDoc>;
// Singleton (fixed string _id) written only by the projector (todo 15).
export type OfficeStateRecord = Omit<OfficeState, 'updatedAt'> & { _id: string; updatedAt: Date };

export interface Models {
  readonly User: Model<UserRecord>;
  readonly Agent: Model<AgentRecord>;
  readonly Event: Model<EventRecord>;
  readonly EventDead: Model<DeadEventRecord>;
  readonly Directive: Model<DirectiveRecord>;
  readonly Task: Model<TaskRecord>;
  readonly Run: Model<RunRecord>;
  readonly Project: Model<ProjectRecord>;
  readonly Knowledge: Model<KnowledgeRecord>;
  readonly OfficeState: Model<OfficeStateRecord>;
}

// Field enums mirror the shared zod enums; mappers re-validate with the zod schemas on read.
const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: [...HUMAN_ROLES] },
  },
  { collection: USERS_COLLECTION, versionKey: false },
);

const omoPolicySchema = new Schema<OmoPolicy>(
  {
    maxRetries: { type: Number, required: true, min: 0 },
    maxTurns: { type: Number, required: true, min: 1 },
    budgetTokens: { type: Number, required: true, min: 0 },
    allowedTools: { type: [String], default: [] },
    escalationChain: {
      type: [{ type: String, enum: [...AGENT_IDS, HUMAN_ESCALATION] }],
      default: [],
    },
  },
  { _id: false },
);

const agentSchema = new Schema<AgentRecord>(
  {
    _id: { type: String, required: true, enum: [...AGENT_IDS] },
    title: { type: String, required: true },
    role: { type: String, required: true, enum: [...AGENT_ROLES] },
    reportsTo: { type: [{ type: String, enum: [...AGENT_IDS] }], default: [] },
    floor: { type: Number, required: true, enum: [...FLOOR_IDS] },
    deskSlot: { type: String, required: true },
    hermesProfileId: { type: String, required: true },
    allowedAdapters: { type: [{ type: String, enum: [...ADAPTER_IDS] }], default: [] },
    capabilityTags: { type: [String], default: [] },
    status: { type: String, required: true, enum: [...AGENT_STATUSES] },
    currentRunId: { type: String },
    omoPolicy: { type: omoPolicySchema, required: true },
  },
  { collection: AGENTS_COLLECTION, versionKey: false },
);

// Payload is validated by DomainEventSchema in emit(); Mongo stores it as an opaque object.
const eventFields = {
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: [...DOMAIN_EVENT_TYPES] },
  aggregate: {
    kind: { type: String, required: true, enum: [...AGGREGATE_KINDS] },
    id: { type: String, required: true },
  },
  payload: { type: Schema.Types.Mixed, required: true },
  actor: {
    kind: { type: String, required: true, enum: [...ACTOR_KINDS] },
    id: { type: String, required: true },
  },
  createdAt: { type: Date, required: true },
  dispatchedAt: { type: Date, default: null },
  attempts: { type: Number, required: true, min: 0, default: 0 },
  lastError: { type: String },
};

const eventSchema = new Schema<EventRecord>(eventFields, {
  collection: EVENTS_COLLECTION,
  versionKey: false,
  minimize: false,
});
eventSchema.index({ dispatchedAt: 1, createdAt: 1 });

const deadEventSchema = new Schema<DeadEventRecord>(
  { ...eventFields, deadAt: { type: Date, required: true } },
  { collection: EVENTS_DEAD_COLLECTION, versionKey: false, minimize: false },
);

const actorFields = {
  kind: { type: String, required: true, enum: [...ACTOR_KINDS] },
  id: { type: String, required: true },
};

const directiveSchema = new Schema<DirectiveRecord>(
  {
    _id: { type: String, required: true },
    issuedBy: actorFields,
    text: { type: String, required: true },
    status: { type: String, required: true, enum: [...DIRECTIVE_STATUSES] },
    priority: { type: String, required: true, enum: [...PRIORITIES] },
    capabilityTags: { type: [String], default: [] },
    createdAt: { type: Date, required: true },
  },
  { collection: DIRECTIVES_COLLECTION, versionKey: false },
);
directiveSchema.index({ createdAt: 1 });

const taskSchema = new Schema<TaskRecord>(
  {
    _id: { type: String, required: true },
    directiveId: { type: String, required: true },
    projectId: { type: String, required: true },
    assigneeAgentId: { type: String, enum: [...AGENT_IDS] },
    status: { type: String, required: true, enum: [...TASK_STATUSES] },
    acceptance: { type: [String], default: [] },
    capabilityTags: { type: [String], default: [] },
    omoPolicyOverride: { type: Schema.Types.Mixed },
    createdAt: { type: Date, required: true },
  },
  { collection: TASKS_COLLECTION, versionKey: false },
);
taskSchema.index({ status: 1, createdAt: 1 });
taskSchema.index({ assigneeAgentId: 1, createdAt: 1 });

// promptSnapshot is validated by RunSchema in the mapper; stored as an opaque object.
const runSchema = new Schema<RunRecord>(
  {
    _id: { type: String, required: true },
    taskId: { type: String, required: true },
    agentId: { type: String, required: true, enum: [...AGENT_IDS] },
    adapterId: { type: String, required: true, enum: [...ADAPTER_IDS] },
    status: { type: String, required: true, enum: [...RUN_STATUSES] },
    promptSnapshot: { type: Schema.Types.Mixed },
    vendorSessionId: { type: String },
    usage: {
      inputTokens: { type: Number, required: true, min: 0 },
      outputTokens: { type: Number, required: true, min: 0 },
      costUsd: { type: Number, min: 0 },
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    error: { type: String },
    createdAt: { type: Date, required: true },
  },
  { collection: RUNS_COLLECTION, versionKey: false },
);
runSchema.index({ taskId: 1, createdAt: 1 });

const projectSchema = new Schema<ProjectRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    repoPath: { type: String, required: true },
    defaultAdapter: { type: String, required: true, enum: [...ADAPTER_IDS] },
    createdAt: { type: Date, required: true },
  },
  { collection: PROJECTS_COLLECTION, versionKey: false },
);
projectSchema.index({ createdAt: 1 });

const knowledgeSchema = new Schema<KnowledgeRecord>(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    tags: { type: [String], default: [] },
    createdAt: { type: Date, required: true },
  },
  { collection: KNOWLEDGE_COLLECTION, versionKey: false },
);
knowledgeSchema.index({ createdAt: 1 });

// Written only by the projector (todo 15). Mixed subdocuments: OfficeStateSchema in the
// mapper remains the judge on reads; mongoose only needs top-level paths for CAS writes.
const officeStateSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true, min: 0 },
    floors: { type: [Schema.Types.Mixed], required: true },
    drones: { type: [Schema.Types.Mixed], required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: OFFICE_STATE_COLLECTION, versionKey: false },
);

export async function createModels(connection: Connection): Promise<Models> {
  const User = connection.model<UserRecord>('User', userSchema);
  const Agent = connection.model<AgentRecord>('Agent', agentSchema);
  const Event = connection.model<EventRecord>('Event', eventSchema);
  const EventDead = connection.model<DeadEventRecord>('EventDead', deadEventSchema);
  const Directive = connection.model<DirectiveRecord>('Directive', directiveSchema);
  const Task = connection.model<TaskRecord>('Task', taskSchema);
  const Run = connection.model<RunRecord>('Run', runSchema);
  const Project = connection.model<ProjectRecord>('Project', projectSchema);
  const Knowledge = connection.model<KnowledgeRecord>('Knowledge', knowledgeSchema);
  const OfficeState = connection.model<OfficeStateRecord>('OfficeState', officeStateSchema);
  const models = {
    ...{ User, Agent, Event, EventDead, Directive, Task, Run },
    ...{ Project, Knowledge, OfficeState },
  };
  // Wait for indexes (unique email, unique eventId, list indexes) before the first write.
  await Promise.all(Object.values(models).map((model) => model.init()));
  return models;
}
