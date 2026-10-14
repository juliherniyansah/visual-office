import { type CollectionName, type KnowledgeDoc, KnowledgeDocSchema } from '@redhunter/shared';
import type { Connection } from 'mongoose';

const KNOWLEDGE_COLLECTION: CollectionName = 'knowledge_docs';
// Standard Okapi BM25 parameters.
const BM25_K1 = 1.2;
const BM25_B = 0.75;

export interface KnowledgeFilter {
  // Empty or absent = no filter; otherwise the doc must share at least one tag.
  readonly tags?: readonly string[];
}

export interface KnowledgeHit {
  readonly doc: KnowledgeDoc;
  readonly score: number;
}

// OPEN DECISION 1: vector store pending; any impl (LanceDB, sqlite-vec, Atlas) plugs in here.
export interface KnowledgeStore {
  upsert(doc: KnowledgeDoc): Promise<void>;
  search(query: string, k: number, filter?: KnowledgeFilter): Promise<KnowledgeHit[]>;
}

interface IndexedDoc {
  readonly doc: KnowledgeDoc;
  readonly termCounts: ReadonlyMap<string, number>;
  readonly length: number;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function cloneDoc(doc: KnowledgeDoc): KnowledgeDoc {
  return { ...doc, tags: [...doc.tags] };
}

function indexDoc(doc: KnowledgeDoc): IndexedDoc {
  const terms = tokenize(`${doc.title} ${doc.text} ${doc.tags.join(' ')}`);
  const termCounts = new Map<string, number>();
  for (const term of terms) termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  return { doc: cloneDoc(doc), termCounts, length: terms.length };
}

function matchesFilter(doc: KnowledgeDoc, filter: KnowledgeFilter | undefined): boolean {
  const tags = filter?.tags ?? [];
  return tags.length === 0 || doc.tags.some((tag) => tags.includes(tag));
}

// ponytail: full scan per query, fine for hundreds of docs; inverted index when the corpus grows.
export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly docs = new Map<string, IndexedDoc>();

  get size(): number {
    return this.docs.size;
  }

  async upsert(doc: KnowledgeDoc): Promise<void> {
    this.docs.set(doc.id, indexDoc(KnowledgeDocSchema.parse(doc)));
  }

  async search(query: string, k: number, filter?: KnowledgeFilter): Promise<KnowledgeHit[]> {
    const queryTerms = [...new Set(tokenize(query))];
    if (k <= 0 || queryTerms.length === 0 || this.docs.size === 0) return [];
    const all = [...this.docs.values()];
    const averageLength = all.reduce((sum, entry) => sum + entry.length, 0) / all.length || 1;
    const idf = new Map(queryTerms.map((term) => [term, this.inverseDocFrequency(term)]));
    const hits: KnowledgeHit[] = [];
    for (const entry of all) {
      if (!matchesFilter(entry.doc, filter)) continue;
      const score = scoreDoc(entry, queryTerms, idf, averageLength);
      if (score > 0) hits.push({ doc: entry.doc, score });
    }
    hits.sort((a, b) => b.score - a.score || compareIds(a.doc.id, b.doc.id));
    return hits.slice(0, k).map((hit) => ({ doc: cloneDoc(hit.doc), score: hit.score }));
  }

  private inverseDocFrequency(term: string): number {
    let containing = 0;
    for (const entry of this.docs.values()) if (entry.termCounts.has(term)) containing += 1;
    // BM25+ style idf (log(1 + ...)) stays positive even when a term is in every doc.
    return Math.log(1 + (this.docs.size - containing + 0.5) / (containing + 0.5));
  }
}

function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function scoreDoc(
  entry: IndexedDoc,
  queryTerms: readonly string[],
  idf: ReadonlyMap<string, number>,
  averageLength: number,
): number {
  let score = 0;
  for (const term of queryTerms) {
    const frequency = entry.termCounts.get(term) ?? 0;
    if (frequency === 0) continue;
    const norm = BM25_K1 * (1 - BM25_B + (BM25_B * entry.length) / averageLength);
    score += (idf.get(term) ?? 0) * ((frequency * (BM25_K1 + 1)) / (frequency + norm));
  }
  return score;
}

// Boot-time load of `knowledge_docs`. All rows are validated before any is indexed, so a
// corrupt row leaves the store untouched instead of half-hydrated.
export async function hydrateKnowledgeStore(
  store: KnowledgeStore,
  connection: Connection,
): Promise<number> {
  type Row = { _id: unknown } & Record<string, unknown>;
  const rows = await connection
    .collection<Row>(KNOWLEDGE_COLLECTION)
    .find({})
    .sort({ _id: 1 })
    .toArray();
  const docs = rows.map(({ _id, ...fields }) => KnowledgeDocSchema.parse({ ...fields, id: _id }));
  for (const doc of docs) await store.upsert(doc);
  return docs.length;
}
