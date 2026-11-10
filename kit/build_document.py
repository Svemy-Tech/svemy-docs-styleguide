#!/usr/bin/env python3
"""Build a finished document: one self-contained HTML file, then a PDF.

Usage:
    python build_document.py documents/<name>.html

Creates documents/<name>.print.html (styles, fonts and images inside) and then
tries to print documents/<name>.pdf with headless Chromium. The PDF step needs
Node.js and npm; it installs a bundled Chromium the first time, which can take
a minute. If the PDF cannot be made, the .print.html file is still there: hand
that over with the printing steps from START_HERE.md.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_standalone import build  # noqa: E402

WORK = Path(tempfile.gettempdir()) / "svemy-pdf"
PACKAGES = ["@sparticuz/chromium@153.0.0", "puppeteer-core@25.16.0"]


def run(cmd, timeout, env=None):
    return subprocess.run(cmd, cwd=WORK, env=env, capture_output=True, text=True, timeout=timeout)


def prepare_chromium() -> Path:
    """Install the browser package once and unpack it without changing file owners."""
    WORK.mkdir(parents=True, exist_ok=True)
    modules = WORK / "node_modules"
    if not (modules / "@sparticuz" / "chromium").is_dir() or not (modules / "puppeteer-core").is_dir():
        result = run([shutil.which("npm") or "npm", "install", "--no-audit", "--no-fund", "--prefix", str(WORK), *PACKAGES], timeout=300)
        if result.returncode != 0:
            raise RuntimeError("npm install failed: " + (result.stderr or result.stdout)[-300:])
    target = WORK / "chromium"
    if not (target / "chromium").is_file():
        target.mkdir(exist_ok=True)
        source = modules / "@sparticuz" / "chromium" / "bin"
        for packed in source.glob("*.br"):
            data = brotli_decompress(packed.read_bytes())
            out = target / packed.name[:-3]
            out.write_bytes(data)
            if out.suffix == ".tar":
                result = subprocess.run(["tar", "--no-same-owner", "-xf", str(out)], cwd=target,
                                        capture_output=True, text=True, timeout=120)
                if result.returncode != 0:
                    raise RuntimeError("unpacking failed: " + result.stderr[-300:])
        (target / "chromium").chmod(0o755)
    return target


def brotli_decompress(data: bytes) -> bytes:
    """Brotli is not in the Python standard library, so Node does it."""
    script = "process.stdout.write(require('zlib').brotliDecompressSync(require('fs').readFileSync(0)))"
    result = subprocess.run([shutil.which("node") or "node", "-e", script], input=data, capture_output=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError("brotli decompression failed")
    return result.stdout


def make_pdf(print_html: Path, pdf: Path) -> str:
    if not shutil.which("node") or not shutil.which("npm"):
        raise RuntimeError("Node.js is not available")
    env = dict(os.environ)
    chromium_dir = WORK / "chromium"
    if env.get("SVEMY_CHROME"):
        WORK.mkdir(parents=True, exist_ok=True)
        if not (WORK / "node_modules" / "puppeteer-core").is_dir():
            result = run([shutil.which("npm") or "npm", "install", "--no-audit", "--no-fund", "--prefix", str(WORK), PACKAGES[1]], timeout=300)
            if result.returncode != 0:
                raise RuntimeError("npm install failed: " + (result.stderr or result.stdout)[-300:])
    else:
        chromium_dir = prepare_chromium()
    env["NODE_PATH"] = str(WORK / "node_modules")
    result = subprocess.run([shutil.which("node") or "node", str(HERE / "render_pdf.js"), str(print_html), str(pdf), str(chromium_dir)],
                            env=env, capture_output=True, text=True, timeout=180)
    message = (result.stdout + result.stderr).strip().splitlines()
    if result.returncode != 0 or not pdf.is_file():
        raise RuntimeError(message[-1] if message else "the browser did not produce a PDF")
    return message[-1]


PLACEHOLDER = re.compile(r"\[(?:[A-Z][^\[\]<>]*[a-z][^\[\]<>]*|\$[0-9,.]+ CAD)\]")


PHOTO_MARK = re.compile(r"\[(?:photo|photos|image|picture|img|fig(?:ure)?)\b[^\[\]<>]*\]", re.I)
LOCAL_IMG = re.compile(r'<img\b[^>]*?\bsrc="(?!data:|https?:|//)([^"]+)"', re.S)


def photo_problems(text: str, base: Path) -> list:
    """Photo marks left in the text, and photos that are missing or unreadable."""
    problems = []
    marks = sorted(set(PHOTO_MARK.findall(text)))
    if marks:
        problems.append("Photo marks are left: " + ", ".join(marks[:8]) + ". Put the photo each one "
                        "names in its place. If the person has not attached that photo, ask them to "
                        "attach it and wait; never use another photo instead.")
    missing, unreadable = [], []
    for src in sorted(set(LOCAL_IMG.findall(text))):
        path = (base / src).resolve()
        if not path.is_file():
            missing.append(src)
            continue
        try:
            from PIL import Image
        except ImportError:
            continue
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception:  # noqa: BLE001 - any failure means the photo cannot be used
            unreadable.append(src)
    if missing:
        problems.append("Photo files not found: " + ", ".join(missing) + ". Copy each attached photo "
                        "into documents/images/. If the person has not attached it, ask them to "
                        "attach it and wait.")
    if unreadable:
        problems.append("Photos that cannot be read: " + ", ".join(unreadable) + ". Ask the person "
                        "to send them as JPG or PNG.")
    return problems


BOLD_PARAGRAPH = re.compile(r"<p(?:\s[^>]*)?>\s*<(strong|b)>([^<]*)</\1>\s*</p>", re.S)
HEADING = re.compile(r"<h([2-5])\b([^>]*)>(.*?)</h\1>", re.S)


def heading_problems(text: str) -> list:
    """Lines set in bold instead of as headings, and headings the contents cannot list."""
    problems = []
    bold = [re.sub(r"\s+", " ", m.group(2)).strip() for m in BOLD_PARAGRAPH.finditer(text)]
    if bold:
        problems.append("Paragraphs set entirely in bold: " + "; ".join(f'"{b[:60]}"' for b in bold[:6])
                        + ". A line that names what follows is a heading: make it h3, h4 or h5 at its "
                        "level, with an id in the proposal, so it stays with its text and appears in the "
                        "contents. Bold is only for a few words inside a sentence, or a label that starts "
                        "a paragraph and is followed by its text.")
    flow = re.search(r"<section\b[^>]*\bdata-toc-sections\b[^>]*>(.*?)</section>", text, re.S)
    if flow:
        pages = len(re.findall(r'<section\b[^>]*class="[^"]*\bpage\b', text))
        if pages != 2:
            problems.append(f"The document has {pages} pages in its file. It must keep only the template's two: "
                            "the cover with the contents (and the introduction under it) and the content page. "
                            "Move everything else into those two and delete the pages you added.")
        unnumbered = [re.sub(r"<[^>]+>|\s+", " ", m.group(3)).strip()
                      for m in HEADING.finditer(flow.group(1))
                      if m.group(1) == "2" and not re.match(r"\s*\d{1,2}\. ", re.sub(r"<[^>]+>", "", m.group(3)))]
        marked = [re.sub(r"<[^>]+>|\s+", " ", m.group(3)).strip()
                  for m in HEADING.finditer(flow.group(1))
                  if m.group(1) in "345" and re.match(
                      r"\s*(\d+(\.\d+)*\.\s|\d+\.\d+(\.\d+)*\s|[a-z]\.\s|(i|ii|iii|iv|v|vi|vii|viii|ix|x)\.\s)",
                      re.sub(r"<[^>]+>", "", m.group(3)), re.I)]
        if marked:
            problems.append("Subsection, topic and point headings that start with a number or letter: "
                            + "; ".join(f'"{h[:60]}"' for h in marked[:6])
                            + ". Type them without it: the contents numbers subsections and topics itself.")
        if unnumbered:
            problems.append("Section headings not numbered 1., 2., ...: "
                            + "; ".join(f'"{h[:60]}"' for h in unnumbered[:6])
                            + ". Number every section h2 in order, for example \"1. Design-Build Capability\".")
        missing = [re.sub(r"<[^>]+>|\s+", " ", m.group(3)).strip()
                   for m in HEADING.finditer(flow.group(1)) if not re.search(r"\bid=", m.group(2))]
        if missing:
            problems.append("Headings without an id, so the contents cannot list them: "
                            + "; ".join(f'"{h[:60]}"' for h in missing[:6])
                            + ". Give each heading a unique id.")
    return problems


def layout_problems(text: str) -> list:
    """The proposal cover's lines and table captions."""
    problems = []
    cover = re.search(r'<div class="cover-opening">(.*?)<dl\b', text, re.S)
    if cover and re.search(r"data-toc-sections", text):
        lines = re.findall(r"<p\b[^>]*>(.*?)</p>", cover.group(1), re.S)
        if len(lines) > 1:
            problems.append("The cover has more than one line under the title: "
                            + "; ".join(f'"{re.sub(r"<[^>]+>|\s+", " ", l).strip()[:50]}"' for l in lines)
                            + ". Keep only the project location; the document type is in the page header.")
    untitled = []
    for cap in re.findall(r"<caption\b[^>]*>(.*?)</caption>", text, re.S):
        number = re.search(r'<span class="table-title-number">(.*?)</span>', cap, re.S)
        rest = re.sub(r'<span class="table-title-number">.*?</span>|<[^>]+>|&[a-z]+;|\s+', "", cap)
        if not rest:
            untitled.append(number.group(1).strip() if number else "a table")
    if untitled:
        problems.append("Tables without a title: " + ", ".join(untitled[:8]) + ". Give each caption a short "
                        "title after its number, from what the table lists.")
    return problems


def check(html: str, no_contract_number: bool, base: Path) -> list:
    """Problems that must be fixed before a document is built."""
    text = re.sub(r"<!--.*?-->|<script\b.*?</script>|<style\b.*?</style>", "", html, flags=re.S)
    problems = photo_problems(text, base) + heading_problems(text) + layout_problems(text)
    left = sorted(set(PLACEHOLDER.findall(text)))
    if left:
        problems.append("Placeholders are left: " + ", ".join(left[:8])
                        + ". Replace each with content from the person's text, or remove its line.")
    if re.search(r"lorem ipsum|consectetur adipiscing", text, re.I):
        problems.append("Lorem ipsum text is left. Replace it with content from the person's text.")
    header = re.search(r'<header class="[^"]*page-header-doc[^"]*">.*?</header>', text, re.S)
    if header and "page-header-meta" not in header.group(0) and not no_contract_number:
        problems.append("The header has no contract or proposal number. Ask the person for it and wait "
                        "for the answer. Only if they confirm there is none, run this again with "
                        "--no-contract-number.")
    return problems


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    if len(args) != 1 or any(f != "--no-contract-number" for f in flags):
        sys.exit("usage: python build_document.py documents/<name>.html [--no-contract-number]")
    source = Path(args[0]).resolve()
    problems = check(source.read_text(encoding="utf-8"), "--no-contract-number" in flags, source.parent)
    if problems:
        print("STOP: the document is not built. Fix this first:")
        for problem in problems:
            print(f"- {problem}")
        sys.exit(2)
    print_html = source.with_suffix(".print.html")
    print_html.write_text(build(source), encoding="utf-8")
    print(f"HTML: {print_html}")

    pdf = source.with_suffix(".pdf")
    if pdf.exists():
        pdf.unlink()
    try:
        status = make_pdf(print_html, pdf)
        print(f"PDF: {pdf} ({status})")
    except Exception as error:  # noqa: BLE001 - any failure falls back to the HTML
        print(f"PDF NOT MADE: {error}")
        print("Hand over the .print.html file with the printing steps from START_HERE.md.")


if __name__ == "__main__":
    main()
