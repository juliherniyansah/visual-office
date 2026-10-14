# Architecture

RedHunter is an event-driven multi-agent orchestration platform. This document covers the internal design, component interactions, and recovery mechanisms.

## System Overview

The system has four layers: API (HTTP + WebSocket), Event Dispatcher (outbox pattern), Agent Runtime (Hermes), and Adapter Spawner (process isolation). Each layer communicates through well-defined boundaries with explicit failure handling.

## Event Dispatcher

**File:** `apps/api/src/events/dispatcher.ts`

The dispatcher implements the transactional outbox pattern. Domain events are written to MongoDB alongside business operations, then polled and delivered to registered sinks.

### Recovery: Replay on Failure

When a sink throws, the dispatcher checks `dispatchAttempts` against `MAX_DISPATCH_ATTEMPTS` (5). If under the limit, the event is re-queued by resetting `dispatched: false` and recording the error. The next poll cycle picks it up again. This avoids permanent event loss from transient sink failures (network blips, temporary service unavailability).

Once attempts exhaust, the event is marked failed via `recordFailure()` and the dispatcher moves on — head-of-line blocking is intentional (see ponytail comment in source) to preserve causal ordering.

### Polling Strategy

Strict `createdAt` ordering means a failing event at the head of the queue stalls subsequent events for up to `POLL_INTERVAL_MS` (250ms default). This is deliberate: out-of-order delivery would violate causal dependencies between events. The batch size (100) caps per-tick work to avoid starving the event loop.

## Real-time Gateway

**File:** `apps/api/src/realtime/gateway.ts`

Socket.IO server on the `/office` namespace. JWT-authenticated via `useJwtAuth` middleware. Supports room-based subscriptions for agent and run events.

### Recovery: Resync Handler

Clients emit `resync` to request a full state snapshot. The handler queries the 100 most recent runs and all agents, returning them in a single ack. This lets clients recover from missed events (network partition, page reload, socket reconnection) without replaying the entire event log.

The resync handler has no authorization beyond the socket-level JWT — any authenticated client can request the full state. This is acceptable because the `/office` namespace already enforces role-based access at connection time.

### Connection State Recovery

Socket.IO's built-in `connectionStateRecovery` is enabled with `maxDisconnectionDuration: RECOVERY_WINDOW_MS`. A client that reconnects within the window resumes its session without re-joining rooms. The `skipMiddlewares: false` setting ensures JWT re-verification on recovery — a recovered session is not trusted blindly.

## Adapter Spawner

**File:** `packages/adapters/src/spawn.ts`

Spawns vendor CLI processes (Claude, Codex, OpenCode) as detached child processes. The spawner enforces a strict environment allowlist, validates the cwd to prevent directory traversal, and isolates each adapter in its own process group.

### Recovery: Exponential Backoff

`spawnChild` retries up to 5 times with exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s). This handles transient spawn failures (port conflicts, resource exhaustion, temporary file locks) without giving up immediately.

The backoff is applied inside `spawnChild` itself, not at the caller level, so all adapter invocations benefit automatically. The retry loop catches errors from `startProcess` (Bun.spawn) and re-throws the last error if all attempts fail.

### Process Isolation

`detached: true` calls `setsid()`, giving the child its own process group. This ensures signals (SIGTERM, SIGKILL) reach grandchildren — vendor CLIs often spawn their own subprocesses. The `killTree` helper walks the process tree to clean up stragglers.

## Agent Runtime

**File:** `apps/api/src/runtime.ts`

Hermes-based orchestration layer. Loads constitution prompts, manages knowledge stores, and verifies completion before marking runs done.

### Prompt Sources

The runtime composes prompts from three sources: the Hermes store (persistent knowledge base), the constitution (system-level constraints), and user context (per-run overrides). These are merged in priority order before being sent to the adapter.

### Completion Verification

`verifyCompletion` checks the adapter's output against the original request before marking the run as done. This prevents false-positive completions (adapter returns early, output truncated, etc.).

## Data Flow

```
User Request
    ↓
HTTP API (Express)
    ↓
Event Outbox (MongoDB)
    ↓
Event Dispatcher (poll loop)
    ↓
┌───────────────────┬───────────────────┐
↓                   ↓                   ↓
Agent Runtime    WebSocket Gateway    Custom Sinks
(Hermes)         (Socket.IO)
    ↓                   ↓
Adapter Spawner    Client Dashboard
(Bun.spawn)
    ↓
Vendor CLI (Claude/Codex/OpenCode)
```

## Failure Modes

| Failure | Recovery | Limit |
|---------|----------|-------|
| Sink throws | Re-queue event | 5 attempts |
| Spawn fails | Exponential backoff | 5 attempts, 30s max |
| Socket disconnect | Connection state recovery | RECOVERY_WINDOW_MS |
| Missed events | Client emits `resync` | Full snapshot |
| Head-of-line block | Strict ordering, stall queue | By design |

## Security Boundaries

- **JWT at connection time**: Socket middleware verifies every connection.
- **Room authorization**: `mayReadRun` checks agent ownership before allowing subscription.
- **Environment allowlist**: Only whitelisted env vars pass to child processes.
- **CWD validation**: `resolveCwd` rejects paths outside the allowed tree.
- **CORS**: Origin check on both HTTP and WebSocket upgrades.
