import mongoose, { type Connection } from 'mongoose';

export type { Connection };

const SERVER_SELECTION_TIMEOUT_MS = 5_000;

export interface ConnectOptions {
  // Overrides the database named in the URL (tests use a unique name per run).
  readonly dbName?: string;
}

// Dedicated connection (not the mongoose global) so tests and later todos can hold several.
export async function connectDatabase(
  url: string,
  options: ConnectOptions = {},
): Promise<Connection> {
  return mongoose
    .createConnection(url, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      ...(options.dbName === undefined ? {} : { dbName: options.dbName }),
    })
    .asPromise();
}
