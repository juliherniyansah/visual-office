import type { Actor, AgentAdapter, Decision } from '@redhunter/shared';
import type { AgentRuntime } from '@redhunter/agent-runtime';
import type { Models } from '../db/models';
import type { Outbox } from '../events/outbox';
import type { AgentHermesSource } from '../routes/agentsHermes';
import type { Connection } from '../db/connection';

export interface ServiceDeps {
  readonly models: Models;
  readonly outbox: Outbox;
  readonly runtime?: AgentRuntime;
  readonly hermesSource?: AgentHermesSource;
  readonly connection?: Connection;
  readonly adapters?: readonly AgentAdapter[];
  readonly decisions?: {
    findById: (id: string) => Promise<Decision | null>;
    update: (id: string, patch: Partial<Decision>) => Promise<Decision>;
    listPending: () => Promise<Decision[]>;
  };
}

export interface ActorInput {
  readonly actor: Actor;
}
