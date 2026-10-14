import { OFFICE_LAYOUT, type OfficeState, OfficeStateSchema } from '@redhunter/shared';
import { toOfficeState } from '../db/mappers';
import type { ServiceDeps } from './deps';

export const OFFICE_STATE_ID = 'singleton';

// Shared default returned to every caller, so nested objects must be immutable too.
function freezeDeep<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

// Before the projector (todo 15) writes anything: every agent idle and sitting at its desk.
export const INITIAL_OFFICE_STATE: OfficeState = freezeDeep(
  OfficeStateSchema.parse({
    version: 0,
    floors: OFFICE_LAYOUT.floors.map((floor) => ({
      id: floor.id,
      agents: floor.desks.map((desk) => ({
        agentId: desk.agentId,
        deskId: desk.deskId,
        pose: 'sitting',
        status: 'idle',
        activityLabel: '',
      })),
    })),
    drones: [],
    updatedAt: new Date(0).toISOString(),
  }),
);

export async function getOfficeState(deps: ServiceDeps): Promise<OfficeState> {
  const record = await deps.models.OfficeState.findById(OFFICE_STATE_ID).lean();
  return record === null ? INITIAL_OFFICE_STATE : toOfficeState(record);
}
