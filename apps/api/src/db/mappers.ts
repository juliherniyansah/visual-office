import {
  type Agent,
  AgentSchema,
  type Directive,
  DirectiveSchema,
  type KnowledgeDoc,
  KnowledgeDocSchema,
  type OfficeState,
  OfficeStateSchema,
  type Project,
  ProjectSchema,
  type PublicUser,
  PublicUserSchema,
  type Run,
  RunSchema,
  type Task,
  TaskSchema,
} from '@redhunter/shared';
import type {
  AgentRecord,
  DirectiveRecord,
  KnowledgeRecord,
  OfficeStateRecord,
  ProjectRecord,
  RunRecord,
  TaskRecord,
  UserRecord,
} from './models';

// Boundary between Mongo records and shared domain types; zod re-validates every read.
export function toPublicUser(record: Pick<UserRecord, '_id' | 'email' | 'role'>): PublicUser {
  return PublicUserSchema.parse({
    id: record._id.toHexString(),
    email: record.email,
    role: record.role,
  });
}

export function toAgent(record: AgentRecord): Agent {
  const { _id, ...fields } = record;
  return AgentSchema.parse({ ...fields, id: _id });
}

// Plain zod objects strip unknown keys, so storage-only createdAt never leaks to clients.
export function toDirective(record: DirectiveRecord): Directive {
  return DirectiveSchema.parse({ ...record, id: record._id });
}

export function toTask(record: TaskRecord): Task {
  return TaskSchema.parse({ ...record, id: record._id });
}

export function toRun(record: RunRecord): Run {
  const { startedAt, endedAt, ...fields } = record;
  return RunSchema.parse({
    ...fields,
    id: record._id,
    ...(startedAt === undefined ? {} : { startedAt: startedAt.toISOString() }),
    ...(endedAt === undefined ? {} : { endedAt: endedAt.toISOString() }),
  });
}

export function toProject(record: ProjectRecord): Project {
  return ProjectSchema.parse({ ...record, id: record._id });
}

export function toKnowledgeDoc(record: KnowledgeRecord): KnowledgeDoc {
  return KnowledgeDocSchema.parse({ ...record, id: record._id });
}

export function toOfficeState(record: OfficeStateRecord): OfficeState {
  const { _id, updatedAt, ...fields } = record;
  return OfficeStateSchema.parse({ ...fields, updatedAt: updatedAt.toISOString() });
}
