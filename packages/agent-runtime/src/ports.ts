import type { AssembledContext, ContextTask, ExperienceInput } from '@redhunter/hermes';
import type {
  Actor,
  AdapterId,
  AgentId,
  Decision,
  HermesExperience,
  OmoPolicy,
  OmoPolicyOverride,
  Run,
  RunStatus,
  Verdict,
} from '@redhunter/shared';
import type { PromptBase } from './prompt/from-hermes';

// Ports implemented by apps/api (todo 13); in-memory versions live in src/test-support.

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
}

export const NOOP_LOGGER: Logger = { info: () => {} };

export type RunPatch = Partial<
  Pick<Run, 'promptSnapshot' | 'vendorSessionId' | 'usage' | 'startedAt' | 'endedAt' | 'error'>
>;

export interface RunRepository {
  create(run: Run): Promise<Run>;
  // Compare-and-set: must reject (InvalidRunTransitionError) when the stored status is not `from`.
  transition(runId: string, from: RunStatus, to: RunStatus, patch?: RunPatch): Promise<Run>;
}

export interface DecisionRepository {
  create(decision: Decision): Promise<Decision>;
  findById(id: string): Promise<Decision | null>;
  update(id: string, patch: Partial<Decision>): Promise<Decision>;
  listPending(): Promise<Decision[]>;
}

// Hermes write side; HermesStore satisfies it structurally.
export interface ExperienceWriter {
  addExperience(input: ExperienceInput): Promise<HermesExperience>;
}

export interface RunTask extends ContextTask {
  readonly acceptance: readonly string[];
}

export interface PolicyOverrideRequest {
  readonly override: OmoPolicyOverride;
  // Who set the override on the task; only managers (coo, cto) are accepted.
  readonly actor: Actor;
}

export interface RunRequest {
  readonly runId: string;
  readonly taskId: string;
  readonly agentId: AgentId;
  readonly adapterId: AdapterId;
  readonly cwd: string;
  readonly task: RunTask;
  // agents.omoPolicy of the assignee.
  readonly agentPolicy: OmoPolicy;
  readonly policyOverride?: PolicyOverrideRequest;
}

export interface PromptSources {
  readonly context: AssembledContext;
  readonly base: PromptBase;
}

// Loads Hermes context (assembleContext) plus the non-Hermes layers for one run.
export interface PromptSourceProvider {
  load(request: RunRequest, budget: number): Promise<PromptSources>;
}

export interface Completion {
  readonly finalText: string;
  readonly structured?: unknown;
  readonly artifacts: readonly string[];
}

export interface VerifyOutcome {
  readonly verdict: Verdict;
  readonly evidence: readonly string[];
}

// T10 owns the real verify(); the runtime only consumes its outcome.
export type VerifyFn = (
  completion: Completion,
  request: RunRequest,
) => VerifyOutcome | Promise<VerifyOutcome>;

// Called before retry N (1-based); production default sleeps, tests inject a no-op.
export type BackoffFn = (retry: number) => Promise<void>;
