import { spyOn } from 'bun:test';
import { HUMAN_ROLES, type HumanRole, type TaskStatus } from '@redhunter/shared';
import type { Express } from 'express';
import { SignJWT, UnsecuredJWT } from 'jose';
import { Types } from 'mongoose';
import { createApp } from '../app';
import { JWT_AUDIENCE, JWT_ISSUER, signAccessToken } from '../auth/token';
import { createOutbox, type Outbox } from '../events/outbox';
import type { ServiceDeps } from '../services/deps';
import { createDirective } from '../services/directives';
import { assignTask, createTask, transitionTask } from '../services/tasks';
import { createTestDatabase, type TestDatabase } from './database';

export const WORK_TEST_SECRET = 'work-test-secret-0123456789abcdefghij';
export const SYSTEM_ACTOR = { kind: 'system', id: 'test' } as const;
export const TEST_PROJECT_ID = 'project-test';

export interface WorkContext {
  readonly db: TestDatabase;
  readonly outbox: Outbox;
  readonly deps: ServiceDeps;
  readonly app: Express;
  readonly tokens: Readonly<Record<HumanRole, string>>;
  readonly subjects: Readonly<Record<HumanRole, string>>;
}

// Real app + real outbox without a dispatcher: emitted events stay in `events` for assertions.
export async function startWorkContext(): Promise<WorkContext> {
  const db = await createTestDatabase();
  const outbox = createOutbox({ models: db.models });
  const app = createApp({ models: db.models, jwtSecret: WORK_TEST_SECRET, outbox });
  const subjects = Object.fromEntries(
    HUMAN_ROLES.map((role) => [role, new Types.ObjectId().toHexString()]),
  ) as Record<HumanRole, string>;
  const signed = await Promise.all(
    HUMAN_ROLES.map(async (role) => {
      const token = await signAccessToken({ sub: subjects[role], role }, WORK_TEST_SECRET);
      return [role, token] as const;
    }),
  );
  const tokens = Object.fromEntries(signed) as Record<HumanRole, string>;
  return { db, outbox, deps: { models: db.models, outbox }, app, tokens, subjects };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

export async function expiredToken(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000) - 3600;
  return new SignJWT({ role: 'owner' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(new Types.ObjectId().toHexString())
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60)
    .sign(new TextEncoder().encode(WORK_TEST_SECRET));
}

export function unsignedToken(): string {
  return new UnsecuredJWT({ role: 'owner' })
    .setSubject(new Types.ObjectId().toHexString())
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('1h')
    .encode();
}

export async function seedDirectiveId(deps: ServiceDeps): Promise<string> {
  const directive = await createDirective(deps, {
    text: 'Seed directive',
    priority: 'normal',
    capabilityTags: ['code'],
    issuedBy: SYSTEM_ACTOR,
  });
  return directive.id;
}

// Drives a fresh directive + task through the service layer up to `status`.
export async function seedTask(
  deps: ServiceDeps,
  status: Extract<TaskStatus, 'planned' | 'assigned' | 'in_progress' | 'paused' | 'done'>,
): Promise<string> {
  const task = await createTask(deps, {
    directiveId: await seedDirectiveId(deps),
    projectId: TEST_PROJECT_ID,
    acceptance: ['tests pass'],
    actor: SYSTEM_ACTOR,
  });
  if (status === 'planned') {
    return task.id;
  }
  await assignTask(deps, { taskId: task.id, agentId: 'programming', actor: SYSTEM_ACTOR });
  if (status === 'assigned') {
    return task.id;
  }
  await transitionTask(deps, { taskId: task.id, to: 'in_progress', actor: SYSTEM_ACTOR });
  if (status === 'paused' || status === 'done') {
    await transitionTask(deps, { taskId: task.id, to: status, actor: SYSTEM_ACTOR });
  }
  return task.id;
}

export async function storedEventTypes(db: TestDatabase, aggregateId: string): Promise<string[]> {
  const rows = await db.models.Event.find({ 'aggregate.id': aggregateId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return rows.map((row) => row.type);
}

type ConditionalWriter = Record<'findOneAndUpdate', (...args: unknown[]) => unknown>;

// Holds back the first conditional write so a concurrent caller reads the same (stale) status
// and writes first; makes "exactly one winner" races deterministic. Returns a restore function.
export function delayFirstWrite(model: object, delayMs = 200): () => void {
  const writer = model as ConditionalWriter;
  const original = writer.findOneAndUpdate.bind(model);
  const spy = spyOn(writer, 'findOneAndUpdate').mockImplementationOnce((...args) =>
    Bun.sleep(delayMs).then(() => original(...args)),
  );
  return () => spy.mockRestore();
}
