import type {
  AdapterId,
  AgentAdapter,
  AgentStatus,
  EscalationTarget,
  EventSink,
  OmoPolicy,
  PermissionDecision,
  Result,
  Run,
  RunStatus,
} from '@redhunter/shared';
import { HUMAN_ESCALATION } from '@redhunter/shared';
import {
  type AttemptResult,
  errorMessage,
  NO_TERMINAL_EVENT,
  type RunProgress,
  runAttempt,
} from './attempt';
import { assertAuthorized } from './authorize';
import { resolvePolicy } from './policy';
import type {
  BackoffFn,
  Completion,
  DecisionRepository,
  ExperienceWriter,
  Logger,
  PromptSourceProvider,
  RunPatch,
  RunRepository,
  RunRequest,
  VerifyFn,
} from './ports';
import { composePrompt } from './prompt/composer';
import { promptInputFromHermes } from './prompt/from-hermes';
import { RunEvents } from './run-events';
import { RunStateMachine } from './state-machine';
import { WorkerTracker } from './workers';

export class UnknownAdapterError extends Error {
  override readonly name = 'UnknownAdapterError';

  constructor(readonly adapterId: string) {
    super(`No adapter registered for ${adapterId}`);
  }
}

export class RunNotActiveError extends Error {
  override readonly name = 'RunNotActiveError';

  constructor(readonly runId: string) {
    super(`Run ${runId} is not active`);
  }
}

export interface AgentRuntimeDeps {
  readonly adapters: ReadonlyMap<AdapterId, AgentAdapter>;
  readonly events: EventSink;
  readonly runs: RunRepository;
  readonly decisions: DecisionRepository;
  readonly experience: ExperienceWriter;
  readonly promptSource: PromptSourceProvider;
  readonly verify?: VerifyFn;
  readonly backoff?: BackoffFn;
  readonly logger?: Logger;
  readonly now?: () => Date;
  readonly newId?: () => string;
}

export interface RunOutcome {
  readonly run: Run;
  readonly attempts: number;
  readonly result?: Result;
}

const BASE_BACKOFF_MS = 1000;
const ESCALATION_OPTIONS = ['retry', 'reassign', 'cancel'];
const PERMISSION_OPTIONS: PermissionDecision[] = ['allow', 'deny'];
const DEFAULT_TASK_TYPE = 'general';

export const backoffDelayMs = (retry: number): number => BASE_BACKOFF_MS * 2 ** (retry - 1);
const sleepBackoff: BackoffFn = (retry) => Bun.sleep(backoffDelayMs(retry));
// T10 replaces this with the real verify(); here an adapter `completed` passes.
const passVerify: VerifyFn = () => ({ verdict: 'pass', evidence: [] });

interface ActiveRun {
  readonly request: RunRequest;
  readonly adapter: AgentAdapter;
  readonly controller: AbortController;
  readonly events: RunEvents;
  status: RunStatus;
  pendingPermission?: string;
}

// Next manager in the chain; the agent itself is skipped, an exhausted chain goes to a human.
export function escalationTarget(policy: OmoPolicy, agentId: string): EscalationTarget {
  return policy.escalationChain.find((target) => target !== agentId) ?? HUMAN_ESCALATION;
}

export class AgentRuntime {
  readonly #deps: AgentRuntimeDeps;
  readonly #machine: RunStateMachine;
  readonly #active = new Map<string, ActiveRun>();
  readonly #now: () => Date;
  readonly #newId: () => string;

  readonly decisions: AgentRuntimeDeps['decisions'];

  constructor(deps: AgentRuntimeDeps) {
    this.#deps = deps;
    this.#machine = new RunStateMachine({ runs: deps.runs, logger: deps.logger });
    this.#now = deps.now ?? (() => new Date());
    this.#newId = deps.newId ?? (() => crypto.randomUUID());
    this.decisions = deps.decisions;
  }

  // Runs one assigned task to a terminal (or paused) state. Guards run before anything persists.
  async execute(request: RunRequest): Promise<RunOutcome> {
    assertAuthorized(request.agentId, 'runAdapter');
    const policy = resolvePolicy({
      agentPolicy: request.agentPolicy,
      override: request.policyOverride,
    });
    const adapter = this.#deps.adapters.get(request.adapterId);
    if (adapter === undefined) throw new UnknownAdapterError(request.adapterId);
    const run = await this.#deps.runs.create({
      id: request.runId,
      taskId: request.taskId,
      agentId: request.agentId,
      adapterId: request.adapterId,
      status: 'queued',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    const events = new RunEvents(run.id, run.agentId);
    const active: ActiveRun = {
      request,
      adapter,
      controller: new AbortController(),
      events,
      status: 'queued',
    };
    this.#active.set(run.id, active);
    try {
      await this.#emit(events.started(run));
      return await this.#drive(active, policy);
    } catch (error) {
      return await this.#fail(active, errorMessage(error));
    } finally {
      this.#active.delete(run.id);
    }
  }

  async answerPermission(
    runId: string,
    permissionId: string,
    decision: PermissionDecision,
  ): Promise<void> {
    const active = this.#getActive(runId);
    if (active.pendingPermission !== permissionId) {
      throw new Error(`No pending permission ${permissionId} for run ${runId}`);
    }
    active.pendingPermission = undefined;
    // Status first: forwarding resumes the adapter, whose next events must follow 'working'.
    await this.#setAgentStatus(active, 'working');
    await active.adapter.answerPermission(runId, permissionId, decision);
  }

  // Human pause (RBAC operator+ is checked by the caller layer). The 30-min timeout is todo 18.
  async pause(runId: string): Promise<void> {
    const active = this.#getActive(runId);
    active.controller.abort();
    await active.adapter.cancel(runId);
  }

  async #drive(active: ActiveRun, policy: OmoPolicy): Promise<RunOutcome> {
    const { request, events } = active;
    await this.#move(active, 'composing');
    await this.#setAgentStatus(active, 'thinking');
    const sources = await this.#deps.promptSource.load(request, policy.budgetTokens);
    const prompt = composePrompt(promptInputFromHermes(sources.context, sources.base, policy));
    if (active.controller.signal.aborted) return this.#paused(active, 0);
    const promptSnapshot = { text: prompt.text, layers: [...prompt.layers], hash: prompt.hash };
    await this.#move(active, 'executing', { promptSnapshot, startedAt: this.#iso() });
    await this.#setAgentStatus(active, 'working');

    const progress: RunProgress = { seq: 0, usage: { inputTokens: 0, outputTokens: 0 } };
    const workers = new WorkerTracker(this.#newId);
    let attempts = 0;
    let last: AttemptResult = { kind: 'ended' };
    while (attempts <= policy.maxRetries) {
      if (attempts > 0) {
        await (this.#deps.backoff ?? sleepBackoff)(attempts);
        await this.#setAgentStatus(active, 'working');
      }
      attempts += 1;
      last = await runAttempt({
        adapter: active.adapter,
        start: () =>
          active.adapter.start({
            runId: request.runId,
            agentId: request.agentId,
            cwd: request.cwd,
            prompt: prompt.text,
            policy,
            signal: active.controller.signal,
          }),
        events,
        workers,
        progress,
        hooks: {
          emit: (input) => this.#emit(input),
          onPermission: (id, tool, detail) => this.#requestPermission(active, id, tool, detail),
        },
      });
      // A permission asked by an ended attempt can never be answered: the adapter run is gone.
      active.pendingPermission = undefined;
      if (active.controller.signal.aborted) return this.#paused(active, attempts);
      if (last.kind === 'completed') break;
    }
    const metadata: RunPatch = {
      usage: progress.usage,
      ...(progress.vendorSessionId === undefined
        ? {}
        : { vendorSessionId: progress.vendorSessionId }),
    };
    if (last.kind !== 'completed') {
      const error = last.kind === 'failed' ? last.error : NO_TERMINAL_EVENT;
      return this.#escalate(active, policy, attempts, error, metadata);
    }
    await this.#move(active, 'verifying', metadata);
    return this.#verify(active, policy, attempts, last.completion);
  }

  async #verify(
    active: ActiveRun,
    policy: OmoPolicy,
    attempts: number,
    completion: Completion,
  ): Promise<RunOutcome> {
    const { request, events } = active;
    const outcome = await (this.#deps.verify ?? passVerify)(completion, request);
    if (outcome.verdict === 'fail') {
      const error = `Verification failed: ${outcome.evidence.join('; ')}`;
      return this.#escalate(active, policy, attempts, error, {});
    }
    const taskType = request.task.taskType ?? DEFAULT_TASK_TYPE;
    const evidence = outcome.evidence.filter((line) => line !== '');
    await this.#deps.experience.addExperience({
      agentId: request.agentId,
      taskType,
      outcome: 'pass',
      lessons: evidence.length > 0 ? evidence : [`Completed ${taskType} in ${attempts} attempt(s)`],
      runId: request.runId,
    });
    const result: Result = {
      id: this.#newId(),
      runId: request.runId,
      summary: completion.finalText,
      artifacts: [...completion.artifacts],
      verdict: 'pass',
    };
    await this.#emit(events.resultRecorded(result));
    const run = await this.#move(active, 'succeeded', { endedAt: this.#iso() });
    await this.#emit(events.completed());
    await this.#setAgentStatus(active, 'idle');
    return { run, attempts, result };
  }

  async #escalate(
    active: ActiveRun,
    policy: OmoPolicy,
    attempts: number,
    error: string,
    patch: RunPatch,
  ): Promise<RunOutcome> {
    const { request, events } = active;
    const target = escalationTarget(policy, request.agentId);
    const run = await this.#move(active, 'escalated', { ...patch, error, endedAt: this.#iso() });
    const decision = await this.#deps.decisions.create({
      id: this.#newId(),
      runId: request.runId,
      question: `Run ${request.runId} escalated to ${target} after ${attempts} attempt(s): ${error}`,
      options: [...ESCALATION_OPTIONS],
      createdAt: this.#iso(),
    });
    await this.#emit(events.escalated(target));
    await this.#emit(events.decisionRequested(decision));
    await this.#setAgentStatus(active, 'idle');
    return { run, attempts };
  }

  async #fail(active: ActiveRun, error: string): Promise<RunOutcome> {
    const run = await this.#move(active, 'failed', { error, endedAt: this.#iso() });
    await this.#emit(active.events.failed(error));
    await this.#setAgentStatus(active, 'idle');
    return { run, attempts: 0 };
  }

  async #paused(active: ActiveRun, attempts: number): Promise<RunOutcome> {
    const run = await this.#move(active, 'paused');
    await this.#setAgentStatus(active, 'blocked');
    return { run, attempts };
  }

  // Run stays `executing`: only the agent status changes while a human decides.
  async #requestPermission(active: ActiveRun, permissionId: string, tool: string, detail: string) {
    const decision = await this.#deps.decisions.create({
      id: this.#newId(),
      runId: active.request.runId,
      question: `Allow ${tool}: ${detail}?`,
      options: [...PERMISSION_OPTIONS],
      createdAt: this.#iso(),
    });
    active.pendingPermission = permissionId;
    await this.#emit(active.events.permissionRequested(permissionId, tool, detail));
    await this.#emit(active.events.decisionRequested(decision));
    await this.#setAgentStatus(active, 'waiting_permission');
  }

  async #move(active: ActiveRun, to: RunStatus, patch?: RunPatch): Promise<Run> {
    const run = await this.#machine.transition(active.request.runId, active.status, to, patch);
    active.status = to;
    return run;
  }

  async #setAgentStatus(active: ActiveRun, status: AgentStatus): Promise<void> {
    await this.#emit(active.events.agentStatus(status));
  }

  async #emit(input: Parameters<EventSink['emit']>[0]): Promise<void> {
    await this.#deps.events.emit(input);
  }

  #getActive(runId: string): ActiveRun {
    const active = this.#active.get(runId);
    if (active === undefined) throw new RunNotActiveError(runId);
    return active;
  }

  #iso(): string {
    return this.#now().toISOString();
  }
}
