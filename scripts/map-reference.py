"""전략 지도 그림 생성용 해안선 기준 이미지(assets-src/map/reference.png)를 만든다.
map.ts의 투영·해안선과 똑같이 그려 생성 그림이 지역 좌표와 맞도록 한다. 1024×1024 (640×680 뷰박스를 늘려 맞춤)."""
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "src/ui/map.ts").read_text(encoding="utf-8")
coast = [(float(a), float(b)) for a, b in re.findall(r"\[(\d+\.?\d*), (\d+\.?\d*)\]", src[src.index("const COAST"):src.index("];", src.index("const COAST"))])]
W, H, OUT = 640, 680, 1024

def project(lon, lat):
    x = (lon - 114.5) * 20 if lon < 120 else 110 + (lon - 120) * 48
    y = (43.5 - lat) * 50 if lat > 40 else 175 + (40 - lat) * 72
    return x * OUT / W, y * OUT / H

img = Image.new("RGB", (OUT, OUT), (52, 84, 110))
d = ImageDraw.Draw(img)
d.polygon([project(*p) for p in coast], fill=(214, 196, 150))
jx, jy = project(126.55, 33.38)
d.ellipse([jx - 21, jy - 13, jx + 21, jy + 13], fill=(214, 196, 150))
img.save(ROOT / "assets-src/map/reference.png")
print("saved", len(coast), "coast points")
