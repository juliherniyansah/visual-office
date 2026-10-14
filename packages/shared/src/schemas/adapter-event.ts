import { z } from 'zod';
import { TokenCountSchema } from './common';

// Normalized vendor adapter stream (plan section 8); persisted in `run_events.adapterEvent`.
export const TOOL_CALL_STATUSES = ['started', 'completed'] as const;

export const AdapterEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('started'), vendorSessionId: z.string().min(1) }),
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('tool'),
    name: z.string().min(1),
    input: z.unknown(),
    status: z.enum(TOOL_CALL_STATUSES),
    exitCode: z.number().int().optional(),
  }),
  z.object({ type: z.literal('file_change'), path: z.string().min(1), kind: z.string().min(1) }),
  z.object({
    type: z.literal('permission_request'),
    permissionId: z.string().min(1),
    tool: z.string().min(1),
    detail: z.string(),
  }),
  z.object({
    type: z.literal('usage'),
    inputTokens: TokenCountSchema,
    outputTokens: TokenCountSchema,
    costUsd: z.number().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('completed'),
    finalText: z.string(),
    structured: z.unknown().optional(),
  }),
  z.object({ type: z.literal('failed'), error: z.string() }),
]);
export type AdapterEvent = z.infer<typeof AdapterEventSchema>;
