import {
  AGENT_DEFINITIONS,
  type AgentId,
  type HermesExperience,
  type HermesMemory,
  type HermesProfile,
} from '@redhunter/shared';
import { HermesBudgetError } from './errors';
import { type KnowledgeStore, tokenize } from './knowledge';
import type { HermesStore } from './store';
import { estimateTokens as defaultEstimate, type TokenEstimator } from './tokens';

export interface ContextTask {
  readonly text: string;
  readonly capabilityTags: readonly string[];
  readonly taskType?: string;
}

export const CONTEXT_LAYER_IDS = ['profile', 'skills', 'memories', 'experience', 'rag'] as const;
export type ContextLayerId = (typeof CONTEXT_LAYER_IDS)[number];

export interface ContextBlock {
  readonly id: string;
  readonly text: string;
  readonly tokens: number;
}

export interface ContextLayer {
  readonly id: ContextLayerId;
  readonly blocks: readonly ContextBlock[];
  readonly tokens: number;
}

export interface AssembledContext {
  readonly agentId: AgentId;
  readonly budget: number;
  readonly layers: readonly ContextLayer[];
  readonly totalTokens: number;
  readonly dropped: readonly { readonly layer: ContextLayerId; readonly id: string }[];
}

export interface AssembleDeps {
  readonly store: HermesStore;
  readonly knowledge: KnowledgeStore;
  readonly estimateTokens?: TokenEstimator;
}

const TOP_MEMORIES = 3;
const TOP_EXPERIENCE = 3;
const TOP_RAG = 3;
// Fill order for the remaining budget after the profile (mirrors composer priority 5 > 6 > 7).
const FILL_ORDER: readonly Exclude<ContextLayerId, 'profile'>[] = [
  'skills',
  'memories',
  'experience',
  'rag',
];

type Candidates = Record<ContextLayerId, { id: string; text: string }[]>;

function renderProfile(profile: HermesProfile): string {
  return [
    `Name: ${profile.name}`,
    `Role: ${profile.role}`,
    `Traits: ${profile.personalityTraits.join(', ')}`,
    `Voice: ${profile.voiceGuidelines}`,
    `Constitution: ${profile.constitutionRef}`,
  ].join('\n');
}

function overlap(text: string, taskTerms: ReadonlySet<string>): number {
  return new Set(tokenize(text).filter((term) => taskTerms.has(term))).size;
}

// Relevance (distinct task terms hit) > importance > recency > id.
export function rankMemories(memories: readonly HermesMemory[], taskText: string): HermesMemory[] {
  const taskTerms = new Set(tokenize(taskText));
  const scored = memories.map((memory) => ({ memory, hits: overlap(memory.text, taskTerms) }));
  scored.sort(
    (a, b) =>
      b.hits - a.hits ||
      b.memory.importance - a.memory.importance ||
      b.memory.createdAt.localeCompare(a.memory.createdAt) ||
      a.memory.id.localeCompare(b.memory.id),
  );
  return scored.map((entry) => entry.memory);
}

function rankExperience(rows: readonly HermesExperience[], taskType?: string): HermesExperience[] {
  const sameType = rows.filter((row) => row.taskType === taskType);
  const others = rows.filter((row) => row.taskType !== taskType);
  return [...sameType, ...others];
}

async function collectCandidates(
  agentId: AgentId,
  task: ContextTask,
  deps: AssembleDeps,
): Promise<Candidates> {
  const role = AGENT_DEFINITIONS.find((definition) => definition.id === agentId)?.role ?? '';
  const [profile, memories, skills, experience, hits] = await Promise.all([
    deps.store.getProfile(agentId, agentId),
    deps.store.getMemories(agentId, agentId),
    deps.store.findSkills(role, task.capabilityTags),
    deps.store.getExperience(agentId, agentId),
    deps.knowledge.search(task.text, TOP_RAG),
  ]);
  return {
    profile: [{ id: profile.id, text: renderProfile(profile) }],
    skills: skills.map((skill) => ({ id: skill.id, text: `## ${skill.name}\n${skill.markdown}` })),
    memories: rankMemories(memories, task.text)
      .slice(0, TOP_MEMORIES)
      .map((memory) => ({ id: memory.id, text: `[${memory.kind}] ${memory.text}` })),
    experience: rankExperience(experience, task.taskType)
      .slice(0, TOP_EXPERIENCE)
      .map((row) => ({
        id: row.id,
        text: `${row.taskType} (${row.outcome}): ${row.lessons.join('; ')}`,
      })),
    rag: hits.map((hit) => ({ id: hit.doc.id, text: `${hit.doc.title}: ${hit.doc.text}` })),
  };
}

function toLayer(id: ContextLayerId, blocks: ContextBlock[]): ContextLayer {
  return { id, blocks, tokens: blocks.reduce((sum, block) => sum + block.tokens, 0) };
}

// Profile is mandatory and never truncated; other blocks are kept whole or dropped (no partial
// text), greedily in FILL_ORDER, so a smaller later block may still fit after a drop.
export async function assembleContext(
  agentId: AgentId,
  task: ContextTask,
  budget: number,
  deps: AssembleDeps,
): Promise<AssembledContext> {
  if (!Number.isInteger(budget) || budget < 0) {
    throw new HermesBudgetError(`Budget must be a non-negative integer, got ${budget}`);
  }
  const estimate = deps.estimateTokens ?? defaultEstimate;
  const candidates = await collectCandidates(agentId, task, deps);
  const measure = (id: ContextLayerId) =>
    candidates[id].map((block) => ({ ...block, tokens: estimate(block.text) }));
  const profile = toLayer('profile', measure('profile'));
  if (profile.tokens > budget) {
    throw new HermesBudgetError(`Profile needs ${profile.tokens} tokens, budget is ${budget}`);
  }
  let remaining = budget - profile.tokens;
  const dropped: { layer: ContextLayerId; id: string }[] = [];
  const filled = new Map<ContextLayerId, ContextBlock[]>();
  for (const layerId of FILL_ORDER) {
    const kept: ContextBlock[] = [];
    for (const block of measure(layerId)) {
      if (block.tokens <= remaining) {
        kept.push(block);
        remaining -= block.tokens;
      } else {
        dropped.push({ layer: layerId, id: block.id });
      }
    }
    filled.set(layerId, kept);
  }
  const layers = [profile, ...FILL_ORDER.map((id) => toLayer(id, filled.get(id) ?? []))];
  const totalTokens = layers.reduce((sum, layer) => sum + layer.tokens, 0);
  return { agentId, budget, layers, totalTokens, dropped };
}
