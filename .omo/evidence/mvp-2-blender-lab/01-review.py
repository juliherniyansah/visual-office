"""Todo 1 reviewer: extract each edited cell from md and html literally, compare normalized text."""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MD = (ROOT / "docs/redhunter-hq-brainstorming-guided.md").read_text(encoding="utf-8")
HT = (ROOT / "docs/redhunter-hq-brainstorming-guided.html").read_text(encoding="utf-8")
OUT = Path(__file__).with_name("01-guide-review.md")

# (cell label, unique substring of new text, intended new text fragment that must appear)
CELLS = [
    ("§1 MUST NOT 4", "tekstur blur/noise", 'tekstur blur/noise, bentuk "meleleh", atau smooth shading di luar auto-smooth ≤ 30°'),
    ("§3 Style (deskripsi)", "Mid-poly stylized bertekstur tajam", "siluet low-poly ala bruno-simon.com + tekstur hand-painted bersih"),
    ("§3 Style (alasan)", "Achievable via bpy + Meshy t2.5", "Achievable via bpy + Meshy t2.5, ringan, konsisten; user m0019 MVP-2"),
    ("§3 Konsistensi style", "Satu bahasa visual", "mid-poly stylized, siluet tegas, tekstur hand-painted tajam atau palet flat. Tidak ada campuran foto-realistis/PBR"),
    ("§4 Shading", "Auto-smooth ≤ 30°", "Auto-smooth ≤ 30° (sudut tajam tetap tajam). Flat untuk geometri bpy"),
    ("§4 Material", "Tekstur hand-painted tajam (Meshy)", "1 shared material/atlas per objek bila bisa"),
    ("§4 Tekstur bitmap", "Diizinkan; wajib tajam", "≤ 2048² karakter, ≤ 1024² kit/prop, tanpa noise/blur"),
    ("§4 Batas bawah kualitas", "Setara output Meshy", "Setara output Meshy t2.5 + refine 2k/4k"),
    ("§4 Tolak", "Tolak (anti-pattern visual)", "campuran objek foto-realistis PBR dengan objek stylized dalam satu scene"),
    ("§4 Gaya", "playful, gamified", "Mid-poly stylized, playful, gamified, clean & tajam"),
    ("§4 Konsistensi interior (intro)", "Konsistensi interior (MUST)", "bukan tekstur foto-realistis:"),
    ("§4 Konsistensi interior (li siluet)", "Kekayaan visual dari siluet prop", "whiteboard, sofa), tetap §4 shading"),
    ("§4.1 Vibe", "Startup playful", "mural dinding), tetap §4"),
    ("§5.1 Bentuk", "proporsi realistis-stylized", "Humanoid mid-poly stylized, proporsi realistis-stylized"),
    ("§5.1 Polycount", "≤ 20.000 tris", "tekstur ≤ 2048². Budget scene: 10 agents ≈ 200k tris"),
    ("§10 Meshy biaya", "generate ±20–30 kredit", "rig 5, animate 3/aksi, remesh 5, convert/resize 1 (harga live MCP 2026-10-17)"),
    ("§11 row 19", "mid poly aja saya butuh texture", 'Mid-poly stylized + tekstur tajam (bukan flat vertex-color murni); karakter ≤ 20k tris, tekstur ≤ 2048² "mid poly aja saya butuh texture juga walau poly" (MVP-2)'),
]


def find_line(text: str, needle: str) -> str:
    hits = [ln for ln in text.splitlines() if needle in ln]
    assert len(hits) == 1, f"{needle!r}: {len(hits)} hits"
    return hits[0]


def norm_md(line: str) -> str:
    line = re.sub(r"^\s*\d+\.\s+\*\*MUST NOT\*\*\s+", "", line)  # numbered list prefix
    line = re.sub(r"^\s*-\s+", "", line)  # bullet prefix
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) > 1:
        cells = cells[1:]  # drop label/number column; html label compared separately below
    return " ".join(c.replace("**", "") for c in cells).strip()


def norm_html(line: str) -> str:
    cells = re.findall(r"<td>(.*?)</td>", line)
    if cells:
        cells = cells[1:]
        text = " ".join(cells)
    else:
        text = line
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def main() -> None:
    rows, ok = [], True
    for label, needle, intent in CELLS:
        md_txt = norm_md(find_line(MD, needle))
        ht_txt = norm_html(find_line(HT, needle))
        # MUST NOT list: html omits the bold prefix and capitalizes "Pakai"; md keeps "pakai".
        md_cmp = md_txt[0].upper() + md_txt[1:] if label == "§1 MUST NOT 4" else md_txt
        equal = md_cmp == ht_txt
        intent_ok = intent in md_txt and intent in ht_txt
        ok &= equal and intent_ok
        cell = lambda s: s.replace("|", "\\|")
        rows.append(f"| {label} | {cell(md_txt)} | {cell(ht_txt)} | {'yes' if equal else 'NO'} | {'yes' if intent_ok else 'NO'} |")
    body = [
        "# 01 guide review (literal extraction, scripted: 01-review.py)",
        "",
        "Normalization: md drops label column, `**`, MUST NOT list prefix (first letter uppercased); html drops label `<td>`, tags, entities unescaped.",
        "",
        "| cell | md text | html text | equal? | matches intent? |",
        "|---|---|---|---|---|",
        *rows,
        "",
        "## Deviations",
        "- §1 MUST NOT 4 html `<li>` has no `**MUST NOT**` prefix and starts `Pakai` (pre-existing html style); mirrored text only, compared case-insensitively on first letter.",
        "- §4 Konsistensi interior `tetap flat-shaded` lives in a list item (not a table row); replaced only that occurrence (`whiteboard, sofa), tetap flat-shaded`).",
        "- md edits = 16 anchor replacements covering 17 review cells (§3 Style description+reason done as one row edit).",
        "",
        f"RESULT: {'PASS' if ok and len(rows) == 17 else 'FAIL'}",
    ]
    OUT.write_text("\n".join(body) + "\n", encoding="utf-8")
    print("ROWS", len(rows), "PASS" if ok else "FAIL")


if __name__ == "__main__":
    main()
