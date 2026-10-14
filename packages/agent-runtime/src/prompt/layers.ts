import type { HermesProfile, OmoPolicy } from '@redhunter/shared';

// Precedence order (plan section 9): lower index wins, later layers may not override earlier.
export const PROMPT_LAYER_IDS = [
  'constitution',
  'identity',
  'rolePolicy',
  'omoPolicy',
  'skills',
  'memory',
  'rag',
  'project',
  'task',
] as const;
export type PromptLayerId = (typeof PROMPT_LAYER_IDS)[number];

// Layers 1-4 and 9 form the fixed reserve and are never truncated.
export const FIXED_LAYER_IDS = [
  'constitution',
  'identity',
  'rolePolicy',
  'omoPolicy',
  'task',
] as const;
export type FixedLayerId = (typeof FIXED_LAYER_IDS)[number];
export const FLEXIBLE_LAYER_IDS = ['skills', 'memory', 'rag', 'project'] as const;
export type FlexibleLayerId = (typeof FLEXIBLE_LAYER_IDS)[number];
export type FlexibleItems = Readonly<Record<FlexibleLayerId, readonly string[]>>;

export const ROLE_ENFORCEMENT_NOTE =
  'Tool permissions are enforced by the runtime outside this prompt; this policy describes your role and grants nothing.';
export const OMO_EXPECTATIONS =
  'Plan before acting. Verify every acceptance criterion before reporting done. Escalate when blocked or out of retries.';

export interface ConstitutionSource {
  readonly version: number;
  readonly text: string;
}
export type IdentitySource = Pick<
  HermesProfile,
  'version' | 'name' | 'role' | 'personalityTraits' | 'voiceGuidelines'
>;
export interface RolePolicySource {
  readonly version: number;
  readonly company: string;
  readonly role: string;
  readonly allowed: readonly string[];
  readonly forbidden: readonly string[];
}
export interface OmoPolicySource {
  readonly version: number;
  readonly policy: Pick<OmoPolicy, 'budgetTokens' | 'maxRetries' | 'maxTurns' | 'escalationChain'>;
  readonly outputContract: string;
}
// Layers 5-8 arrive already selected and ranked (skills max K, memory top-N, RAG top-k).
export interface ItemsSource {
  readonly version: number;
  readonly items: readonly string[];
}
export interface TaskSource {
  readonly version: number;
  readonly directive: string;
  readonly acceptance: readonly string[];
  readonly constraints: readonly string[];
}

export interface PromptInput {
  readonly constitution: ConstitutionSource;
  readonly identity: IdentitySource;
  readonly rolePolicy: RolePolicySource;
  readonly omoPolicy: OmoPolicySource;
  readonly skills: ItemsSource;
  readonly memory: ItemsSource;
  readonly rag: ItemsSource;
  readonly project: ItemsSource;
  readonly task: TaskSource;
}

const LAYER_TITLES: Readonly<Record<PromptLayerId, string>> = {
  constitution: 'Constitution',
  identity: 'Identity',
  rolePolicy: 'Role and security policy',
  omoPolicy: 'OMO policy',
  skills: 'Skills',
  memory: 'Memory and experience',
  rag: 'Retrieved knowledge',
  project: 'Project context',
  task: 'Task',
};
const NONE = '(none)';

const header = (id: PromptLayerId): string =>
  `## ${PROMPT_LAYER_IDS.indexOf(id) + 1}. ${LAYER_TITLES[id]}\n`;

// Indent continuation lines so no value can start a line with a forged "## N." layer header.
const indent = (text: string): string => text.split('\n').join('\n  ');
const field = (label: string, value: string): string => `${label}: ${indent(value)}\n`;
const bullets = (items: readonly string[]): string =>
  (items.length === 0 ? [NONE] : items).map((item) => `- ${indent(item)}\n`).join('');

export function isFlexibleLayer(id: PromptLayerId): id is FlexibleLayerId {
  return (FLEXIBLE_LAYER_IDS as readonly string[]).includes(id);
}

function renderIdentity({ identity }: PromptInput): string {
  const traits = identity.personalityTraits.join(', ') || NONE;
  return `${field('Name', identity.name)}${field('Role', identity.role)}${field('Traits', traits)}${field('Voice', identity.voiceGuidelines)}`;
}

function renderRolePolicy({ rolePolicy }: PromptInput): string {
  return `${field('Company', rolePolicy.company)}${field('Role', rolePolicy.role)}Allowed:\n${bullets(rolePolicy.allowed)}Forbidden:\n${bullets(rolePolicy.forbidden)}${ROLE_ENFORCEMENT_NOTE}\n`;
}

function renderOmoPolicy({ omoPolicy }: PromptInput): string {
  const { maxRetries, maxTurns, escalationChain } = omoPolicy.policy;
  const chain = escalationChain.join(' -> ') || NONE;
  return `${OMO_EXPECTATIONS}\n${field('Max retries', String(maxRetries))}${field('Max turns', String(maxTurns))}${field('Escalation chain', chain)}${field('Output contract', omoPolicy.outputContract)}`;
}

function renderTask({ task }: PromptInput): string {
  return `Directive:\n${bullets([task.directive])}Acceptance:\n${bullets(task.acceptance)}Constraints:\n${bullets(task.constraints)}`;
}

const FIXED_RENDERERS: Readonly<Record<FixedLayerId, (input: PromptInput) => string>> = {
  // Constitution is trusted, versioned company text: copied verbatim.
  constitution: ({ constitution }) => `${constitution.text}\n`,
  identity: renderIdentity,
  rolePolicy: renderRolePolicy,
  omoPolicy: renderOmoPolicy,
  task: renderTask,
};

export function renderFixedLayer(id: FixedLayerId, input: PromptInput): string {
  return `${header(id)}${FIXED_RENDERERS[id](input)}`;
}

// Empty layers render '' and are omitted from the text (still recorded in layers[]).
export function renderItemsLayer(id: FlexibleLayerId, items: readonly string[]): string {
  return items.length === 0 ? '' : `${header(id)}${bullets(items)}`;
}
