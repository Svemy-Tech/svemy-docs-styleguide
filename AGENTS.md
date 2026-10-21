# SVEMY document styleguide — agent guide

Styleguide that AI agents use as a block library to generate branded SVEMY Construction Ltd. PDF documents (printed from Chrome, US Letter). The target design system is described in `SVEMY-Document-System.md` (ask the user for the current copy if it is not in the repo).

## Layout

| Path | Contents |
|---|---|
| `svemy_styleguide.html` | Markup only: the pages (`<section class="page">`) and the block examples |
| `css/00-fonts.css` | `@font-face` for DINish Condensed and Geist (files in `fonts/`) |
| `css/01-tokens.css` | `:root` variables: fonts, base size, colour palette |
| `css/02-base.css` | Base screen styles, `@page`, page numbering, page view on screen |
| `css/03-page-chrome.css` | Page header/footer, cover page, description page |
| `css/04-typography.css` | Headings, paragraphs, inline text |
| `css/05-lists.css` | Ordered, unordered and check lists |
| `css/06-tables.css` | Tables and their variants |
| `css/07-components.css` | Callouts, badges, rules, code blocks, highlights, references |
| `css/08-palette.css` | Colour palette page (swatches) |
| `css/09-layout.css` | Quotes, cards, grids, image layouts, table of contents, document navigation |
| `css/10-print.css` | Print media rules and pagination enhancements (must stay last) |
| `js/paginator.js` | Automatic pagination and footer auto-fill |
| `fonts/` | Self-hosted woff2 files and OFL licences |
| `scripts/build_standalone.py` | Builds the single-file version |

CSS files load in prefix order and the cascade depends on it. Do not reorder files or move rules between files unless the task says so.

## Working rules

- **English only**: code, comments, file names and commit messages. No Cyrillic anywhere.
- **One branch**: work on `feature/new-design-upgrade`. Do not create branches or worktrees, do not merge, do not push.
- **Parallel work**: several agents may work in this folder at the same time. Each task names the files you own. Edit only those files.
- **Commits**: commit only your files, using explicit paths (`git add css/06-tables.css`). Never use `git add -A` or `git add .`. Never stash, reset or check out files you do not own.
- **Live server**: browser-sync already runs on http://localhost:3001 and reloads on changes to `*.html`, `css/`, `js/`, `fonts/` and `assets/`. Do not start, stop or restart it.
- **Ignored folders**: `old_versions/`, `reports/`, `research_notes/` and `dist/` are git-ignored. Do not commit them.

## Verifying a change

Print to PDF with headless Chrome and check the page count and the fonts:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf=/tmp/out.pdf http://localhost:3001/svemy_styleguide.html
pdfinfo /tmp/out.pdf | grep Pages
pdffonts /tmp/out.pdf
```

Look at the rendered pages (`pdftoppm -r 50 -png`) before you report a visual change as done.

## Standalone build

AI chats need one self-contained file:

```sh
python3 scripts/build_standalone.py   # -> dist/svemy_styleguide.standalone.html
```

The build inlines the CSS, the JS and the fonts (as base64).
