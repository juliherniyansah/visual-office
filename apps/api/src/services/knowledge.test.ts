import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { KnowledgeDocSchema } from '@redhunter/shared';
import { startWorkContext, type WorkContext } from '../test-support/work';
import { createKnowledgeDoc, listKnowledgeDocs } from './knowledge';

const VALID_ROW = { title: 'ok', text: 'x', tags: ['ops'] };
type RawRow = { _id: unknown } & Record<string, unknown>;
const CORRUPT_KNOWLEDGE_ROWS: [string, RawRow][] = [
  ['empty title', { _id: 'bad-title', ...VALID_ROW, title: '' }],
  ['missing title', { _id: 'no-title', text: 'x', tags: ['ops'] }],
  ['non-string title', { _id: 'num-title', ...VALID_ROW, title: 42 }],
  ['missing text', { _id: 'no-text', title: 'ok', tags: ['ops'] }],
  ['non-string text', { _id: 'num-text', ...VALID_ROW, text: 42 }],
  ['non-array tags', { _id: 'bad-tags', ...VALID_ROW, tags: 'nope' }],
  ['missing tags', { _id: 'no-tags', title: 'ok', text: 'x' }],
  ['empty tag element', { _id: 'empty-tag', ...VALID_ROW, tags: [''] }],
  ['non-string tag element', { _id: 'num-tag', ...VALID_ROW, tags: [7] }],
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
  await Promise.all([ctx.db.models.Knowledge.deleteMany({}), ctx.db.models.Event.deleteMany({})]);
});

describe('createKnowledgeDoc', () => {
  test('persists into knowledge_docs with uuid id and storage-only createdAt, emits nothing', async () => {
    const doc = await createKnowledgeDoc(ctx.deps, {
      title: 'Runbook',
      text: 'Restart the dispatcher.',
      tags: ['ops'],
    });
    expect(doc).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: 'Runbook',
      text: 'Restart the dispatcher.',
      tags: ['ops'],
    });
    expect(() => KnowledgeDocSchema.strict().parse(doc)).not.toThrow();
    const raw = await ctx.db.connection
      .collection('knowledge_docs')
      .findOne({ _id: doc.id as never });
    expect(raw?.createdAt).toBeInstanceOf(Date);
    expect(await ctx.db.models.Event.countDocuments()).toBe(0);
  });
});

describe('listKnowledgeDocs', () => {
  test('orders by createdAt, then _id for equal timestamps', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const base = { text: 'x', tags: [], createdAt };
    await ctx.db.models.Knowledge.create([
      { ...base, _id: 'b-id', title: 'tie b' },
      { ...base, _id: 'a-id', title: 'tie a' },
      { ...base, _id: '0-id', title: 'newest', createdAt: new Date('2026-02-01T00:00:00.000Z') },
      { ...base, _id: 'z-id', title: 'oldest', createdAt: new Date('2025-12-01T00:00:00.000Z') },
    ]);
    const titles = (await listKnowledgeDocs(ctx.deps)).map((doc) => doc.title);
    expect(titles).toEqual(['oldest', 'tie a', 'tie b', 'newest']);
  });

  // Exactly ONE invalid field per row, so a mapper that validates only part of the doc fails.
  test.each(CORRUPT_KNOWLEDGE_ROWS)(
    're-validates stored rows: corrupt %s throws instead of leaking',
    async (_label, row) => {
      const collection = ctx.db.connection.collection<RawRow>('knowledge_docs');
      await collection.deleteMany({});
      await collection.insertOne({ ...row, createdAt: new Date() });
      await expect(listKnowledgeDocs(ctx.deps)).rejects.toThrow();
    },
  );

  test('control: the valid base row of the corrupt cases is accepted', async () => {
    await ctx.db.connection
      .collection<RawRow>('knowledge_docs')
      .insertOne({ _id: 'valid', ...VALID_ROW, createdAt: new Date() });
    expect(await listKnowledgeDocs(ctx.deps)).toEqual([{ id: 'valid', ...VALID_ROW }]);
  });
});
