"""지역별 전장 그림(assets-src/battlefields/<id>.png)을 Codex CLI로 그린다.
기준 이미지 ref-<id>.png를 첨부해 지형 위치를 그대로 지키게 한다. 없는 것만 만든다.
사용법: python scripts/gen-battlefields.py [동시 작업 수=6]"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding="utf-8")  # Windows 콘솔에서 한글 지명 출력 오류 방지
WORKERS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
CODEX = "codex.cmd" if sys.platform == "win32" else "codex"
PROMPT = """Use your image generation tool to create ONE image and save it as a PNG at exactly {out} (relative to the current directory). Do not create, modify or delete any other files.

The attached image {ref} is an exact LAYOUT GUIDE seen from directly above. Use it as the reference/input image and keep every feature at the same position and size:
- tan = dry open plains (dirt and short grass)
- light green = grassland meadows
- dark green = dense forest
- grey = rugged impassable rocky mountains with ridges
- blue = river or lake water with natural banks
- ochre = low rolling hills
- red squares = 7th-century Korean stone fortresses with walls, gate towers and dark tiled roofs (the largest red square is the main fortress, draw it bigger and grander)

Paint a polished, high-quality top-down battlefield map for a historical strategy game ({name} region, 7th-century Korea), in the spirit of classic Koei war maps but with refined modern painterly detail:
natural organic terrain borders (no hexagons, no straight edges), rivers with sandy banks and small fords, individual tree crowns with soft shadows, mountains with shaded ridges and snowy tips, faint dirt roads linking the fortresses, subtle lighting from the top-left, warm muted palette, square 1:1, 1024x1024.
Absolutely no text, no labels, no grid, no hexagon outlines, no soldiers, no people, no flags, no frame, no watermark.
After saving, report the saved path and pixel size."""


def run(f):
    out = f"assets-src/battlefields/{f['id']}.png"
    ref = f"assets-src/battlefields/ref-{f['id']}.png"
    if (ROOT / out).exists():
        return
    log = ROOT / f"assets-src/logs/battlefield-{f['id']:02d}.log"
    with log.open("w", encoding="utf-8") as lf:
        p = subprocess.run([CODEX, "exec", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", str(ROOT), "-i", ref, "-"],
                           input=PROMPT.format(out=out, ref=ref, name=f["name"]), text=True, encoding="utf-8", stdout=lf, stderr=subprocess.STDOUT)
    print(f"{f['id']:02d} {f['name']}: exit {p.returncode}, {'ok' if (ROOT / out).exists() else 'MISSING'}", flush=True)


fields = json.loads((ROOT / "assets-src/battlefields/fields.json").read_text(encoding="utf-8"))
with ThreadPoolExecutor(WORKERS) as ex:
    list(ex.map(run, fields))
missing = [f["id"] for f in fields if not (ROOT / f"assets-src/battlefields/{f['id']}.png").exists()]
print("missing:", missing)
