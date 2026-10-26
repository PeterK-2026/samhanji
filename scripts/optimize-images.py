"""assets-src/의 원본 PNG를 게임용 WebP로 줄여 public/img/ 에 넣는다.

사용법: python scripts/optimize-images.py
- 인물: 256×256 (public/img/officers/<id>.webp)
- 도시: 600×400 (public/img/regions/<id>.webp)
- 전략 지도: 1024×1024 (public/img/map/strategic.webp)
- 전장 질감·성: 384×384 (public/img/battle/<name>.webp)
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
JOBS = [
    ("officers", (256, 256)),
    ("regions", (600, 400)),
    ("map", (1024, 1024)),  # 전략 지도 (reference.png 는 제외)
    ("battle", (384, 384)),  # 전장 질감·성·부대 (투명 유지)
    ("battlefields", (1024, 1024)),  # 지역별 전장 그림 (ref-* 는 제외)
]


def main():
    total = 0
    for folder, size in JOBS:
        src = ROOT / "assets-src" / folder
        dst = ROOT / "public/img" / folder
        dst.mkdir(parents=True, exist_ok=True)
        for png in sorted(src.glob("*.png")):
            if png.stem == "reference" or png.stem.startswith("ref-"):
                continue
            out = dst / f"{png.stem}.webp"
            if out.exists() and out.stat().st_mtime >= png.stat().st_mtime:
                continue
            with Image.open(png) as im:
                alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
                im = im.convert("RGBA" if alpha else "RGB")
                im = ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, 0.5 if folder in ("map", "battle", "battlefields") else 0.4))
                im.save(out, "WEBP", quality=85, method=6)
            total += 1
    print(f"{total} images written")


if __name__ == "__main__":
    main()
