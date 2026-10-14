import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { KnowledgeDoc } from '@redhunter/shared';
import {
  hydrateKnowledgeStore,
  InMemoryKnowledgeStore,
  type KnowledgeHit,
  type KnowledgeStore,
  tokenize,
} from './knowledge';
import { createTestDatabase, type TestDatabase } from './test-support/database';

const ASYNC_UPSERT_DELAY_MS = 20;

const DOCS: readonly KnowledgeDoc[] = [
  {
    id: 'deploy',
    title: 'Deploy runbook',
    text: 'Restart the dispatcher after deploy.',
    tags: ['ops'],
  },
  { id: 'mongo', title: 'Mongo guide', text: 'Mongo indexes and mongo backups.', tags: ['db'] },
  { id: 'unity', title: 'Game engine', text: 'Unity scenes and shaders.', tags: ['game'] },
];

async function storeWith(docs: readonly KnowledgeDoc[]): Promise<InMemoryKnowledgeStore> {
  const store = new InMemoryKnowledgeStore();
  for (const doc of docs) await store.upsert(doc);
  return store;
}

async function searchIds(
  store: InMemoryKnowledgeStore,
  query: string,
  k: number,
  tags?: string[],
): Promise<string[]> {
  const hits = await store.search(query, k, tags === undefined ? undefined : { tags });
  return hits.map((hit) => hit.doc.id);
}

describe('tokenize', () => {
  test('lowercases, splits on non letters/digits, keeps unicode letters', () => {
    expect(tokenize('Deploy-the API_v2, Café!')).toEqual(['deploy', 'the', 'api', 'v2', 'café']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('InMemoryKnowledgeStore.search', () => {
  test('returns only matching docs with a positive score', async () => {
    const hits = await (await storeWith(DOCS)).search('mongo backups', 3);
    expect(hits.map((hit) => hit.doc.id)).toEqual(['mongo']);
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  // Equal lengths: without idf, tf=2 of `common` would beat tf=1 of `rare`.
  test('rare term outweighs a more frequent common term (idf)', async () => {
    const store = await storeWith([
      { id: 'b', title: 't', text: 'common common filler', tags: [] },
      { id: 'a', title: 't', text: 'rare filler filler', tags: [] },
      { id: 'c', title: 't', text: 'common other other', tags: [] },
    ]);
    expect(await searchIds(store, 'rare common', 3)).toEqual(['a', 'b', 'c']);
  });

  test('higher term frequency ranks higher at equal length', async () => {
    const store = await storeWith([
      { id: 'a', title: 't', text: 'cache miss miss', tags: [] },
      { id: 'b', title: 't', text: 'cache cache cache', tags: [] },
      { id: 'c', title: 't', text: 'other words here', tags: [] },
    ]);
    expect(await searchIds(store, 'cache', 3)).toEqual(['b', 'a']);
  });

  test('shorter doc wins at equal term frequency (length normalization)', async () => {
    const store = await storeWith([
      { id: 'a', title: 't', text: 'queue plus many many extra filler words', tags: [] },
      { id: 'b', title: 't', text: 'queue', tags: [] },
      { id: 'c', title: 't', text: 'other', tags: [] },
    ]);
    expect(await searchIds(store, 'queue', 3)).toEqual(['b', 'a']);
  });

  test('title and tags are searchable', async () => {
    const store = await storeWith(DOCS);
    expect(await searchIds(store, 'runbook', 3)).toEqual(['deploy']);
    expect(await searchIds(store, 'ops', 3)).toEqual(['deploy']);
  });

  test('equal scores tie-break by id ascending regardless of insert order', async () => {
    const twins = (['z', 'a', 'm'] as const).map((id) => ({
      id,
      title: 'same',
      text: 'identical body',
      tags: [],
    }));
    expect(await searchIds(await storeWith(twins), 'identical', 3)).toEqual(['a', 'm', 'z']);
    expect(await searchIds(await storeWith([...twins].reverse()), 'identical', 2)).toEqual([
      'a',
      'm',
    ]);
  });

  test('k caps the result count', async () => {
    const store = await storeWith(DOCS);
    expect(await searchIds(store, 'mongo deploy unity', 2)).toHaveLength(2);
    expect(await searchIds(store, 'mongo deploy unity', 3)).toHaveLength(3);
  });

  test('k=0, negative k, empty query and no matches return []', async () => {
    const store = await storeWith(DOCS);
    expect(await store.search('mongo', 0)).toEqual([]);
    expect(await store.search('mongo', -1)).toEqual([]);
    expect(await store.search('', 3)).toEqual([]);
    expect(await store.search('kubernetes', 3)).toEqual([]);
  });

  // 'mongo deploy' hits 2 docs, so slice(0, -1) would wrongly return 1 hit without the guard.
  test('k=0 and k=-1 return [] even when >=2 docs match', async () => {
    const store = await storeWith(DOCS);
    expect(await searchIds(store, 'mongo deploy', 3)).toHaveLength(2);
    expect(await store.search('mongo deploy', 0)).toEqual([]);
    expect(await store.search('mongo deploy', -1)).toEqual([]);
  });

  test('exact Okapi BM25 scores (k1 1.2, b 0.75, idf ln(1 + (N-n+0.5)/(n+0.5)))', async () => {
    const store = await storeWith([
      { id: 'a', title: 't', text: 'apple banana', tags: [] },
      { id: 'b', title: 't', text: 'apple apple cherry date', tags: [] },
      { id: 'c', title: 't', text: 'cherry', tags: [] },
    ]);
    // Indexed tokens include the title 't': lengths a=3, b=5, c=2, avgdl = 10/3.
    // 'apple' in n=2 of N=3 docs: idf = ln(1 + (3 - 2 + 0.5) / (2 + 0.5)) = ln(1.6).
    // b: f=2, norm = 1.2 * (0.25 + 0.75 * 5 / (10/3)) = 1.65 -> ln(1.6) * (2 * 2.2) / (2 + 1.65)
    // a: f=1, norm = 1.2 * (0.25 + 0.75 * 3 / (10/3)) = 1.11 -> ln(1.6) * (1 * 2.2) / (1 + 1.11)
    const hits = await store.search('apple', 3);
    expect(hits.map((hit) => hit.doc.id)).toEqual(['b', 'a']);
    expect(hits[0]?.score).toBeCloseTo((Math.log(1.6) * 4.4) / 3.65, 10);
    expect(hits[1]?.score).toBeCloseTo((Math.log(1.6) * 2.2) / 2.11, 10);
  });

  // Same corpus as above: lengths a=3, b=5, c=2 (title 't' indexed), avgdl = 10/3, N = 3.
  // 'apple' and 'cherry' each occur in n=2 docs -> idf = ln(1.6) for both.
  // A doc's score is the SUM over matched query terms of idf * f*(k1+1) / (f + norm(len)).
  test('multi-term query sums per-term BM25 parts (exact scores and rank)', async () => {
    const store = await storeWith([
      { id: 'a', title: 't', text: 'apple banana', tags: [] },
      { id: 'b', title: 't', text: 'apple apple cherry date', tags: [] },
      { id: 'c', title: 't', text: 'cherry', tags: [] },
    ]);
    const k1 = 1.2;
    const b = 0.75;
    const averageLength = 10 / 3;
    const idf = Math.log(1 + (3 - 2 + 0.5) / (2 + 0.5));
    const part = (frequency: number, length: number): number =>
      (idf * (frequency * (k1 + 1))) / (frequency + k1 * (1 - b + (b * length) / averageLength));
    const expected = {
      b: part(2, 5) + part(1, 5),
      c: part(1, 2),
      a: part(1, 3),
    };
    const hits = await store.search('apple cherry', 3);
    // Only summation puts b first: b's cherry part alone (part(1, 5)) is below both c and a.
    expect(part(1, 5)).toBeLessThan(expected.a);
    expect(hits.map((hit) => hit.doc.id)).toEqual(['b', 'c', 'a']);
    expect(hits[0]?.score).toBeCloseTo(expected.b, 10);
    expect(hits[1]?.score).toBeCloseTo(expected.c, 10);
    expect(hits[2]?.score).toBeCloseTo(expected.a, 10);
  });

  test('filter by tags keeps only docs sharing a tag; empty tag filter = no filter', async () => {
    const store = await storeWith([
      ...DOCS,
      { id: 'mongo-ops', title: 'Mongo ops', text: 'mongo restart', tags: ['ops'] },
    ]);
    expect(await searchIds(store, 'mongo', 5, ['ops'])).toEqual(['mongo-ops']);
    expect((await searchIds(store, 'mongo', 5, [])).sort()).toEqual(['mongo', 'mongo-ops']);
  });

  test('upsert replaces a doc by id (old terms no longer match), size counts unique ids', async () => {
    const store = await storeWith(DOCS);
    await store.upsert({ id: 'mongo', title: 'Renamed', text: 'postgres now', tags: [] });
    expect(store.size).toBe(3);
    expect(await store.search('backups', 3)).toEqual([]);
    expect(await searchIds(store, 'postgres', 3)).toEqual(['mongo']);
  });

  test('upsert validates input and stores a copy (caller mutation does not leak)', async () => {
    const store = new InMemoryKnowledgeStore();
    await expect(store.upsert({ id: '', title: 't', text: 'x', tags: [] })).rejects.toThrow();
    expect(store.size).toBe(0);
    const doc = { id: 'd', title: 'Title', text: 'alpha', tags: ['t'] };
    await store.upsert(doc);
    doc.text = 'beta';
    doc.tags.push('u');
    const [hit] = await store.search('alpha', 1);
    expect(hit?.doc).toEqual({ id: 'd', title: 'Title', text: 'alpha', tags: ['t'] });
    hit?.doc.tags.push('leak');
    expect((await store.search('alpha', 1))[0]?.doc.tags).toEqual(['t']);
  });
});

describe('hydrateKnowledgeStore', () => {
  type RawRow = { _id: unknown } & Record<string, unknown>;
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.drop();
  });

  beforeEach(async () => {
    await db.connection.collection('knowledge_docs').deleteMany({});
  });

  test('loads every knowledge_docs row, strips createdAt, searchable afterwards', async () => {
    await db.connection
      .collection<RawRow>('knowledge_docs')
      .insertMany(DOCS.map(({ id, ...fields }) => ({ _id: id, ...fields, createdAt: new Date() })));
    const store = new InMemoryKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(3);
    expect(store.size).toBe(3);
    expect((await store.search('restart dispatcher', 1))[0]?.doc).toEqual(DOCS[0]);
  });

  test('empty collection hydrates 0 docs', async () => {
    const store = new InMemoryKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(0);
    expect(store.size).toBe(0);
  });

  const VALID = { title: 'ok', text: 'x', tags: ['ops'] };
  const CORRUPT: [string, RawRow][] = [
    ['empty title', { _id: 'k', ...VALID, title: '' }],
    ['missing title', { _id: 'k', text: 'x', tags: ['ops'] }],
    ['missing text', { _id: 'k', title: 'ok', tags: ['ops'] }],
    ['missing tags', { _id: 'k', title: 'ok', text: 'x' }],
    ['non-string text', { _id: 'k', ...VALID, text: 1 }],
    ['non-array tags', { _id: 'k', ...VALID, tags: 'ops' }],
    ['empty tag element', { _id: 'k', ...VALID, tags: [''] }],
    ['non-string id', { _id: 7, ...VALID }],
  ];

  // A corrupt row aborts hydration before ANY doc is loaded (valid row inserted first).
  test.each(CORRUPT)('corrupt %s row rejects hydration, store stays empty', async (_l, row) => {
    const collection = db.connection.collection<RawRow>('knowledge_docs');
    await collection.insertMany([{ _id: '0-good', ...VALID }, row]);
    const store = new InMemoryKnowledgeStore();
    await expect(hydrateKnowledgeStore(store, db.connection)).rejects.toThrow();
    expect(store.size).toBe(0);
  });

  test('rows with empty tags are hydrated and searchable too', async () => {
    await db.connection.collection<RawRow>('knowledge_docs').insertMany([
      { _id: 'x', title: 'Empty tags', text: 'alpha', tags: [] },
      { _id: 'y', title: 'Tagged', text: 'beta', tags: ['t'] },
    ]);
    const store = new InMemoryKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(2);
    expect(store.size).toBe(2);
    expect((await store.search('alpha', 1))[0]?.doc).toEqual({
      id: 'x',
      title: 'Empty tags',
      text: 'alpha',
      tags: [],
    });
    expect(await searchIds(store, 'beta', 1)).toEqual(['y']);
  });

  test('a stray id field in a knowledge_docs row never overrides the row _id', async () => {
    await db.connection
      .collection<RawRow>('knowledge_docs')
      .insertOne({ _id: 'doc-real', id: 'doc-forged', ...VALID });
    const store = new InMemoryKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(1);
    expect(await searchIds(store, 'ops', 5)).toEqual(['doc-real']);
  });

  test('control: valid base row hydrates', async () => {
    await db.connection.collection<RawRow>('knowledge_docs').insertOne({ _id: 'k', ...VALID });
    const store = new InMemoryKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(1);
    expect((await store.search('ops', 1))[0]?.doc).toEqual({ id: 'k', ...VALID });
  });

  // Store yang benar-benar async (seperti vector store nanti): fake in-memory sinkron menyembunyikan
  // await yang hilang.
  class SlowKnowledgeStore implements KnowledgeStore {
    readonly seen: string[] = [];

    constructor(private readonly failure?: Error) {}

    async upsert(doc: KnowledgeDoc): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, ASYNC_UPSERT_DELAY_MS));
      if (this.failure !== undefined) throw this.failure;
      this.seen.push(doc.id);
    }

    async search(): Promise<KnowledgeHit[]> {
      return [];
    }
  }

  test('awaits each async upsert before resolving, in _id order', async () => {
    await db.connection
      .collection<RawRow>('knowledge_docs')
      .insertMany(['d3', 'd1', 'd2'].map((id) => ({ _id: id, ...VALID })));
    const store = new SlowKnowledgeStore();
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(3);
    expect(store.seen).toEqual(['d1', 'd2', 'd3']);
  });

  test('propagates upsert rejection', async () => {
    await db.connection.collection<RawRow>('knowledge_docs').insertOne({ _id: 'd1', ...VALID });
    const failure = new Error('vector store down');
    await expect(
      hydrateKnowledgeStore(new SlowKnowledgeStore(failure), db.connection),
    ).rejects.toBe(failure);
  });

  // Delay per doc: the FIRST doc is slowest, so concurrent upserts would finish out of order.
  class StaggeredKnowledgeStore implements KnowledgeStore {
    readonly started: string[] = [];
    readonly finished: string[] = [];
    maxInFlight = 0;
    private inFlight = 0;

    constructor(
      private readonly delays: Readonly<Record<string, number>>,
      private readonly failOn?: { readonly id: string; readonly error: Error },
    ) {}

    async upsert(doc: KnowledgeDoc): Promise<void> {
      this.started.push(doc.id);
      this.inFlight += 1;
      this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, this.delays[doc.id] ?? 0));
        if (this.failOn?.id === doc.id) throw this.failOn.error;
        this.finished.push(doc.id);
      } finally {
        this.inFlight -= 1;
      }
    }

    async search(): Promise<KnowledgeHit[]> {
      return [];
    }
  }

  const STAGGERED_DELAYS = { a: 40, b: 20, c: 1 } as const;

  async function insertStaggeredDocs(): Promise<void> {
    await db.connection
      .collection<RawRow>('knowledge_docs')
      .insertMany(['c', 'a', 'b'].map((id) => ({ _id: id, ...VALID })));
  }

  test('upserts run one at a time in _id order even when later docs are faster', async () => {
    await insertStaggeredDocs();
    const store = new StaggeredKnowledgeStore(STAGGERED_DELAYS);
    expect(await hydrateKnowledgeStore(store, db.connection)).toBe(3);
    expect(store.finished).toEqual(['a', 'b', 'c']);
    expect(store.maxInFlight).toBe(1);
  });

  test('stops at the first failed upsert: no later doc is upserted', async () => {
    await insertStaggeredDocs();
    const error = new Error('vector store down');
    const store = new StaggeredKnowledgeStore(STAGGERED_DELAYS, { id: 'b', error });
    await expect(hydrateKnowledgeStore(store, db.connection)).rejects.toBe(error);
    // Give a (wrongly) still-running loop time to start further upserts before asserting.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(store.started).toEqual(['a', 'b']);
    expect(store.finished).toEqual(['a']);
  });
});

describe('InMemoryKnowledgeStore query terms and tag filter', () => {
  test('tag filter keeps docs sharing at least ONE tag with a multi-tag filter', async () => {
    const store = await storeWith([
      { id: 'ab', title: 'x', text: 'mongo', tags: ['a', 'b'] },
      { id: 'ops-db', title: 'x', text: 'mongo', tags: ['ops', 'db'] },
      { id: 'none', title: 'x', text: 'mongo', tags: [] },
    ]);
    expect(await searchIds(store, 'mongo', 5, ['b', 'c'])).toEqual(['ab']);
    expect(await searchIds(store, 'mongo', 5, ['ops'])).toEqual(['ops-db']);
  });

  // Without dedupe, 'beta' x3 would triple b's score and flip the order.
  test('repeated query terms count once: same hits and scores, order unchanged', async () => {
    const store = await storeWith([
      { id: 'a', title: 'x', text: 'alpha alpha alpha y', tags: [] },
      { id: 'b', title: 'x', text: 'beta y', tags: [] },
      { id: 'c', title: 'x', text: 'z', tags: [] },
    ]);
    const plain = await store.search('alpha beta', 3);
    expect(plain.map((hit) => hit.doc.id)).toEqual(['a', 'b']);
    expect(await store.search('alpha beta beta beta', 3)).toEqual(plain);
    expect(await store.search('alpha alpha', 3)).toEqual(await store.search('alpha', 3));
  });
});

describe('InMemoryKnowledgeStore tie order', () => {
  // Code-unit order puts 'B' (0x42) before 'b' (0x62); locale collation would put 'b' first.
  test('equal scores tie-break by code-unit id order, not locale order', async () => {
    const store = await storeWith(
      (['b', 'B'] as const).map((id) => ({ id, title: 'same', text: 'twin body', tags: [] })),
    );
    expect(await searchIds(store, 'twin', 2)).toEqual(['B', 'b']);
  });
});
