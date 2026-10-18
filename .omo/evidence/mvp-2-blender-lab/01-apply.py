"""Todo 1: anchor-based guide edits (md + html twin). Each anchor must match exactly once."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MD = ROOT / "docs/redhunter-hq-brainstorming-guided.md"
HTML = ROOT / "docs/redhunter-hq-brainstorming-guided.html"

ROW18_MD = '"make object yang di generate meshy dan di jait oleh bpy" → "iya begitu tambahkan" |'
ROW18_HTML = '"make object yang di generate meshy dan di jait oleh bpy" → "iya begitu tambahkan"</td></tr>'

MD_EDITS = [
    ('**MUST NOT** pakai smooth shading, tekstur blur, atau bentuk "meleleh" (lihat §4).',
     '**MUST NOT** pakai tekstur blur/noise, bentuk "meleleh", atau smooth shading di luar auto-smooth ≤ 30° (lihat §4).'),
    ('**Low-poly flat-shaded ala bruno-simon.com, kualitas tinggi** (bukan dark glass realistis) | Achievable via bpy, ringan, konsisten |',
     '**Mid-poly stylized bertekstur tajam** (siluet low-poly ala bruno-simon.com + tekstur hand-painted bersih; bukan dark glass foto-realistis) | Achievable via bpy + Meshy t2.5, ringan, konsisten; user m0019 MVP-2 |'),
    ('**Satu bahasa visual untuk SEMUA objek**: exterior, interior, furniture, karakter, props = low-poly flat-shaded. Tidak ada campuran realistis/bertekstur',
     '**Satu bahasa visual untuk SEMUA objek**: exterior, interior, furniture, karakter, props = mid-poly stylized, siluet tegas, tekstur hand-painted tajam atau palet flat. Tidak ada campuran foto-realistis/PBR'),
    ('| Gaya | Low-poly flat-shaded, playful, gamified, **clean & tajam** |',
     '| Gaya | Mid-poly stylized, playful, gamified, **clean & tajam** |'),
    ('| Shading | Flat. Smooth hanya jika user minta eksplisit |',
     '| Shading | Auto-smooth ≤ 30° (sudut tajam tetap tajam). Flat untuk geometri bpy |'),
    ('| Material | Vertex colors / palet flat, 1 shared material per kit bila bisa |',
     '| Material | Tekstur hand-painted tajam (Meshy) atau vertex colors/palet (bpy); 1 shared material/atlas per objek bila bisa |'),
    ('| Tekstur bitmap | Hindari; jika ada (hasil Meshy) wajib tajam di kamera dekat |',
     '| Tekstur bitmap | Diizinkan; wajib tajam di kamera dekat, ≤ 2048² karakter, ≤ 1024² kit/prop, tanpa noise/blur |'),
    ('| Batas bawah kualitas | Setara output Meshy |',
     '| Batas bawah kualitas | Setara output Meshy t2.5 + refine 2k/4k |'),
    ('**bentuk, prop, dan palet**, bukan tekstur:',
     '**bentuk, prop, dan palet**, bukan tekstur foto-realistis:'),
    ('whiteboard, sofa), tetap flat-shaded',
     'whiteboard, sofa), tetap §4 shading'),
    ('campuran objek realistis/PBR-bertekstur dengan objek low-poly dalam satu scene',
     'campuran objek foto-realistis PBR dengan objek stylized dalam satu scene'),
    ('mural dinding), tetap §4 flat-shaded |',
     'mural dinding), tetap §4 |'),
    ('| Bentuk | Humanoid low-poly, proporsi realistis-stylized |',
     '| Bentuk | Humanoid mid-poly stylized, proporsi realistis-stylized |'),
    ('≤ 8.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 1024² atau vertex color. Budget scene: 10 agents ≈ 80k tris',
     '≤ 20.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 2048². Budget scene: 10 agents ≈ 200k tris'),
    ('rig/animate/remesh 0',
     'rig 5, animate 3/aksi, remesh 5, convert/resize 1 (harga live MCP 2026-10-17)'),
    (ROW18_MD,
     ROW18_MD + '\n| 19 | Mid-poly stylized + tekstur tajam (bukan flat vertex-color murni); karakter ≤ 20k tris, tekstur ≤ 2048² | "mid poly aja saya butuh texture juga walau poly" (MVP-2) |'),
]

HTML_EDITS = [
    ('<li>Pakai smooth shading, tekstur blur, atau bentuk "meleleh" (lihat §4).</li>',
     '<li>Pakai tekstur blur/noise, bentuk "meleleh", atau smooth shading di luar auto-smooth ≤ 30° (lihat §4).</li>'),
    ('<td><strong>Low-poly flat-shaded ala bruno-simon.com, kualitas tinggi</strong> (bukan dark glass realistis)</td><td>Achievable via bpy, ringan, konsisten</td>',
     '<td><strong>Mid-poly stylized bertekstur tajam</strong> (siluet low-poly ala bruno-simon.com + tekstur hand-painted bersih; bukan dark glass foto-realistis)</td><td>Achievable via bpy + Meshy t2.5, ringan, konsisten; user m0019 MVP-2</td>'),
    ('<strong>Satu bahasa visual untuk SEMUA objek</strong>: exterior, interior, furniture, karakter, props = low-poly flat-shaded. Tidak ada campuran realistis/bertekstur',
     '<strong>Satu bahasa visual untuk SEMUA objek</strong>: exterior, interior, furniture, karakter, props = mid-poly stylized, siluet tegas, tekstur hand-painted tajam atau palet flat. Tidak ada campuran foto-realistis/PBR'),
    ('<td>Gaya</td><td>Low-poly flat-shaded, playful, gamified,',
     '<td>Gaya</td><td>Mid-poly stylized, playful, gamified,'),
    ('<td>Flat. Smooth hanya jika user minta eksplisit</td>',
     '<td>Auto-smooth ≤ 30° (sudut tajam tetap tajam). Flat untuk geometri bpy</td>'),
    ('<td>Vertex colors / palet flat, 1 shared material per kit bila bisa</td>',
     '<td>Tekstur hand-painted tajam (Meshy) atau vertex colors/palet (bpy); 1 shared material/atlas per objek bila bisa</td>'),
    ('<td>Hindari; jika ada (hasil Meshy) wajib tajam di kamera dekat</td>',
     '<td>Diizinkan; wajib tajam di kamera dekat, ≤ 2048² karakter, ≤ 1024² kit/prop, tanpa noise/blur</td>'),
    ('<td>Setara output Meshy</td>',
     '<td>Setara output Meshy t2.5 + refine 2k/4k</td>'),
    ('<strong>bentuk, prop, dan palet</strong>, bukan tekstur:',
     '<strong>bentuk, prop, dan palet</strong>, bukan tekstur foto-realistis:'),
    ('whiteboard, sofa), tetap flat-shaded</li>',
     'whiteboard, sofa), tetap §4 shading</li>'),
    ('campuran objek realistis/PBR-bertekstur dengan objek low-poly dalam satu scene',
     'campuran objek foto-realistis PBR dengan objek stylized dalam satu scene'),
    ('mural dinding), tetap §4 flat-shaded</td>',
     'mural dinding), tetap §4</td>'),
    ('<td>Humanoid low-poly, proporsi realistis-stylized</td>',
     '<td>Humanoid mid-poly stylized, proporsi realistis-stylized</td>'),
    ('≤ 8.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 1024² atau vertex color. Budget scene: 10 agents ≈ 80k tris',
     '≤ 20.000 tris per karakter (base body + semua parts terpasang + ring); semua parts share 1 material/atlas; tekstur ≤ 2048². Budget scene: 10 agents ≈ 200k tris'),
    ('rig/animate/remesh 0',
     'rig 5, animate 3/aksi, remesh 5, convert/resize 1 (harga live MCP 2026-10-17)'),
    (ROW18_HTML,
     ROW18_HTML + '\n  <tr><td>19</td><td>Mid-poly stylized + tekstur tajam (bukan flat vertex-color murni); karakter ≤ 20k tris, tekstur ≤ 2048²</td><td>"mid poly aja saya butuh texture juga walau poly" (MVP-2)</td></tr>'),
]


def apply(path: Path, edits: list[tuple[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in edits:
        count = text.count(old)
        assert count == 1, f"{path.name}: anchor count {count}: {old[:60]!r}"
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")
    print(f"OK {path.name} {len(edits)} edits")


if __name__ == "__main__":
    # Validate both files before writing either, so a bad anchor never leaves md/html drifted.
    for p, e in ((MD, MD_EDITS), (HTML, HTML_EDITS)):
        t = p.read_text(encoding="utf-8")
        bad = [o[:60] for o, _ in e if t.count(o) != 1]
        assert not bad, f"{p.name} bad anchors: {bad}"
    apply(MD, MD_EDITS)
    apply(HTML, HTML_EDITS)
