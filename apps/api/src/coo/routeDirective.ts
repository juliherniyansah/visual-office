import { randomUUID } from 'node:crypto';
import type { AgentRuntime, RunRequest } from '@redhunter/agent-runtime';
import type { AdapterId, AgentId, Directive, OmoPolicy } from '@redhunter/shared';
import type { AgentRecord, Models } from '../db/models';
import { RUNS_CWD } from '../runtime';
import type { ServiceDeps } from '../services/deps';
import { ConflictError } from '../services/errors';
import { assignTask, createTask } from '../services/tasks';

const DEFAULT_ADAPTER: AdapterId = 'opencode';
// Tasks need a project row; the api has no project UI yet, so routed tasks share one.
export const DEFAULT_PROJECT_ID = 'project-default';

export interface RouteDirectiveDeps extends ServiceDeps {
  readonly runtime: AgentRuntime;
  readonly adapterFor?: (agentId: AgentId) => AdapterId;
}

// Deterministic v1: first seed agent whose capabilityTags intersect the directive's (LLM routing later).
export function matchAgent(
  agents: readonly AgentRecord[],
  capabilityTags: readonly string[],
): AgentRecord | undefined {
  return agents.find((agent) =>
    capabilityTags.some((tag) => (agent.capabilityTags as readonly string[]).includes(tag)),
  );
}

async function ensureProject(models: Models): Promise<void> {
  await models.Project.updateOne(
    { _id: DEFAULT_PROJECT_ID },
    { $setOnInsert: { name: 'Default project', createdAt: new Date() } },
    { upsert: true },
  );
}

export async function routeDirective(
  deps: RouteDirectiveDeps,
  directive: Directive,
): Promise<void> {
  const rows = (await deps.models.Agent.find({}).lean()) as AgentRecord[];
  const agent = matchAgent(rows, directive.capabilityTags);
  if (agent === undefined) {
    throw new ConflictError('No agent matches the directive capabilityTags');
  }
  const agentId = agent._id as AgentId;
  const adapterId = deps.adapterFor === undefined ? DEFAULT_ADAPTER : deps.adapterFor(agentId);
  const actor = { kind: 'agent', id: 'coo' } as const;

  await ensureProject(deps.models);
  const task = await createTask(
    { models: deps.models, outbox: deps.outbox },
    { actor, directiveId: directive.id, projectId: DEFAULT_PROJECT_ID, acceptance: [] },
  );
  await assignTask(
    { models: deps.models, outbox: deps.outbox },
    { actor, taskId: task.id, agentId },
  );

  // The runtime's RunRepository creates the run row and owns all status transitions.
  const request: RunRequest = {
    runId: randomUUID(),
    taskId: task.id,
    agentId,
    adapterId,
    cwd: RUNS_CWD,
    task: {
      text: directive.text,
      acceptance: task.acceptance,
      capabilityTags: directive.capabilityTags,
    },
    agentPolicy: agent.omoPolicy as OmoPolicy,
  };
  await deps.runtime.execute(request);
}
