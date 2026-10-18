# packages/agent-runtime

## OVERVIEW
Run orchestration (`src/runtime.ts`), OMO plan/verify loop (`src/omo/`), prompt assembly (`src/prompt/`). Deps: shared, hermes, zod; adapters dev-only (types/tests).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Run lifecycle | `src/runtime.ts` | interactive flow tested in `runtime.interactive.test.ts` |
| Plan parsing | `src/omo/` | `plan.test.ts` |
| Verification | `src/omo/verify.ts` | keyword-containment only (`ponytail:`) |
| Prompt build | `src/prompt/` | snapshot tests in `__snapshots__/` |
| Token budget | `src/prompt/budget.ts` | chars/4 UTF-16 units |

## CONVENTIONS
- Prompt change → update snapshots deliberately (`bun test --update-snapshots`), review diff.
- Budget math differs from hermes `tokens.ts` (code points). Unify both if touching either.

## ANTI-PATTERNS
- Don't import adapters at runtime — dev dependency only.
