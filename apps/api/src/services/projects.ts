import { randomUUID } from 'node:crypto';
import type { AdapterId, Project } from '@redhunter/shared';
import { toProject } from '../db/mappers';
import type { ServiceDeps } from './deps';

export interface CreateProjectInput {
  readonly name: string;
  readonly repoPath: string;
  readonly defaultAdapter: AdapterId;
}

// No project.* event exists in the shared catalog, so creation emits nothing (decisions.md 5b).
export async function createProject(
  deps: ServiceDeps,
  input: CreateProjectInput,
): Promise<Project> {
  const record = await deps.models.Project.create({
    _id: randomUUID(),
    name: input.name,
    repoPath: input.repoPath,
    defaultAdapter: input.defaultAdapter,
    createdAt: new Date(),
  });
  return toProject(record.toObject());
}

export async function listProjects(deps: ServiceDeps): Promise<Project[]> {
  const records = await deps.models.Project.find().sort({ createdAt: 1, _id: 1 }).lean();
  return records.map(toProject);
}
