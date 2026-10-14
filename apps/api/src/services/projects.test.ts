import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { ProjectSchema } from '@redhunter/shared';
import { startWorkContext, type WorkContext } from '../test-support/work';
import { createProject, listProjects } from './projects';

const VALID_ROW = { name: 'ok', repoPath: '/srv/ok', defaultAdapter: 'opencode' } as const;
type RawRow = { _id: unknown } & Record<string, unknown>;
const CORRUPT_PROJECT_ROWS: [string, RawRow][] = [
  ['empty name', { _id: 'bad-name', ...VALID_ROW, name: '' }],
  ['missing name', { _id: 'no-name', repoPath: '/srv/ok', defaultAdapter: 'opencode' }],
  ['non-string name', { _id: 'num-name', ...VALID_ROW, name: 42 }],
  ['empty repoPath', { _id: 'bad-path', ...VALID_ROW, repoPath: '' }],
  ['missing repoPath', { _id: 'no-path', name: 'ok', defaultAdapter: 'opencode' }],
  ['non-string repoPath', { _id: 'num-path', ...VALID_ROW, repoPath: ['/srv'] }],
  ['unknown defaultAdapter', { _id: 'bad-adapter', ...VALID_ROW, defaultAdapter: 'cursor' }],
  ['missing defaultAdapter', { _id: 'no-adapter', name: 'ok', repoPath: '/srv/ok' }],
  ['non-string id', { _id: 12345, ...VALID_ROW }],
  ['empty id', { _id: '', ...VALID_ROW }],
];

let ctx: WorkContext;

beforeAll(async () => {
  ctx = await startWorkContext();
});

afterAll(async () => {
  await ctx.db.drop();
});

beforeEach(async () => {
  await Promise.all([ctx.db.models.Project.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
});

describe('createProject', () => {
  test('persists a uuid-keyed project with a storage-only createdAt and emits nothing', async () => {
    const before = Date.now();
    const project = await createProject(ctx.deps, {
      name: 'Hermes',
      repoPath: '/srv/hermes',
      defaultAdapter: 'claude',
    });
    expect(project).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Hermes',
      repoPath: '/srv/hermes',
      defaultAdapter: 'claude',
    });
    expect(() => ProjectSchema.strict().parse(project)).not.toThrow();
    const stored = await ctx.db.models.Project.findById(project.id).lean();
    expect(stored?.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });
});

describe('listProjects', () => {
  test('orders by createdAt, then _id for equal timestamps', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const base = { repoPath: '/srv/x', defaultAdapter: 'opencode' as const, createdAt };
    await ctx.db.models.Project.create([
      { ...base, _id: 'b-later-id', name: 'tie b' },
      { ...base, _id: 'a-earlier-id', name: 'tie a' },
      { ...base, _id: '0-newest', name: 'newest', createdAt: new Date('2026-02-01T00:00:00.000Z') },
      { ...base, _id: 'z-oldest', name: 'oldest', createdAt: new Date('2025-12-01T00:00:00.000Z') },
    ]);
    const names = (await listProjects(ctx.deps)).map((project) => project.name);
    expect(names).toEqual(['oldest', 'tie a', 'tie b', 'newest']);
  });

  // Exactly ONE invalid field per row, so a mapper that validates only part of the doc fails.
  test.each(CORRUPT_PROJECT_ROWS)(
    're-validates stored rows: corrupt %s throws instead of leaking',
    async (_label, row) => {
      const collection = ctx.db.connection.collection<RawRow>('projects');
      await collection.deleteMany({});
      await collection.insertOne({ ...row, createdAt: new Date() });
      await expect(listProjects(ctx.deps)).rejects.toThrow();
    },
  );

  test('control: the valid base row of the corrupt cases is accepted', async () => {
    await ctx.db.connection
      .collection<RawRow>('projects')
      .insertOne({ _id: 'valid', ...VALID_ROW, createdAt: new Date() });
    expect(await listProjects(ctx.deps)).toEqual([{ id: 'valid', ...VALID_ROW }]);
  });
});
