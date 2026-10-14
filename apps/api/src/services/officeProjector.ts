import {
  type AgentId,
  type AgentStatus,
  type DomainEvent,
  type FloorId,
  type OfficeAgent,
  type OfficeState,
  type Pose,
} from '@redhunter/shared';
import type { Models } from '../db/models';
import { INITIAL_OFFICE_STATE, OFFICE_STATE_ID } from './officeState';

// Plan section 14 pose mapping: thinking/working type at the desk; waiting/blocked stand.
const POSE_BY_STATUS: Record<AgentStatus, Pose> = {
  idle: 'sitting',
  thinking: 'sitting',
  working: 'sitting',
  waiting_permission: 'standing',
  blocked: 'standing',
  offline: 'sitting', // renderer hides offline agents; pose is irrelevant
};

export interface OfficeStateProjector {
  // EventSink for the dispatcher; recomputes only the affected agent entry.
  handle(event: DomainEvent): Promise<void>;
}

export interface ProjectorDeps {
  readonly models: Models;
  readonly now?: () => Date;
  // Called after each persisted bump; index.ts forwards this into the outbox as
  // `office.state_updated` so clients receive the delta.
  readonly onUpdated?: (version: number, changed: readonly OfficeAgent[]) => void | Promise<void>;
}

function cloneState(state: OfficeState): OfficeState {
  return structuredClone(state);
}

function findAgent(state: OfficeState, agentId: AgentId): OfficeAgent | undefined {
  for (const floor of state.floors) {
    const agent = floor.agents.find((entry) => entry.agentId === agentId);
    if (agent !== undefined) return agent;
  }
  return undefined;
}

function floorOfAgent(state: OfficeState, agentId: AgentId): number {
  return state.floors.find((floor) => floor.agents.some((a) => a.agentId === agentId))?.id ?? 2;
}

function agentWithRun(state: OfficeState, runId: string): OfficeAgent | undefined {
  for (const floor of state.floors) {
    const agent = floor.agents.find((entry) => entry.runId === runId);
    if (agent !== undefined) return agent;
  }
  return undefined;
}

// Applies one event to a draft state; returns the changed agent entries (delta payload).
function applyEvent(state: OfficeState, event: DomainEvent): OfficeAgent[] {
  switch (event.type) {
    case 'agent.status_changed': {
      const { agentId, status, runId } = event.payload;
      const agent = findAgent(state, agentId);
      if (agent === undefined) return [];
      agent.status = status;
      agent.pose = POSE_BY_STATUS[status];
      agent.activityLabel = status;
      if (runId !== undefined) agent.runId = runId;
      if (status === 'idle' || status === 'offline') delete agent.runId;
      return [{ ...agent }];
    }
    case 'run.started': {
      const agent = findAgent(state, event.payload.agentId);
      if (agent === undefined) return [];
      agent.status = 'working';
      agent.pose = 'sitting';
      agent.runId = event.payload.runId;
      agent.activityLabel = 'working';
      return [{ ...agent }];
    }
    case 'run.completed':
    case 'run.failed':
    case 'run.escalated': {
      const agent = agentWithRun(state, event.payload.runId);
      if (agent === undefined) return [];
      agent.status = 'idle';
      agent.pose = 'sitting';
      delete agent.runId;
      agent.activityLabel = event.type === 'run.completed' ? 'idle' : event.type.slice(4);
      return [{ ...agent }];
    }
    case 'worker.spawned': {
      const { workerId, runId, label } = event.payload;
      if (state.drones.some((drone) => drone.id === workerId)) return [];
      const owner = agentWithRun(state, runId);
      state.drones.push({
        id: workerId,
        parentRunId: runId,
        floorId: owner === undefined ? 2 : (floorOfAgent(state, owner.agentId) as FloorId),
        label,
      });
      return [];
    }
    case 'worker.despawned': {
      state.drones = state.drones.filter((drone) => drone.id !== event.payload.workerId);
      return [];
    }
    default:
      return [];
  }
}

const PROJECTED_TYPES = new Set([
  'agent.status_changed',
  'run.started',
  'run.completed',
  'run.failed',
  'run.escalated',
  'worker.spawned',
  'worker.despawned',
]);

// Single writer with a serialized queue: version stays monotonic even when the dispatcher
// delivers events concurrently. CAS on version guards against a second api instance.
export function createOfficeStateProjector(deps: ProjectorDeps): OfficeStateProjector {
  const now = deps.now ?? (() => new Date());
  let state: OfficeState | undefined;
  let queue: Promise<void> = Promise.resolve();

  async function loadState(): Promise<OfficeState> {
    if (state !== undefined) return state;
    const record = await deps.models.OfficeState.findById(OFFICE_STATE_ID).lean();
    if (record === null) {
      state = cloneState(INITIAL_OFFICE_STATE);
      return state;
    }
    const { _id, updatedAt, ...fields } = record;
    state = { ...fields, updatedAt: updatedAt.toISOString() } as OfficeState;
    return state;
  }

  async function process(event: DomainEvent): Promise<void> {
    const current = cloneState(await loadState());
    const changed = applyEvent(current, event);
    const hasDroneChange = event.type === 'worker.spawned' || event.type === 'worker.despawned';
    if (changed.length === 0 && !hasDroneChange) return;
    const nextVersion = current.version + 1;
    let updated;
    try {
      updated = await deps.models.OfficeState.findOneAndUpdate(
      { _id: OFFICE_STATE_ID, version: current.version },
      {
        $set: {
          version: nextVersion,
          floors: current.floors,
          drones: current.drones,
          updatedAt: now(),
        },
      },
      { upsert: true, new: true, lean: true },
      );
    } catch (err) {
      // First write when no doc exists: the upsert raced another creator; drop cache, retry.
      if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
        state = undefined;
        return process(event);
      }
      throw err;
    }
    if (updated === null) {
      // Lost a CAS race with another writer: drop the cache and retry once via the queue.
      state = undefined;
      return process(event);
    }
    current.version = nextVersion;
    state = current;
    await deps.onUpdated?.(nextVersion, changed);
  }

  return {
    handle(event) {
      if (!PROJECTED_TYPES.has(event.type)) return Promise.resolve();
      queue = queue.then(() => process(event));
      return queue;
    },
  };
}
