# Issues — mvp-1-foundation

Problems and gotchas encountered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## T3 issues
- PLAN BUG: plan L128 `path.resolve(__dirname, '../../.omo/evidence/mvp-1-foundation')` resolves to `apps/.omo/...` (`__dirname` = apps/web/e2e). First baseline attempt failed ENOENT writing 14-renderer (log kept as `12-playwright-before-attempt1-pathbug.txt`; no snapshot written). Spec uses `'../../../.omo/...'` with a one-line comment. Same quirk exists in `landing.e2e.ts` -> pre-existing untracked `apps/.omo/evidence/` (not ours). Record in HANDOFF.
- next.config.ts emits `Unrecognized key(s) in object: 'eslint'` warning on every dev start (pre-existing, out of scope).

## T9 issues
- rtk hook rewrites `grep -cE … ; grep -E …` chains into its grouped-output mode and swallows other output in the same call. Use `/usr/bin/grep -c` for count checks in evidence QA.
- git status delta also includes `.omo/start-work/ledger.jsonl` (M) and 20 new `.omo/run-continuation/ses_*.json` — orchestration bookkeeping, covered by the `.omo/` allowance.

## F3 issues
- None blocking. Root `bun run --filter '*' typecheck` workspace output order is nondeterministic -> compare sorted error lines, not raw file diff.
- `@playwright/test` not hoisted to root node_modules; out-of-tree scripts must import it by absolute path from apps/web/node_modules.
