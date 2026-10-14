import type { AdapterEvent } from '@redhunter/shared';
import type { WorkPlan } from './schemas';

// Fixture adapter outputs for prometheus.plan tests.

export const VALID_PLAN: WorkPlan = {
  steps: [
    { id: 's1', title: 'Reproduce the login bug' },
    { id: 's2', title: 'Patch the JWT check', description: 'Compare expiry with <=' },
  ],
  acceptance: ['tests pass', 'login works with a fresh token'],
  risk: 'medium',
};

const VALID_JSON = JSON.stringify(VALID_PLAN);

export const PLAN_OUTPUTS = {
  valid: VALID_JSON,
  fenced: `Here is the plan:\n\`\`\`json\n${JSON.stringify(VALID_PLAN, null, 2)}\n\`\`\`\nDone.`,
  prose: `Sure, the plan is ${VALID_JSON} and that is all.`,
  // Balanced braces but a trailing comma: JSON.parse rejects it.
  malformed: '{"steps": [{"id": "s1", "title": "Fix",}], "acceptance": ["ok"], "risk": "low"}',
  unterminated: '{"steps": [{"id": "s1", "title": "Fix"}], "acceptance": ["ok"]',
  invalidRisk: JSON.stringify({ ...VALID_PLAN, risk: 'extreme' }),
  duplicateIds: JSON.stringify({
    ...VALID_PLAN,
    steps: [
      { id: 's1', title: 'A' },
      { id: 's1', title: 'B' },
    ],
  }),
  emptySteps: JSON.stringify({ ...VALID_PLAN, steps: [] }),
  emptyAcceptance: JSON.stringify({ ...VALID_PLAN, acceptance: [] }),
  empty: '',
} as const;

// Adapter script streaming `output` as two text chunks; finalText is deliberately not JSON.
export function textScript(output: string): AdapterEvent[] {
  const middle = Math.floor(output.length / 2);
  return [
    { type: 'started', vendorSessionId: 'ses-plan' },
    { type: 'text', text: output.slice(0, middle) },
    { type: 'usage', inputTokens: 10, outputTokens: 5 },
    { type: 'text', text: output.slice(middle) },
    { type: 'completed', finalText: 'Plan written.' },
  ];
}
