import { randomUUID } from 'node:crypto';
import type { Actor, Directive, Priority } from '@redhunter/shared';
import { toDirective } from '../db/mappers';
import type { ServiceDeps } from './deps';

export interface CreateDirectiveInput {
  readonly text: string;
  readonly priority: Priority;
  readonly capabilityTags: readonly string[];
  readonly issuedBy: Actor;
}

// Write the document first, then emit (standalone mongod: no multi-doc transactions).
export async function createDirective(
  deps: ServiceDeps,
  input: CreateDirectiveInput,
): Promise<Directive> {
  const record = await deps.models.Directive.create({
    _id: randomUUID(),
    issuedBy: input.issuedBy,
    text: input.text,
    status: 'issued',
    priority: input.priority,
    capabilityTags: [...input.capabilityTags],
    createdAt: new Date(),
  });
  const directive = toDirective(record.toObject());
  await deps.outbox.emit({
    type: 'directive.created',
    aggregate: { kind: 'directive', id: directive.id },
    actor: input.issuedBy,
    payload: { directive },
  });
  return directive;
}

export async function listDirectives(deps: ServiceDeps): Promise<Directive[]> {
  const records = await deps.models.Directive.find().sort({ createdAt: 1, _id: 1 }).lean();
  return records.map(toDirective);
}
