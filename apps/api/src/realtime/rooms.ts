import type { DomainEvent } from '@redhunter/shared';

export const OFFICE_ROOM = 'office';
const AGENT_ROOM_PREFIX = 'agent:';
const RUN_ROOM_PREFIX = 'run:';

export function agentRoom(agentId: string): string {
  return `${AGENT_ROOM_PREFIX}${agentId}`;
}

export function runRoom(runId: string): string {
  return `${RUN_ROOM_PREFIX}${runId}`;
}

export function isAgentRoom(room: string): boolean {
  return room.startsWith(AGENT_ROOM_PREFIX);
}

function agentIdOf(event: DomainEvent): string | undefined {
  switch (event.type) {
    case 'agent.status_changed':
    case 'run.started':
      return event.payload.agentId;
    case 'task.assigned':
      return event.payload.assigneeAgentId;
    case 'task.created':
      return event.payload.task.assigneeAgentId;
    default:
      return undefined;
  }
}

function runIdOf(event: DomainEvent): string | undefined {
  switch (event.type) {
    case 'result.recorded':
      return event.payload.result.runId;
    case 'decision.requested':
      return event.payload.decision.runId;
    default:
      return 'runId' in event.payload ? event.payload.runId : undefined;
  }
}

// Every event fans out to `office`; agent/run scoped rooms are added when the payload names them.
export function roomsForEvent(event: DomainEvent): string[] {
  const rooms = [OFFICE_ROOM];
  const agentId = agentIdOf(event);
  const runId = runIdOf(event);
  if (agentId !== undefined) {
    rooms.push(agentRoom(agentId));
  }
  if (runId !== undefined) {
    rooms.push(runRoom(runId));
  }
  return rooms;
}
