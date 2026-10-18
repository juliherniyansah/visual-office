# Learnings — mvp-0-vision

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

- todo1: §11 rows format `| N | Keputusan | Kutipan |`, file ends at last row (no trailing section). §0 rows `| §X | desc | when |`.

- todo7: appended HANDOFF block by piping plan lines 175-178 through `sed 's/^    //'` (+ date substitution) instead of retyping. Guarantees byte-identical bullets (em dashes, arrows, ≤) and empty diff on first try.

## todo5 (html mirror)
- Single python script with assert count==1 per anchor + str.replace does all 6 html edits atomically; bottom-up irrelevant then but safe.
- html §4 checklist </ul> followed by blank line then <h2>5. Karakter</h2>; §5.1 orig html order had Pose dasar before Animasi wajib (md order differs) - rewrote block so final order matches md.
- §11 changelog rows keep hex/identifiers as plain text (md has no backticks there).
