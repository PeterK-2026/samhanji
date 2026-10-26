"""Codex CLI(이미지 생성 도구)로 manifest.json의 이미지 중 없는 것을 병렬로 만든다.

사용법: python scripts/gen-images.py [동시 작업 수=6] [묶음 크기=6]
이미 있는 파일은 건너뛰므로, 중간에 멈춰도 다시 실행하면 이어서 만든다.
로그: assets-src/logs/
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKERS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
CHUNK = int(sys.argv[2]) if len(sys.argv) > 2 else 6
CODEX = "codex.cmd" if sys.platform == "win32" else "codex"


def brief(items):
    lines = [
        "Use your image generation tool to create the images below, one image per item, and save each as a PNG "
        "at exactly the given path (relative to the current directory). Create folders if needed. "
        "If a file already exists, skip it. Do not create, modify or delete any other files. "
        "Generate each image separately from its own prompt. When done, list the saved paths with pixel sizes.",
        "",
    ]
    for i, it in enumerate(items, 1):
        lines += [f"### Item {i}: {it['file']}", it["prompt"], ""]
    return "\n".join(lines)


def run(idx, items):
    log = ROOT / "assets-src/logs" / f"batch-{idx:02d}.log"
    with log.open("w", encoding="utf-8") as f:
        p = subprocess.run(
            [CODEX, "exec", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", str(ROOT), "-"],
            input=brief(items), text=True, encoding="utf-8", stdout=f, stderr=subprocess.STDOUT,
        )
    done = sum((ROOT / it["file"]).exists() for it in items)
    print(f"batch {idx:02d}: exit {p.returncode}, {done}/{len(items)} saved", flush=True)


def main():
    manifest = json.loads((ROOT / "assets-src/manifest.json").read_text(encoding="utf-8"))
    todo = [it for it in manifest if not (ROOT / it["file"]).exists()]
    print(f"{len(todo)} of {len(manifest)} images to generate, {WORKERS} workers x {CHUNK} per batch", flush=True)
    (ROOT / "assets-src/logs").mkdir(parents=True, exist_ok=True)
    chunks = [todo[i:i + CHUNK] for i in range(0, len(todo), CHUNK)]
    with ThreadPoolExecutor(WORKERS) as ex:
        for i, c in enumerate(chunks, 1):
            ex.submit(run, i, c)
    left = [it["file"] for it in manifest if not (ROOT / it["file"]).exists()]
    print(f"finished; {len(left)} missing", *left, sep="\n", flush=True)


if __name__ == "__main__":
    main()
