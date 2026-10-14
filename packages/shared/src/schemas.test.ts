import { describe, expect, test } from 'bun:test';
import { AGENT_DEFINITIONS } from './agents';
import { COLLECTION_NAMES, COLLECTION_SCHEMAS, type CollectionName } from './collections';
import { PACKAGE_NAME } from './index';
import {
  AgentSchema,
  DirectiveSchema,
  PublicUserSchema,
  RunEventSchema,
  RunSchema,
  TaskSchema,
  UserSchema,
} from './schemas';

const NOW = '2026-10-08T12:00:00.000Z';
const RUN_ID = 'run-1';
const EVENT_ID = '0b8f1c1e-4a1f-4c3a-9d2e-5f6a7b8c9d0e';
const OMO_POLICY = {
  maxRetries: 2,
  maxTurns: 30,
  budgetTokens: 16000,
  allowedTools: ['edit', 'bash'],
  escalationChain: ['cto', 'human'],
};

const EVENT_RECORD = {
  eventId: EVENT_ID,
  type: 'agent.status_changed',
  aggregate: { kind: 'agent', id: 'programming' },
  payload: { agentId: 'programming', status: 'working', runId: RUN_ID },
  actor: { kind: 'system', id: 'agent-runtime' },
  createdAt: NOW,
  attempts: 0,
};

const USER = {
  id: 'u1',
  email: 'owner@redhunter.local',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
  role: 'owner',
};

const DIRECTIVE = {
  id: 'd1',
  issuedBy: { kind: 'human', id: 'u1' },
  text: 'Ship login',
  status: 'issued',
  priority: 'high',
  capabilityTags: ['code'],
};

const TASK = {
  id: 't1',
  directiveId: 'd1',
  projectId: 'p1',
  assigneeAgentId: 'programming',
  status: 'assigned',
  acceptance: ['login returns JWT'],
  capabilityTags: ['code'],
};

const RUN = {
  id: RUN_ID,
  taskId: 't1',
  agentId: 'programming',
  adapterId: 'opencode',
  status: 'executing',
  promptSnapshot: {
    text: 'You are the programming agent.',
    layers: [{ id: 'constitution', version: 1, tokens: 120 }],
    hash: 'sha256:abc',
  },
  vendorSessionId: 'ses_1',
  usage: { inputTokens: 100, outputTokens: 20, costUsd: 0.01 },
  startedAt: NOW,
};

const SAMPLES: Record<CollectionName, Record<string, unknown>> = {
  users: USER,
  agents: {
    id: 'programming',
    title: 'Programming',
    role: 'domain',
    reportsTo: ['coo', 'cto'],
    floor: 2,
    deskSlot: 'f2-programming',
    hermesProfileId: 'hp-programming',
    allowedAdapters: ['opencode', 'codex', 'claude'],
    capabilityTags: ['code'],
    status: 'idle',
    omoPolicy: OMO_POLICY,
  },
  hermes_profiles: {
    id: 'hp-programming',
    agentId: 'programming',
    name: 'Programming',
    role: 'domain engineer',
    personalityTraits: ['precise'],
    voiceGuidelines: 'Terse.',
    constitutionRef: 'constitution@1',
    version: 1,
  },
  hermes_memories: {
    id: 'm1',
    agentId: 'programming',
    runId: RUN_ID,
    kind: 'episodic',
    text: 'Fixed a flaky test.',
    importance: 0.7,
    createdAt: NOW,
  },
  hermes_skills: {
    id: 'skill-backend',
    name: 'Backend',
    markdown: '# Backend',
    appliesToRoles: ['domain'],
    tags: ['code'],
  },
  hermes_experience: {
    id: 'x1',
    agentId: 'programming',
    taskType: 'bugfix',
    outcome: 'pass',
    lessons: ['Write the failing test first.'],
    runId: RUN_ID,
  },
  knowledge_docs: { id: 'k1', title: 'README', text: 'Redhunter.', tags: ['docs'] },
  projects: { id: 'p1', name: 'redhunter', repoPath: '/srv/redhunter', defaultAdapter: 'opencode' },
  directives: DIRECTIVE,
  tasks: TASK,
  runs: RUN,
  run_events: {
    id: 're1',
    runId: RUN_ID,
    seq: 1,
    adapterEvent: {
      type: 'tool',
      name: 'bash',
      input: { command: 'bun test' },
      status: 'completed',
      exitCode: 0,
    },
  },
  results: {
    id: 'r1',
    runId: RUN_ID,
    summary: 'Login shipped.',
    artifacts: ['apps/api/src/auth.ts'],
    verdict: 'pass',
  },
  decisions: { id: 'dec1', runId: RUN_ID, question: 'Allow bash?', options: ['allow', 'deny'], createdAt: NOW },
  events: EVENT_RECORD,
  events_dead: { ...EVENT_RECORD, attempts: 5 },
  office_state: {
    version: 3,
    floors: [
      {
        id: 2,
        agents: [
          {
            agentId: 'programming',
            deskId: 'f2-programming',
            pose: 'sitting',
            status: 'working',
            activityLabel: 'Running tests',
            runId: RUN_ID,
          },
        ],
      },
    ],
    drones: [{ id: 'w1', parentRunId: RUN_ID, floorId: 2, label: 'explore' }],
    updatedAt: NOW,
  },
};

function without(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _removed, ...rest } = source;
  return rest;
}

describe('collection schemas', () => {
  test('one schema per collection from plan sections 10 and 11', () => {
    expect([...COLLECTION_NAMES]).toEqual([
      'users',
      'agents',
      'hermes_profiles',
      'hermes_memories',
      'hermes_skills',
      'hermes_experience',
      'knowledge_docs',
      'projects',
      'directives',
      'tasks',
      'runs',
      'run_events',
      'results',
      'decisions',
      'events',
      'events_dead',
      'office_state',
    ]);
  });

  for (const name of Object.keys(SAMPLES) as CollectionName[]) {
    test(`${name} sample round-trips`, () => {
      expect<unknown>(COLLECTION_SCHEMAS[name].parse(SAMPLES[name])).toEqual(SAMPLES[name]);
    });
  }

  test('directives and tasks require capabilityTags', () => {
    expect(DirectiveSchema.safeParse(without(DIRECTIVE, 'capabilityTags')).success).toBe(false);
    expect(TaskSchema.safeParse(without(TASK, 'capabilityTags')).success).toBe(false);
    expect(TaskSchema.safeParse({ ...TASK, capabilityTags: [42] }).success).toBe(false);
  });

  test('invalid statuses are rejected', () => {
    expect(DirectiveSchema.safeParse({ ...DIRECTIVE, status: 'dancing' }).success).toBe(false);
    expect(TaskSchema.safeParse({ ...TASK, status: 'dancing' }).success).toBe(false);
    expect(RunSchema.safeParse({ ...RUN, status: 'dancing' }).success).toBe(false);
    expect(AgentSchema.safeParse({ ...SAMPLES.agents, status: 'dancing' }).success).toBe(false);
    expect(UserSchema.safeParse({ ...USER, role: 'admin' }).success).toBe(false);
  });

  test('planned task may omit assigneeAgentId', () => {
    const planned = { ...without(TASK, 'assigneeAgentId'), status: 'planned' };
    expect<unknown>(TaskSchema.parse(planned)).toEqual(planned);
  });

  test('run_events reject unknown adapter event types', () => {
    const bad = { ...SAMPLES.run_events, adapterEvent: { type: 'teleport' } };
    expect(RunEventSchema.safeParse(bad).success).toBe(false);
  });

  test('PublicUserSchema strips passwordHash', () => {
    expect<unknown>(PublicUserSchema.parse(USER)).toEqual(without(USER, 'passwordHash'));
  });

  test('AGENT_DEFINITIONS fit AgentSchema once runtime fields are added', () => {
    for (const definition of AGENT_DEFINITIONS) {
      const agent = {
        ...definition,
        hermesProfileId: `hp-${definition.id}`,
        allowedAdapters: ['opencode'],
        status: 'idle',
        omoPolicy: OMO_POLICY,
      };
      expect(AgentSchema.safeParse(agent).success).toBe(true);
    }
  });

  test('index barrel keeps PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@redhunter/shared');
  });
});
