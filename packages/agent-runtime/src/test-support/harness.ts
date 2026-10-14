import type { AssembledContext } from '@redhunter/hermes';
import type { AgentAdapter, OmoPolicy } from '@redhunter/shared';
import type { PromptSourceProvider, RunRequest } from '../ports';
import type { PromptBase } from '../prompt/from-hermes';
import { AgentRuntime, type AgentRuntimeDeps } from '../runtime';
import {
  InMemoryDecisionRepository,
  InMemoryExperienceWriter,
  InMemoryRunRepository,
  RecordingLogger,
  RecordingSink,
  sequentialIds,
  TEST_NOW,
} from './in-memory';
import { makeInput } from './prompt-input';

export const DEFAULT_POLICY: OmoPolicy = {
  maxRetries: 2,
  maxTurns: 30,
  budgetTokens: 32_000,
  allowedTools: ['edit'],
  escalationChain: ['coo', 'cto', 'human'],
};

export function makeRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    runId: 'run-1',
    taskId: 'task-1',
    agentId: 'programming',
    adapterId: 'opencode',
    cwd: '/srv/repos/redhunter',
    task: {
      text: 'Fix the login bug',
      acceptance: ['tests pass'],
      capabilityTags: ['code'],
      taskType: 'bugfix',
    },
    agentPolicy: DEFAULT_POLICY,
    ...overrides,
  };
}

const fixture = makeInput();
export const STUB_BASE: PromptBase = {
  constitution: fixture.constitution,
  identity: fixture.identity,
  rolePolicy: fixture.rolePolicy,
  omoPolicy: { version: 1, outputContract: 'Return a summary.' },
  project: fixture.project,
  task: fixture.task,
};

export const STUB_CONTEXT: AssembledContext = {
  agentId: 'programming',
  budget: 32_000,
  layers: [
    { id: 'profile', blocks: [{ id: 'p', text: 'Name: Ada', tokens: 3 }], tokens: 3 },
    { id: 'skills', blocks: [{ id: 's', text: 'skill one', tokens: 3 }], tokens: 3 },
    { id: 'memories', blocks: [{ id: 'm', text: 'memory one', tokens: 3 }], tokens: 3 },
    { id: 'experience', blocks: [{ id: 'e', text: 'lesson one', tokens: 3 }], tokens: 3 },
    { id: 'rag', blocks: [{ id: 'r', text: 'doc one', tokens: 2 }], tokens: 2 },
  ],
  totalTokens: 14,
  dropped: [],
};

export class StubPromptSource implements PromptSourceProvider {
  readonly calls: { request: RunRequest; budget: number }[] = [];

  async load(request: RunRequest, budget: number) {
    this.calls.push({ request, budget });
    return { context: STUB_CONTEXT, base: STUB_BASE };
  }
}

export function createHarness(adapter: AgentAdapter, overrides: Partial<AgentRuntimeDeps> = {}) {
  const runs = new InMemoryRunRepository();
  const decisions = new InMemoryDecisionRepository();
  const experience = new InMemoryExperienceWriter();
  const sink = new RecordingSink();
  const logger = new RecordingLogger();
  const promptSource = new StubPromptSource();
  const backoffs: number[] = [];
  const runtime = new AgentRuntime({
    adapters: new Map([[adapter.id, adapter]]),
    events: sink,
    runs,
    decisions,
    experience,
    promptSource,
    logger,
    now: () => TEST_NOW,
    newId: sequentialIds(),
    backoff: async (retry) => {
      backoffs.push(retry);
    },
    ...overrides,
  });
  return { runtime, runs, decisions, experience, sink, logger, promptSource, backoffs };
}
