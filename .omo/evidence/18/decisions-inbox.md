# Task 18: Decisions Inbox

## Implementation
- Created `apps/api/src/routes/decisions.ts` with POST /:id/answer
- Created `apps/web/src/components/DecisionsInbox.tsx` UI
- RBAC enforcement (viewer gets 403)
- 30-min timeout with injectable clock

## Verification
- `bun test` passes (1088 tests)
- API route responds correctly
- UI renders decision list

## Evidence
- API route: `apps/api/src/routes/decisions.ts`
- UI component: `apps/web/src/components/DecisionsInbox.tsx`
