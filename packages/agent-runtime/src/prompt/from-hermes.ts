import {
  type AssembledContext,
  assembleContext,
  type ContextLayerId,
  type HermesStore,
  type KnowledgeStore,
} from '@redhunter/hermes';
import type { OmoPolicy } from '@redhunter/shared';
import type { PromptSourceProvider, PromptSources, RunRequest } from '../ports';
import type { ItemsSource, OmoPolicySource, PromptInput } from './layers';

// Bump when the hermes -> composer mapping changes: part of each mapped layer's version.
export const HERMES_CONTEXT_VERSION = 1;

// Non-Hermes layers (constitution, role policy, project, task) plus the layer-4 contract.
export interface PromptBase extends Omit<PromptInput, 'omoPolicy' | 'skills' | 'memory' | 'rag'> {
  readonly omoPolicy: Omit<OmoPolicySource, 'policy'>;
}

function texts(context: AssembledContext, id: ContextLayerId): string[] {
  return context.layers.find((layer) => layer.id === id)?.blocks.map((block) => block.text) ?? [];
}

const items = (list: readonly string[]): ItemsSource => ({
  version: HERMES_CONTEXT_VERSION,
  items: list,
});

// Hermes splits memories and experience; composer layer 6 holds both (memories first).
// The hermes profile layer is not mapped: identity comes from the base (typed profile fields).
export function promptInputFromHermes(
  context: AssembledContext,
  base: PromptBase,
  policy: OmoPolicy,
): PromptInput {
  return {
    ...base,
    omoPolicy: { ...base.omoPolicy, policy },
    skills: items(texts(context, 'skills')),
    memory: items([...texts(context, 'memories'), ...texts(context, 'experience')]),
    rag: items(texts(context, 'rag')),
  };
}

export interface HermesPromptSourceDeps {
  readonly store: HermesStore;
  readonly knowledge: KnowledgeStore;
  // Non-Hermes layers for a run (project/task/role policy are owned by apps/api, todo 13).
  readonly base: (request: RunRequest) => PromptBase | Promise<PromptBase>;
}

export class HermesPromptSource implements PromptSourceProvider {
  constructor(private readonly deps: HermesPromptSourceDeps) {}

  async load(request: RunRequest, budget: number): Promise<PromptSources> {
    const [context, base] = await Promise.all([
      assembleContext(request.agentId, request.task, budget, {
        store: this.deps.store,
        knowledge: this.deps.knowledge,
      }),
      this.deps.base(request),
    ]);
    return { context, base };
  }
}
