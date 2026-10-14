import type { Socket } from 'socket.io';
import type { ServiceDeps } from '../services/deps';
import { getOfficeState } from '../services/officeState';

export interface ResyncHandler {
  handle(socket: Socket): Promise<void>;
}

export function createResyncHandler(deps: ServiceDeps): ResyncHandler {
  async function handle(socket: Socket): Promise<void> {
    try {
      const officeState = await getOfficeState(deps);
      const runs = await deps.models.Run.find({}).sort({ createdAt: -1 }).limit(100).lean();
      const agents = await deps.models.Agent.find({}).lean();

      socket.emit('office_state', officeState);
      socket.emit('runs_snapshot', runs.map((r) => ({ ...r, id: r._id })));
      socket.emit('agents_snapshot', agents.map((a) => ({ ...a, id: a._id })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Resync failed for socket ${socket.id}: ${message}`);
      socket.emit('error', { message: 'Resync failed' });
    }
  }

  return { handle };
}
