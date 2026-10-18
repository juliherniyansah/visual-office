import type { Models } from '../db/models';
import { seedAgents } from './agents';

export interface SeedOptions {
  readonly models: Models;
  readonly forceOwnerPassword?: boolean;
}

export interface SeedResult {
  readonly agents: number;
}

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const agents = await seedAgents(options.models);
  return { agents };
}
