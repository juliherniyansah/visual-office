import { ClaudeAdapter, CodexAdapter, FakeAdapter, OpencodeAdapter } from '@redhunter/adapters';
import type { AdapterId, AgentAdapter } from '@redhunter/shared';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { connectDatabase } from './db/connection';
import { createModels } from './db/models';
import { createEventDispatcher } from './events/dispatcher';
import { createOutbox } from './events/outbox';
import { createRealtimeGateway } from './realtime/gateway';
import { createApiRuntime } from './runtime';
import { runSeed } from './seed';
import { createAgentHermesSource } from './services/agentHermes';
import { createOfficeStateProjector } from './services/officeProjector';
import { closeHttpServer, createHttpServer, listen } from './server';

export const PACKAGE_NAME = '@redhunter/api';

async function main(): Promise<void> {
  const env = loadEnv();
  const connection = await connectDatabase(env.mongoUrl);
  const models = await createModels(connection);
  // Boot seed is idempotent and never resets an existing owner password.
  const seed = await runSeed({ models, owner: env.owner });
  const ownerSummary = seed.owner === undefined ? 'skipped' : JSON.stringify(seed.owner);
  console.info(`seed: agents=${seed.agents} owner=${ownerSummary}`);

  // emit() is the only writer into `events`; the fast path wakes the dispatcher immediately.
  const outbox = createOutbox({ models, onEmitted: () => dispatcher.notify() });
  // E2E_FAKE_ADAPTER=1 swaps the vendor adapters for a scripted FakeAdapter (no vendor binary needed).
  const adapters = new Map<AdapterId, AgentAdapter>(
    process.env.E2E_FAKE_ADAPTER === '1'
      ? [
          [
            'opencode',
            new FakeAdapter({
              script: [
                { type: 'started', vendorSessionId: 'e2e-fake-session' },
                { type: 'text', text: 'e2e fake step one' },
                { type: 'text', text: 'e2e fake step two' },
                { type: 'completed', finalText: 'e2e fake done' },
              ],
            }),
          ],
        ]
      : [
          ['opencode', new OpencodeAdapter()],
          ['claude', new ClaudeAdapter()],
          ['codex', new CodexAdapter()],
        ],
  );
  const { runtime, hermesStore } = await createApiRuntime({ models, outbox, connection, adapters });
  const server = createHttpServer(
    createApp({
      models,
      jwtSecret: env.jwtSecret,
      outbox,
      runtime,
      hermesSource: createAgentHermesSource(hermesStore),
      connection,
      adapters: Object.fromEntries(adapters),
    }),
  );
  const gateway = createRealtimeGateway(server, {
    jwtSecret: env.jwtSecret,
    corsOrigins: env.corsOrigins,
    canSubscribeRun: async (runId) => (await models.Run.exists({ _id: runId })) !== null,
  });
  // Projector deltas flow back through the outbox so socket delivery and replay share one path.
  const projector = createOfficeStateProjector({
    models,
    onUpdated: async (version, changed) => {
      await outbox.emit({
        type: 'office.state_updated',
        aggregate: { kind: 'office', id: 'singleton' },
        actor: { kind: 'system', id: 'office-projector' },
        payload: { version, changed: [...changed] },
      });
    },
  });
  const dispatcher = createEventDispatcher({
    models,
    sinks: [gateway.deliver, projector.handle],
    enabled: env.eventsDispatch === 'on',
  });

  await listen(server, env);
  dispatcher.start();
  console.info(`api listening on http://${env.host}:${env.port} (events ${env.eventsDispatch})`);

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    // Stop delivering first; Mongo closes last because an in-flight tick still uses it.
    dispatcher
      .stop()
      .then(() => gateway.close())
      .then(() => closeHttpServer(server))
      .then(() => connection.close())
      .then(
        () => process.exit(0),
        (err: unknown) => {
          console.error('api shutdown failed:', err instanceof Error ? err.message : err);
          process.exit(1);
        },
      );
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error('api failed to start:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
