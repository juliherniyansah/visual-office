# apps/api

## OVERVIEW
`@redhunter/api`: Express 5 HTTP + Socket.IO realtime + mongoose, JWT via `jose`, pino logs. Depends on all 4 packages.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Bootstrap | `src/index.ts`, `src/app.ts` | gateway attached before `listen()`, shares http server |
| Routes | `src/routes/` (24) | validate with zod, delegate to services |
| Business logic | `src/services/` (21) | take `ServiceDeps` |
| Auth | `src/auth/` | `verifyAccessToken` (token), `hasRole` (middleware) |
| Realtime | `src/realtime/gateway.ts`, `rooms.ts` | `agentRoom`, `runRoom`, `OFFICE_ROOM`, `roomsForEvent` |
| Outbox | `src/events/dispatcher.ts` | MAX_DISPATCH_ATTEMPTS 5, poll 250ms, batch 100 |
| Models | `src/db/models.ts` | |
| Seed | `src/seed/cli.ts` | `bun run seed` |
| Test harness | `src/test-support/{realtime,work}.ts` | build app via `createApp` |

## CONVENTIONS
- Two dispatchers: `events/dispatcher.ts` = event delivery; `services/dispatcher.ts` = run queue (composing→executing→verifying→succeeded, paused→queued retry, maxRetries 3). Don't merge/confuse.
- Socket: only `/office` namespace; default namespace refuses all. JWT checked at connection; `canSubscribeRun` (default allow) gates run rooms.
- New service → accept `ServiceDeps`, use `deps.models.*` not direct model imports.

## ANTI-PATTERNS
- `services/dispatcher.ts` uses `console.*` + `process.cwd()` — legacy; new code uses pino logger.
- Don't remove `settleWithin` (1s) in gateway close: bun 1.3.14 `http.Server#close` hangs after ws upgrade.
- Don't trust socket payload ids — parse with `AgentIdSchema` / `RunIdSchema` (max 128).
