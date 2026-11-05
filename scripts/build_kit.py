#!/usr/bin/env python3
"""Build the SVEMY document kit: one zip people attach to an AI chat.

The kit keeps the files readable for the AI (plain HTML that links shared CSS)
and ships build_document.py, which turns a finished document into one
self-contained file to open in Chrome and save as PDF. New templates in
templates/ are picked up automatically.

Usage (from the repo root):
    python3 scripts/build_kit.py
Output:
    dist/svemy-document-kit.zip
"""
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
KIT = DIST / "svemy-document-kit"
ZIP = DIST / "svemy-document-kit.zip"

# What goes into the kit, relative to the repo root
FILES = ["svemy_styleguide.html"]
FOLDERS = ["css", "js", "fonts", "assets", "templates"]
GUIDE = ROOT / "kit" / "START_HERE.md"


def main() -> None:
    if KIT.exists():
        shutil.rmtree(KIT)
    KIT.mkdir(parents=True)

    for name in FILES:
        shutil.copy2(ROOT / name, KIT / name)
    for name in FOLDERS:
        shutil.copytree(ROOT / name, KIT / name)
    shutil.copy2(ROOT / "scripts" / "build_standalone.py", KIT / "build_document.py")
    (KIT / "documents").mkdir()
    if GUIDE.is_file():
        shutil.copy2(GUIDE, KIT / "START_HERE.md")
    else:
        print("note: kit/START_HERE.md is missing, the kit has no guide yet")

    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for path in sorted(KIT.rglob("*")):
            arc = Path(KIT.name) / path.relative_to(KIT)
            if path.is_dir():
                z.writestr(str(arc).replace("\\", "/") + "/", "")
            else:
                z.write(path, str(arc).replace("\\", "/"))

    templates = sorted(p.name for p in (KIT / "templates").glob("*.html"))
    print(f"{ZIP.relative_to(ROOT)} ({ZIP.stat().st_size / 1024:.0f} KB), "
          f"{len(templates)} templates")


if __name__ == "__main__":
    sys.exit(main())
