import { z } from 'zod';

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export const RiskSchema = z.enum(RISK_LEVELS);
export type Risk = z.infer<typeof RiskSchema>;

export const PlanStepSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const WorkPlanSchema = z.object({
  steps: z
    .array(PlanStepSchema)
    .min(1)
    .refine((steps) => new Set(steps.map((step) => step.id)).size === steps.length, {
      message: 'step ids must be unique',
    }),
  acceptance: z.array(z.string().trim().min(1)).min(1),
  risk: RiskSchema,
});
export type WorkPlan = z.infer<typeof WorkPlanSchema>;

// Output of one executed step; the runtime builds it from an adapter `completed` event.
export interface StepResult {
  readonly stepId: string;
  readonly status: 'completed' | 'failed';
  readonly output: string;
  readonly evidence?: readonly string[];
  readonly artifacts?: readonly string[];
}
