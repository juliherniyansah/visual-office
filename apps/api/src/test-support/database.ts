import { randomUUID } from 'node:crypto';
import type { Connection } from 'mongoose';
import { connectDatabase } from '../db/connection';
import { createModels, type Models } from '../db/models';

// Base URL only; every run gets its own database via `dbName`, so dev/prod DBs are never touched.
const DEFAULT_TEST_MONGO_URL = 'mongodb://127.0.0.1:27017';
const TEST_DB_PREFIX = 'redhunter_test_';

export interface TestDatabase {
  readonly connection: Connection;
  readonly models: Models;
  readonly dbName: string;
  drop(): Promise<void>;
}

export function createTestDbName(prefix = TEST_DB_PREFIX): string {
  return `${prefix}${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const dbName = createTestDbName();
  const connection = await connectDatabase(process.env.MONGO_URL ?? DEFAULT_TEST_MONGO_URL, {
    dbName,
  });
  const models = await createModels(connection);

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
