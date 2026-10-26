"""전장 그림 생성용 기준 이미지(assets-src/battlefields/ref-<id>.png)를 만든다.
battleMap.ts와 같은 좌표(헥스 반지름 30, 13열×15행)를 1024×1024로 늘려 그린다.
색: 평지=황토, 초원=연두, 숲=진녹, 산=회색, 물=파랑, 구릉=황갈, 성=빨간 네모(본성은 크게)."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE = 30
W = math.sqrt(3) * SIZE
COLORS = {"plain": (206, 178, 120), "grass": (150, 190, 90), "forest": (40, 95, 45), "mountain": (128, 124, 120),
          "river": (50, 110, 190), "hill": (190, 150, 80), "castle": (206, 178, 120)}
fields = json.loads((ROOT / "assets-src/battlefields/fields.json").read_text(encoding="utf-8"))
for f in fields:
    cols, rows = f["cols"], f["rows"]
    vw, vh = W * (cols + 0.5) + 12, SIZE * 1.5 * (rows - 1) + SIZE * 2 + 12
    sx, sy = 1024 / vw, 1024 / vh
    img = Image.new("RGB", (1024, 1024), COLORS["plain"])
    d = ImageDraw.Draw(img)
    def center(i):
        c, r = (i - 1) % cols, (i - 1) // cols
        return (W * (c + 0.5 * (r & 1)) + W / 2 + 6) * sx, (SIZE * 1.5 * r + SIZE + 6) * sy
    for t in ["grass", "hill", "forest", "river", "mountain"]:
        for i, ter in enumerate(f["terrain"], 1):
            if ter != t: continue
            cx, cy = center(i)
            pts = [(cx + SIZE * 1.06 * sx * math.cos(math.radians(60 * k - 30)), cy + SIZE * 1.06 * sy * math.sin(math.radians(60 * k - 30))) for k in range(6)]
            d.polygon(pts, fill=COLORS[t])
    for c in f["castles"]:
        cx, cy = center(c)
        s = 34 if c == f["hq"] else 24
        d.rectangle([cx - s, cy - s, cx + s, cy + s], fill=(200, 30, 30))
    img.save(ROOT / f"assets-src/battlefields/ref-{f['id']}.png")
print("references:", len(fields))
