import { z } from 'zod';
import { deepFreeze } from './deep-freeze';
import { type AgentId, AgentIdSchema, type FloorId, FloorIdSchema } from './enums';

export const DeskSchema = z
  .object({
    deskId: z.string().min(1),
    agentId: AgentIdSchema,
  })
  .readonly();
export type Desk = z.infer<typeof DeskSchema>;

export const FloorLayoutSchema = z
  .object({
    id: FloorIdSchema,
    name: z.string().min(1),
    desks: z.array(DeskSchema).readonly(),
  })
  .readonly();
export type FloorLayout = z.infer<typeof FloorLayoutSchema>;

export const OfficeLayoutSchema = z
  .object({
    floors: z.array(FloorLayoutSchema).readonly(),
  })
  .readonly();
export type OfficeLayout = z.infer<typeof OfficeLayoutSchema>;

// Option A "Hierarchy stack" (plan section 15, LOCKED). Static desk map; F1 hosts no agents.
export const OFFICE_LAYOUT: OfficeLayout = deepFreeze<OfficeLayout>({
  floors: [
    { id: 1, name: 'Lobby & Server Room', desks: [] },
    {
      id: 2,
      name: 'Domain Floor',
      desks: [
        { deskId: 'f2-programming', agentId: 'programming' },
        { deskId: 'f2-game', agentId: 'game' },
        { deskId: 'f2-iot', agentId: 'iot' },
        { deskId: 'f2-ai-development', agentId: 'ai_development' },
      ],
    },
    {
      id: 3,
      name: 'Operations',
      desks: [
        { deskId: 'f3-coo', agentId: 'coo' },
        { deskId: 'f3-cto', agentId: 'cto' },
      ],
    },
    { id: 4, name: 'CEO Office', desks: [{ deskId: 'f4-ceo', agentId: 'ceo' }] },
  ],
});

export interface AgentPlacement {
  readonly floorId: FloorId;
  readonly deskId: string;
}

export function findAgentDesk(agentId: AgentId): AgentPlacement {
  for (const floor of OFFICE_LAYOUT.floors) {
    const desk = floor.desks.find((entry) => entry.agentId === agentId);
    if (desk) {
      return { floorId: floor.id, deskId: desk.deskId };
    }
  }
  throw new Error(`No desk assigned for agent ${agentId}`);
}
