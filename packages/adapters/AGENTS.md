# packages/adapters

## OVERVIEW
Spawns and maps output of external coding-agent CLIs into shared run events.

## STRUCTURE
```
src/
├── spawn.ts      # shared spawner: env allowlist, resolveCwd, setsid group, killTree, backoff
├── opencode/     # @opencode-ai/sdk (pinned 1.18.13) adapter, event-mapper, run-state
├── codex/        # event-mapper
├── claude/       # settings.ts, event-mapper
└── headless/
```
Each adapter has its own `test-support/`.

## CONVENTIONS
- New adapter: spawn only via `spawn.ts`; map raw CLI events in `event-mapper.ts`, validate with zod, emit `@redhunter/shared` types.
- Keep `@opencode-ai/sdk` pinned exactly — event shapes change between versions.

## KNOWN LIMITS (`ponytail:`)
- claude `settings.ts`: resume ignored.
- opencode `run-state.ts`: no reconnect on stream drop.
- codex/opencode event-mapper: unknown events dropped/simplified.

## ANTI-PATTERNS
- Never forward full `process.env` to child.
- Never bypass `resolveCwd` traversal guard.
- Kill whole process group (`killTree`), not just pid.
