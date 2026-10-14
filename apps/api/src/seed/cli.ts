import { loadEnv } from '../config/env';
import { connectDatabase } from '../db/connection';
import { createModels } from '../db/models';
import { runSeed } from './index';

const FORCE_OWNER_PASSWORD_FLAG = '--force-owner-password';

// Usage: bun run seed [-- --force-owner-password]. The api also seeds on boot (never forced).
async function main(): Promise<void> {
  const env = loadEnv();
  const connection = await connectDatabase(env.mongoUrl);
  try {
    const result = await runSeed({
      models: await createModels(connection),
      owner: env.owner,
      forceOwnerPassword: process.argv.includes(FORCE_OWNER_PASSWORD_FLAG),
    });
    const ownerSummary = result.owner === undefined ? 'skipped' : JSON.stringify(result.owner);
    console.info(`seed ok: agents=${result.agents} owner=${ownerSummary}`);
  } finally {
    await connection.close();
  }
}

main().catch((err: unknown) => {
  console.error('seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
