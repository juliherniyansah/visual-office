import type { OwnerCredentials } from '../auth/credentials';
import type { Models } from '../db/models';
import { seedAgents } from './agents';
import { type OwnerSeedResult, seedOwner } from './owner';

export interface SeedOptions {
  readonly models: Models;
  readonly owner?: OwnerCredentials;
  readonly forceOwnerPassword?: boolean;
}

export interface SeedResult {
  readonly agents: number;
  readonly owner: OwnerSeedResult | undefined;
}

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const agents = await seedAgents(options.models);
  const owner =
    options.owner === undefined
      ? undefined
      : await seedOwner(options.models, options.owner, {
          forcePassword: options.forceOwnerPassword === true,
        });
  return { agents, owner };
}
