import type { AgentAdapter, AgentId, OmoPolicy } from '@redhunter/shared';
import { z } from 'zod';
import { errorMessage, NO_TERMINAL_EVENT } from '../attempt';
import type { RunTask } from '../ports';
import { RISK_LEVELS, type WorkPlan, WorkPlanSchema } from './schemas';

export type PlanErrorKind = 'adapter_failed' | 'no_completion' | 'invalid_output';

export class PlanError extends Error {
  override readonly name = 'PlanError';

  constructor(
    readonly kind: PlanErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface PlanContext {
  readonly adapter: AgentAdapter;
  readonly runId: string;
  readonly agentId: AgentId;
  readonly cwd: string;
  readonly policy?: OmoPolicy;
  readonly signal?: AbortSignal;
}

export type PlanParse =
  | { readonly ok: true; readonly plan: WorkPlan }
  | { readonly ok: false; readonly error: string };

const REPAIR_SUFFIX = '-repair';
const FENCED_BLOCK = /```[^\n]*\n([\s\S]*?)```/;
const RISK_UNION = RISK_LEVELS.map((risk) => `"${risk}"`).join(' | ');

// Task fields go in as one JSON line, so task text cannot forge a prompt section.
export function buildPlanPrompt(task: RunTask): string {
  const input = {
    task: task.text,
    taskType: task.taskType,
    capabilityTags: task.capabilityTags,
    acceptance: task.acceptance,
  };
  return [
    '# Planning request',
    'You are the planner. Break the task into ordered steps. Do not edit files or run tools.',
    '',
    '## Input',
    JSON.stringify(input),
    '',
    '## Output contract',
    'Return ONLY one JSON object, no prose, shaped as:',
    `{"steps": [{"id": string, "title": string, "description"?: string}], "acceptance": string[], "risk": ${RISK_UNION}}`,
    'steps and acceptance must be non-empty; step ids must be unique.',
  ].join('\n');
}

export function buildRepairPrompt(prompt: string, error: string): string {
  return `${prompt}\n\n## Repair\nYour previous output was rejected: ${error}\nReturn ONLY the corrected JSON object.`;
}

// First balanced {...}, skipping braces inside JSON strings.
function firstObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return undefined;
}

// A fenced block wins over braces in the surrounding prose.
export function parseWorkPlan(output: string): PlanParse {
  const candidate = firstObject(FENCED_BLOCK.exec(output)?.[1] ?? output);
  if (candidate === undefined) return { ok: false, error: 'No JSON object found in output' };
  let json: unknown;
  try {
    json = JSON.parse(candidate);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${errorMessage(error)}` };
  }
  const parsed = WorkPlanSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: `Invalid WorkPlan: ${z.prettifyError(parsed.error)}` };
  }
  return { ok: true, plan: parsed.data };
}

async function consumeText(ctx: PlanContext, runId: string, prompt: string): Promise<string> {
  const { adapter, agentId, cwd, policy, signal } = ctx;
  const chunks: string[] = [];
  for await (const event of adapter.start({ runId, agentId, cwd, prompt, policy, signal })) {
    if (event.type === 'text') chunks.push(event.text);
    if (event.type === 'completed') return chunks.join('');
    if (event.type === 'failed') throw new PlanError('adapter_failed', event.error);
    // Planning is read-only: every tool permission is denied (the adapter then fails the run).
    if (event.type === 'permission_request') {
      await adapter.answerPermission(runId, event.permissionId, 'deny');
    }
  }
  throw new PlanError('no_completion', NO_TERMINAL_EVENT);
}

// Text events until `completed`; finalText is not plan output.
async function collectText(ctx: PlanContext, runId: string, prompt: string): Promise<string> {
  try {
    return await consumeText(ctx, runId, prompt);
  } catch (error) {
    if (error instanceof PlanError) throw error;
    throw new PlanError('adapter_failed', errorMessage(error));
  }
}

// One adapter run; a parse/schema failure gets exactly one repair run, adapter failures none.
async function plan(task: RunTask, ctx: PlanContext): Promise<WorkPlan> {
  const prompt = buildPlanPrompt(task);
  const first = parseWorkPlan(await collectText(ctx, ctx.runId, prompt));
  if (first.ok) return first.plan;
  const repairPrompt = buildRepairPrompt(prompt, first.error);
  const second = parseWorkPlan(await collectText(ctx, ctx.runId + REPAIR_SUFFIX, repairPrompt));
  if (second.ok) return second.plan;
  throw new PlanError('invalid_output', `Plan output invalid after one repair: ${second.error}`);
}

export const prometheus = { plan } as const;
