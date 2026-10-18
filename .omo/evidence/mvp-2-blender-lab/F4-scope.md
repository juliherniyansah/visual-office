# F4 — Scope fidelity (read-only review, 2026-10-18)

| # | Check | Evidence | Result |
|---|---|---|---|
| 1 | Protected-path fingerprint | plan L65 `protected_sha()` = `(git diff -- $PROTECTED; git ls-files -o --exclude-standard -- $PROTECTED \| sort \| xargs -r sha256sum) \| sha256sum`, cut hash → `f7d496c6f5c8d5dcaca209bd9b71c08cbb1d95f70c226acd824e2962d138c9a6` = `00e-protected.sha` = `71b-protected.sha` | PASS |
| 2a | `.env` mtime (stat only, contents never read) | now `1792243729` = `00d-doc-mtimes.txt` `1792243729` | PASS |
| 2b | Guide md/html mtime | both `1792316484` (= `63-guide-mtimes-after.txt`; pre `1792253182`) | PASS |
| 2c | HANDOFF mtime | `1792317086` (pre `1792243079`) | PASS |
| 2d | Guide diff vs `00c-pre` | md and html hunks only in the sanctioned cells: §1 MUST NOT 4; §3 Style / Konsistensi style / Hybrid Meshy (verdict text); §4 Gaya/Shading/Material/Tekstur/Batas bawah/Konsistensi interior/Tolak; §4.1 Vibe; §5.1 Bentuk/Polycount; §10 Meshy price cell (`rig 5, animate 3/aksi, remesh 5, convert/resize 1`, plan L134) + cap note (450 / kit v2 ≤ 330); §11 rows 19 and 20. html mirrors md 1:1. No other lines touched | PASS |
| 2e | HANDOFF diff vs `00c-pre` | single hunk `67a68,124` (pure append, 0 deleted lines; file 124 lines) | PASS |
| 3 | Frozen blend md5 | hq_v01 `29a9335853af9bc029aea4eb88445110`, hq_v02 `559159834244a82a3d996a783675774a`, hq_v03 `8845bc7eadbbb6566f66ece44ea8a837`, equal to `24c`/`43b`/`54` (hq_v04 `edc83c06…` matches HANDOFF) | PASS |
| 4 | Secrets | grep `msy_[A-Za-z0-9]`, `sk-[A-Za-z0-9]{8}`, `api[_-]?key`, `Bearer `, `MESHY_API_KEY=[A-Za-z0-9]`, `Signature=/Expires=/Policy=/Key-Pair-Id/X-Amz-Signature` over apps/assets/blender (excl .blend), raw/meshy/*.md, HANDOFF, guide md/html, E/*.md\|txt\|json, notepads → 0 real hits. Only false positive: guide md:13 / html:53 `task-r…` substring of `task-redhunter` (prose). Meshy URLs: `51c-rig-urls.txt:10` and `51c-anim-urls.txt:4` contain only the unsigned base path `https://assets.meshy.ai/<account-uuid>/tasks/<id>/output/` (no query string or signature; files are untracked .omo evidence). Note: base path shows the Meshy account UUID; low sensitivity, keep it out of public commits | PASS (note) |
| 5 | Git state | HEAD `49ea58097b51da2867a596d1fa2185b2feed9e63` = `00b-head.txt`; branch `main`; `git diff --cached --name-only` empty; `git stash list` empty | PASS |
| 6 | Scope (status diff vs `00`) | added lines only: `?? .omo/run-continuation/ses_*.json` (21, session churn), `?? apps/assets/blender/`, `?? apps/assets/raw/`. No new or changed status lines under apps/web, apps/api, packages, apps/assets/scripts, apps/assets/models, package.json, bun.lock, .gitignore. Docs + `.omo/evidence/mvp-2-blender-lab/` were already ` M`/`??` before. Pre-existing dirty apps/api, apps/web etc. are not ours (protected sha unchanged). No `apps/web/public/models/hq.glb`. vs `70-git-status-after.txt`: only 2 extra run-continuation files | PASS |
| 7 | Meshy cap | ledger row 38: MVP total 352/450 (kit2 232); live `meshy_check_balance` = 3748 = ledger close balance | PASS |
| 8 | Large files (>10 MB) | `apps/assets/blender/hq_v04.blend` 97.8 MB + 11 `apps/assets/raw/meshy/kit_v2/KIT2_*.glb` (11.2–36.4 MB). All untracked (`git ls-files apps/assets/blender apps/assets/raw` = 0, nothing staged, not ignored). All 12 listed in HANDOFF L116 under "jangan masuk git". `.gitignore` left as is (protected; adding ignore rules is the user's call) | PASS |

Optional future consideration: before any commit, the user should decide whether to ignore or use LFS for `apps/assets/raw/meshy/kit_v2/*.glb` and `hq_v04.blend`, since `git add apps/assets` would currently pick up ~300 MB.

RESULT: PASS
