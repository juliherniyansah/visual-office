import { z } from 'zod';
import { ActorKindSchema } from '../enums';

// Documents expose `id` as string (Mongo ObjectId hex or a stable slug such as an agent id).
export const IdSchema = z.string().min(1);

// Timestamps travel as ISO-8601 UTC strings; the api layer converts Mongo Dates.
export const IsoDateTimeSchema = z.iso.datetime();

export const TagSchema = z.string().min(1);

export const ActorSchema = z.object({
  kind: ActorKindSchema,
  id: IdSchema,
});
export type Actor = z.infer<typeof ActorSchema>;

export const TokenCountSchema = z.number().int().nonnegative();

export const UsageSchema = z.object({
  inputTokens: TokenCountSchema,
  outputTokens: TokenCountSchema,
  costUsd: z.number().nonnegative().optional(),
});
export type Usage = z.infer<typeof UsageSchema>;
