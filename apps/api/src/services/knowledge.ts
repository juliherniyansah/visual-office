import { randomUUID } from 'node:crypto';
import type { KnowledgeDoc } from '@redhunter/shared';
import { toKnowledgeDoc } from '../db/mappers';
import type { ServiceDeps } from './deps';

export interface CreateKnowledgeInput {
  readonly title: string;
  readonly text: string;
  readonly tags: readonly string[];
}

// No knowledge.* event exists in the shared catalog; Hermes hydrates from the collection at boot.
export async function createKnowledgeDoc(
  deps: ServiceDeps,
  input: CreateKnowledgeInput,
): Promise<KnowledgeDoc> {
  const record = await deps.models.Knowledge.create({
    _id: randomUUID(),
    title: input.title,
    text: input.text,
    tags: [...input.tags],
    createdAt: new Date(),
  });
  return toKnowledgeDoc(record.toObject());
}

export async function listKnowledgeDocs(deps: ServiceDeps): Promise<KnowledgeDoc[]> {
  const records = await deps.models.Knowledge.find().sort({ createdAt: 1, _id: 1 }).lean();
  return records.map(toKnowledgeDoc);
}
