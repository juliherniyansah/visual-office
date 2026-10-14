import {
  AgentRuntime,
  HermesPromptSource,
  loadConstitution,
  type PromptBase,
  type RunRepository,
  type RunRequest,
  verifyCompletion,
} from '@redhunter/agent-runtime';
import {
  createHermesModels,
  HermesStore,
  InMemoryKnowledgeStore,
  seedProfiles,
} from '@redhunter/hermes';
import type { AdapterId, AgentAdapter, Decision, Run } from '@redhunter/shared';
import type { Connection } from 'mongoose';
import { toRun } from './db/mappers';
import type { Models } from './db/models';
import type { Outbox } from './events/outbox';
import { ConflictError } from './services/errors';
import { assertRunTransition } from './services/transitions';

export const PROMPT_LAYER_VERSION = 1;
const OUTPUT_CONTRACT = 'Return a concise summary of what you did.';
// Runs execute in-process; cwd is a workspace hint for adapters, not a guarantee (v1).
export const RUNS_CWD = process.cwd();

export interface ApiRuntimeDeps {
  readonly models: Models;
  readonly outbox: Outbox;
  readonly connection: Connection;
  readonly adapters: ReadonlyMap<AdapterId, AgentAdapter>;
}

export interface ApiRuntime {
  readonly runtime: AgentRuntime;
  readonly hermesStore: HermesStore;
  close(): Promise<void>;
}

// Compare-and-set transitions so the runtime state machine persists on the shared `runs` model.
function createRunRepository(models: Models): RunRepository {
  return {
    async create(run: Run): Promise<Run> {
      const record = await models.Run.create({
        _id: run.id,
        taskId: run.taskId,
        agentId: run.agentId,
        adapterId: run.adapterId,
        status: run.status,
        usage: run.usage,
        createdAt: new Date(),
      });
      return toRun(record.toObject());
    },
    async transition(runId, from, to, patch) {
      assertRunTransition(from, to);
      const updated = await models.Run.findOneAndUpdate(
        { _id: runId, status: from },
        {
          $set: {
            status: to,
            ...(patch?.promptSnapshot === undefined
              ? {}
              : { promptSnapshot: patch.promptSnapshot }),
            ...(patch?.vendorSessionId === undefined
              ? {}
              : { vendorSessionId: patch.vendorSessionId }),
            ...(patch?.usage === undefined ? {} : { usage: patch.usage }),
            ...(patch?.startedAt === undefined ? {} : { startedAt: new Date(patch.startedAt) }),
            ...(patch?.endedAt === undefined ? {} : { endedAt: new Date(patch.endedAt) }),
            ...(patch?.error === undefined ? {} : { error: patch.error }),
          },
        },
        { new: true, lean: true },
      );
      if (updated === null) {
        throw new ConflictError(`Run ${runId} is not in status ${from}`);
      }
      return toRun(updated as unknown as Parameters<typeof toRun>[0]);
    },
  };
}

// Decisions reach clients through the decision.requested outbox event; persistence of a
// decisions collection is a later todo. Kept in-process for v1.
function createDecisionRepository() {
  const decisions = new Map<string, Decision>();
  return {
    async create(decision: Decision): Promise<Decision> {
      decisions.set(decision.id, decision);
      return decision;
    },
    async findById(id: string): Promise<Decision | null> {
      return decisions.get(id) ?? null;
    },
    async update(id: string, patch: Partial<Decision>): Promise<Decision> {
      const existing = decisions.get(id);
      if (!existing) throw new Error(`Decision ${id} not found`);
      const updated = { ...existing, ...patch };
      decisions.set(id, updated);
      return updated;
    },
    async listPending(): Promise<Decision[]> {
      return Array.from(decisions.values()).filter((d) => !d.answeredAt);
    },
  };
}

// Non-Hermes prompt layers owned by apps/api (todo 13): identity comes from the seed profile.
function basePrompt(request: RunRequest): PromptBase {
  return {
    constitution: loadConstitution(),
    identity: {
      version: PROMPT_LAYER_VERSION,
      name: request.agentId,
      role: 'domain agent',
      personalityTraits: ['precise'],
      voiceGuidelines: 'Short sentences.',
    },
    rolePolicy: {
      version: PROMPT_LAYER_VERSION,
      company: 'RedHunter',
      role: 'domain',
      allowed: ['run the assigned adapter task'],
      forbidden: ['create directives', 'assign tasks'],
    },
    omoPolicy: { version: PROMPT_LAYER_VERSION, outputContract: OUTPUT_CONTRACT },
    project: { version: PROMPT_LAYER_VERSION, items: [] },
    task: {
      version: PROMPT_LAYER_VERSION,
      directive: request.task.text,
      acceptance: [],
      constraints: [],
    },
  };
}

// Wires AgentRuntime into the api process: Mongo-backed runs, outbox EventSink, Hermes store.
export async function createApiRuntime(deps: ApiRuntimeDeps): Promise<ApiRuntime> {
  const hermesModels = await createHermesModels(deps.connection);
  const store = new HermesStore(hermesModels);
  // Idempotent: without profiles every run fails with "No Hermes profile for <agent>".
  await seedProfiles(store);
  const runtime = new AgentRuntime({
    adapters: deps.adapters,
    // EventSink.emit returns void; the outbox resolves the stored event for REST callers.
    events: { emit: async (input) => void (await deps.outbox.emit(input)) },
    runs: createRunRepository(deps.models),
    decisions: createDecisionRepository(),
    experience: store,
    promptSource: new HermesPromptSource({
      store,
      knowledge: new InMemoryKnowledgeStore(),
      base: basePrompt,
    }),
    verify: verifyCompletion,
  });
  return {
    runtime,
    hermesStore: store,
    // Hermes models share the api connection; the caller owns connection.close().
    close: async () => {},
  };
}
