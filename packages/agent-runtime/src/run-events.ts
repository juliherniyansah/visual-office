import type {
  Actor,
  AdapterEvent,
  AgentId,
  AgentStatus,
  Decision,
  DomainEventInput,
  EscalationTarget,
  Result,
  Run,
} from '@redhunter/shared';
import type { Worker } from './workers';

// Builders for the catalog events the runtime emits; the actor is always the run's agent.
export class RunEvents {
  readonly #actor: Actor;
  readonly #run: { readonly kind: 'run'; readonly id: string };

  constructor(
    private readonly runId: string,
    private readonly agentId: AgentId,
  ) {
    this.#actor = { kind: 'agent', id: agentId };
    this.#run = { kind: 'run', id: runId };
  }

  started(run: Run): DomainEventInput {
    const { taskId, agentId, adapterId } = run;
    return this.#runEvent('run.started', { runId: run.id, taskId, agentId, adapterId });
  }

  progress(seq: number, adapterEvent: AdapterEvent): DomainEventInput {
    return this.#runEvent('run.progress', { runId: this.runId, seq, adapterEvent });
  }

  permissionRequested(permissionId: string, tool: string, detail: string): DomainEventInput {
    const payload = { runId: this.runId, permissionId, tool, detail };
    return this.#runEvent('run.permission_requested', payload);
  }

  completed(): DomainEventInput {
    return this.#runEvent('run.completed', { runId: this.runId });
  }

  failed(error: string): DomainEventInput {
    return this.#runEvent('run.failed', { runId: this.runId, error });
  }

  escalated(escalatedTo: EscalationTarget): DomainEventInput {
    return this.#runEvent('run.escalated', { runId: this.runId, escalatedTo });
  }

  worker(kind: 'spawned' | 'despawned', worker: Worker): DomainEventInput {
    const payload = { runId: this.runId, ...worker };
    return kind === 'spawned'
      ? this.#runEvent('worker.spawned', payload)
      : this.#runEvent('worker.despawned', payload);
  }

  agentStatus(status: AgentStatus): DomainEventInput {
    return {
      type: 'agent.status_changed',
      aggregate: { kind: 'agent', id: this.agentId },
      actor: this.#actor,
      payload: { agentId: this.agentId, status, runId: this.runId },
    };
  }

  resultRecorded(result: Result): DomainEventInput {
    return {
      type: 'result.recorded',
      aggregate: { kind: 'result', id: result.id },
      actor: this.#actor,
      payload: { result },
    };
  }

  decisionRequested(decision: Decision): DomainEventInput {
    return {
      type: 'decision.requested',
      aggregate: { kind: 'decision', id: decision.id },
      actor: this.#actor,
      payload: { decision },
    };
  }

  #runEvent<T extends DomainEventInput['type']>(
    type: T,
    payload: Extract<DomainEventInput, { type: T }>['payload'],
  ): DomainEventInput {
    return { type, aggregate: this.#run, actor: this.#actor, payload } as DomainEventInput;
  }
}
