#!/usr/bin/env python3
"""Build a single self-contained HTML file from svemy_styleguide.html.

Inlines every css/*.css <link>, js/*.js <script src>, and every font
referenced from the CSS (as base64 data URIs), so the result can be
attached to an AI chat or opened from anywhere without its folders.

Usage (from the repo root):
    python3 scripts/build_standalone.py
Output:
    dist/svemy_styleguide.standalone.html
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "svemy_styleguide.html"
OUTPUT = ROOT / "dist" / "svemy_styleguide.standalone.html"

LINK_RE = re.compile(r'^(\s*)<link rel="stylesheet" href="([^"]+)"\s*/>\s*$', re.M)
SCRIPT_RE = re.compile(r'^(\s*)<script src="([^"]+)"></script>\s*$', re.M)
URL_RE = re.compile(r'url\("(?!data:)([^"]+)"\)')
MIME = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
        ".svg": "image/svg+xml", ".png": "image/png"}


def read(path: Path) -> str:
    if not path.is_file():
        sys.exit(f"error: missing file {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def inline_urls(css: str, css_path: Path) -> str:
    def repl(m: re.Match) -> str:
        asset = (css_path.parent / m.group(1)).resolve()
        if not asset.is_file():
            sys.exit(f"error: missing asset {m.group(1)} referenced in {css_path.name}")
        mime = MIME.get(asset.suffix)
        if mime is None:
            sys.exit(f"error: unknown asset type {asset.suffix}")
        data = base64.b64encode(asset.read_bytes()).decode("ascii")
        return f'url("data:{mime};base64,{data}")'
    return URL_RE.sub(repl, css)


def indent(text: str, pad: str) -> str:
    return "".join(pad + line if line.strip() else line
                   for line in text.splitlines(keepends=True))


def main() -> None:
    html = read(SOURCE)

    def css_repl(m: re.Match) -> str:
        path = ROOT / m.group(2)
        css = inline_urls(read(path), path)
        pad = m.group(1)
        return f"{pad}<style>\n{indent(css, pad + '  ')}{pad}</style>\n"

    def js_repl(m: re.Match) -> str:
        js = read(ROOT / m.group(2))
        pad = m.group(1)
        return f"{pad}<script>\n{indent(js, pad + '  ')}{pad}</script>\n"

    html = LINK_RE.sub(css_repl, html)
    html = SCRIPT_RE.sub(js_repl, html)

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"{OUTPUT.relative_to(ROOT)} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
