# Task 19: Cost Panel, Health, Logging

## Implementation
- Created `apps/api/src/routes/usage.ts` with GET /api/v1/usage
- Created `apps/api/src/routes/health.ts` with GET /healthz
- Created `apps/api/src/lib/logger.ts` with pino
- Created `apps/web/src/components/CostPanel.tsx` UI

## Verification
- `bun test` passes (1088 tests)
- Health endpoint responds
- Usage aggregation works

## Evidence
- Usage route: `apps/api/src/routes/usage.ts`
- Health route: `apps/api/src/routes/health.ts`
- Logger: `apps/api/src/lib/logger.ts`
- UI component: `apps/web/src/components/CostPanel.tsx`
