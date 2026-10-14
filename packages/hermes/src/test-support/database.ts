import { randomUUID } from 'node:crypto';
import mongoose, { type Connection } from 'mongoose';
import { createHermesModels, type HermesModels } from '../models';

// Mirrors apps/api/src/test-support/database.ts (cannot import across apps/packages).
// Base URL only; every run gets its own database via `dbName`, so dev/prod DBs are never touched.
const DEFAULT_TEST_MONGO_URL = 'mongodb://127.0.0.1:27017';
const TEST_DB_PREFIX = 'redhunter_test_';
const SERVER_SELECTION_TIMEOUT_MS = 5_000;

export interface TestDatabase {
  readonly connection: Connection;
  readonly models: HermesModels;
  readonly dbName: string;
  drop(): Promise<void>;
}

export function createTestDbName(prefix = TEST_DB_PREFIX): string {
  return `${prefix}${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const dbName = createTestDbName();
  const connection = await mongoose
    .createConnection(process.env.MONGO_URL ?? DEFAULT_TEST_MONGO_URL, {
      dbName,
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    })
    .asPromise();
  const models = await createHermesModels(connection);

  async function drop(): Promise<void> {
    // Guard: drop only the isolated DB this helper created.
    if (connection.name !== dbName || !dbName.startsWith(TEST_DB_PREFIX)) {
      throw new Error(`Refusing to drop unexpected database ${connection.name}`);
    }
    await connection.dropDatabase();
    await connection.close();
  }

  return { connection, models, dbName, drop };
}
