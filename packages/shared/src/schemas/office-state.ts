import { z } from 'zod';
import { AgentIdSchema, AgentStatusSchema, FloorIdSchema, PoseSchema } from '../enums';
import { IdSchema, IsoDateTimeSchema } from './common';

// Derived 3D projection (plan section 14). `offline` agents are hidden by the renderer.
export const OfficeAgentSchema = z.object({
  agentId: AgentIdSchema,
  deskId: z.string().min(1),
  pose: PoseSchema,
  status: AgentStatusSchema,
  activityLabel: z.string(),
  runId: IdSchema.optional(),
});
export type OfficeAgent = z.infer<typeof OfficeAgentSchema>;

export const DroneSchema = z.object({
  id: IdSchema,
  parentRunId: IdSchema,
  floorId: FloorIdSchema,
  label: z.string().min(1),
});
export type Drone = z.infer<typeof DroneSchema>;

export const OfficeStateVersionSchema = z.number().int().nonnegative();

export const OfficeStateSchema = z.object({
  version: OfficeStateVersionSchema,
  floors: z.array(z.object({ id: FloorIdSchema, agents: z.array(OfficeAgentSchema) })),
  drones: z.array(DroneSchema),
  updatedAt: IsoDateTimeSchema,
});
export type OfficeState = z.infer<typeof OfficeStateSchema>;
