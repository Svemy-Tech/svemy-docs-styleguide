#!/usr/bin/env python3
"""Build a single self-contained HTML file from a styleguide or document page.

Inlines every css/*.css <link>, js/*.js <script src>, and every font or image
referenced from the CSS (as base64 data URIs), so the result can be opened
from anywhere without its folders. Paths resolve from the input file's folder.
A cover drawing is inlined only if the page uses its cover-art class.
Local photos (<img src="images/...">) are inlined too; with Pillow installed
they are turned upright and made smaller first, so phone photos do not make
the file huge. Web addresses (https://...) are left as they are.

Usage (from the repo root):
    python3 scripts/build_standalone.py
        -> dist/svemy_styleguide.standalone.html
    python3 scripts/build_standalone.py documents/my-rfi.html
        -> documents/my-rfi.print.html
    python3 scripts/build_standalone.py INPUT.html OUTPUT.html
"""
import base64
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "svemy_styleguide.html"
DEFAULT_OUTPUT = ROOT / "dist" / "svemy_styleguide.standalone.html"

LINK_RE = re.compile(r'^(\s*)<link rel="stylesheet" href="([^"]+)"\s*/>\s*$', re.M)
SCRIPT_RE = re.compile(r'^(\s*)<script src="([^"]+)"></script>\s*$', re.M)
URL_RE = re.compile(r'url\("(?!data:)([^"]+)"\)')
IMG_RE = re.compile(r'(<img\b[^>]*?\bsrc=")(?!data:|https?:|//)([^"]+)(")', re.S)
PHOTO_MAX_SIDE = 2000  # px: sharp in print at the widest photo layout
MIME = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
        ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".webp": "image/webp"}


def read(path: Path) -> str:
    if not path.is_file():
        sys.exit(f"error: missing file {path}")
    return path.read_text(encoding="utf-8")


def inline_urls(css: str, css_path: Path, html: str) -> str:
    def repl(m: re.Match) -> str:
        asset = (css_path.parent / m.group(1)).resolve()
        # Cover drawings are large: keep only the ones this page uses
        used = re.compile(r'class="[^"]*\bcover-art-' + re.escape(asset.stem) + r'\b')
        if asset.parent.name == "covers" and not used.search(html):
            return "none"
        if not asset.is_file():
            sys.exit(f"error: missing asset {m.group(1)} referenced in {css_path.name}")
        mime = MIME.get(asset.suffix.lower())
        if mime is None:
            sys.exit(f"error: unknown asset type {asset.suffix}")
        data = base64.b64encode(asset.read_bytes()).decode("ascii")
        return f'url("data:{mime};base64,{data}")'
    return URL_RE.sub(repl, css)


def photo_data(path: Path) -> tuple:
    """A photo as (mime, bytes): upright and at most PHOTO_MAX_SIDE px when
    Pillow is available, otherwise unchanged."""
    raw = path.read_bytes()
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return MIME.get(path.suffix.lower(), "image/jpeg"), raw
    with Image.open(io.BytesIO(raw)) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE))
        out = io.BytesIO()
        if image.mode in ("RGBA", "LA", "P") and path.suffix.lower() == ".png":
            image.save(out, "PNG", optimize=True)
            return "image/png", out.getvalue()
        image.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
        return "image/jpeg", out.getvalue()


def inline_photos(html: str, base: Path) -> str:
    def repl(m: re.Match) -> str:
        path = (base / m.group(2)).resolve()
        if not path.is_file():
            sys.exit(f"error: missing photo {m.group(2)}")
        mime, data = photo_data(path)
        return f'{m.group(1)}data:{mime};base64,{base64.b64encode(data).decode("ascii")}{m.group(3)}'
    # Leave comments alone: an example in a comment is not a photo
    parts = re.split(r"(<!--.*?-->)", html, flags=re.S)
    return "".join(part if part.startswith("<!--") else IMG_RE.sub(repl, part) for part in parts)


def indent(text: str, pad: str) -> str:
    return "".join(pad + line if line.strip() else line
                   for line in text.splitlines(keepends=True))


def build(source: Path) -> str:
    html = read(source)
    base = source.parent

    def css_repl(m: re.Match) -> str:
        path = (base / m.group(2)).resolve()
        css = inline_urls(read(path), path, html)
        pad = m.group(1)
        return f"{pad}<style>\n{indent(css, pad + '  ')}{pad}</style>\n"

    def js_repl(m: re.Match) -> str:
        js = read((base / m.group(2)).resolve())
        pad = m.group(1)
        return f"{pad}<script>\n{indent(js, pad + '  ')}{pad}</script>\n"

    html = LINK_RE.sub(css_repl, html)
    html = SCRIPT_RE.sub(js_repl, html)
    return inline_photos(html, base)


def main() -> None:
    args = sys.argv[1:]
    if not args:
        source, output = DEFAULT_SOURCE, DEFAULT_OUTPUT
    else:
        source = Path(args[0]).resolve()
        output = Path(args[1]).resolve() if len(args) > 1 else source.with_suffix(".print.html")
    html = build(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    size_kb = output.stat().st_size / 1024
    try:
        shown = output.relative_to(ROOT)
    except ValueError:
        shown = output
    print(f"{shown} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
