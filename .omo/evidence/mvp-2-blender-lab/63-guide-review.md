# Todo 18 (docs) — guide review

mtime guard (pre-edit): md/html 1792253182, HANDOFF 1792243079 == 00d-doc-mtimes.txt → OK.

| Check | Method | Result |
|---|---|---|
| §3 Hybrid Meshy row md == html | strip tags/`**`/entities/pipes, whitespace-normalize, compare | PASS |
| §11 row 20 md == html | same normalization | PASS |
| §10 cap note (450, kit v2 ≤ 330) md == html | same normalization | PASS |
| Old phrase `Aktif hanya jika uji MVP-2 fase 2b lolos` gone | grep -c md/html = 0/0 | PASS |
| `grep -c '\| 20 \|'` md | = 1 | PASS |
| html.parser parse | python HTMLParser().feed, exit 0 | PASS |
| No other sections changed | diff vs 00c-pre: remaining hunks = todo-1 edits (§1 rule 4, §3 Style/Konsistensi, §4, §5, §10 Meshy row, §11 row 19); Hybrid row prefix identical to pre, only target phrase replaced; new: §11 row 20, §10 cap note | PASS |
| HANDOFF.md untouched | mtime 1792243079 unchanged | PASS |

Diffs: 63-guide-md-final.diff, 63-guide-html-final.diff. New mtimes: 63-guide-mtimes-after.txt.

RESULT: PASS
