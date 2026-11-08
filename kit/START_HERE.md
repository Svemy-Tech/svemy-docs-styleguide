# SVEMY document kit: start here

You turn a person's text into a branded SVEMY Construction Ltd. document. Read this whole file before you write anything. Follow it exactly: the look of the document comes entirely from the templates and styles in this kit, and your job is the content.

## The kit

| Path | What it is |
|---|---|
| `templates/` | One HTML template per document type. Start every document from one of them. |
| `svemy_styleguide.html` | The reference of every block you may use: tables, lists, callouts, badges, checkboxes, images, signatures. Copy blocks from here. |
| `css/`, `js/`, `fonts/`, `assets/` | Styles, the page layout script, fonts and images. Never edit them. |
| `build_document.py` | Turns a finished document into a PDF, and into one HTML file as a fallback. Uses `build_standalone.py` and `render_pdf.js`. |
| `documents/` | Save new documents here. |

## Workflow

1. **Unzip the kit** and read this file.
2. **Pick the template.** Use the one the person names. If they name none, pick it from the catalog below by the kind of document. If two could fit, ask which one.
3. **Read the person's text** and match it to every field and placeholder of the template.
4. **Ask before you write.** List everything required that the text does not give, and ask for all of it in one message, including any photo the text marks but the person has not attached and any fact that contradicts another (see "Check the text"). Never guess a value. See "Missing information" below.
5. **Write the document.** Copy the template to `documents/<short-name>.html` and fill it in, following the rules below. Keep the file in `documents/`, so its links to `css/` and `js/` keep working.
6. **Check it** against the checklist at the end.
7. **Build it:** run `python build_document.py documents/<short-name>.html`. It creates `documents/<short-name>.print.html` and then prints `documents/<short-name>.pdf` with a headless browser. The first run in a chat installs that browser and can take a minute or two; do not stop it. If it stops with `STOP:`, nothing was built: do what it lists and run it again. Add `--no-contract-number` only after the person has confirmed there is no contract or proposal number.
8. **Hand it over:**
   - If the output has a `PDF:` line, give the person the `.pdf` file as a download. That is the finished document; they need nothing else. Never make a PDF any other way: not with your own code, other libraries or the chat's "Convert to PDF", because only `build_document.py` keeps the layout.
   - If the output says `PDF NOT MADE`, give the person the `.print.html` file as a download with the printing steps at the end of this file, and tell them plainly to open it in Google Chrome, not in the chat preview.
   - Do not change the scripts, styles or browser settings to force a PDF.
   - With the PDF, list the sections you made yourself (see "Text without numbering"), the numbering you corrected and any facts that do not agree (see "Check the text").

## Template catalog

| Template file | Use it for | Notes |
|---|---|---|
| `request-for-information.html` | A request for information (RFI) to a client or consultant | The title "Request for Information" is fixed. `[Brief description]` is the subject. The text goes under `Comments:`. |
| `memorandum.html` | A memo that sets out a position or a record | The title is the memo's subject. |
| `extension-justification.html` | A request to extend a completion date, with its reasons | The title is the subject; the subtitle under it is the project name. |
| `final-settlement-agreement.html` | A settlement or other agreement between SVEMY and another party | Amounts in bold. Ends with the Signature Block. |
| `transmittal-form.html` | A transmittal that sends documents for review | Has issue status and format checkboxes. `Prepared by` is whoever prepared it, not SVEMY by default. |
| `shop-drawing.html` | A shop drawing submission | The same layout as the transmittal form. |
| `technical-commercial-proposal.html` | A long proposal: technical, commercial or both | Contents on the first page, built automatically. Optional cover drawing or cover photo, and an optional introduction under the contents. The document has only the template's two pages: never add a page of your own. The document type in every page header is `Technical & Commercial Proposal`, `Technical Proposal` or `Commercial Proposal`, as the text says; the same on every page. |

## Content rules

- **Use only the person's text.** Never invent facts, names, dates, amounts, numbers, clauses or references. If something is missing, ask, or leave the line out where the rules below allow it.
- **Replace every placeholder.** Every `[...]` in a template is a placeholder: replace it with real content or remove its line. Remove all Lorem ipsum. A finished document has no `[` placeholders and no Lorem ipsum.
- **Keep the fixed text** of a template, such as field labels and the document type in the header.
- **Write in Canadian English:** Canadian spelling (`colour`, `centre`, `labour`, `licence` as a noun); dates as `September 9, 2026`; amounts as `$25,000.00 CAD`; a space before units (`25 mm`, `3,000 m²`).
- **Amounts of money** in running text go in `<strong>`.
- **Emphasis:** `<strong>` is the only emphasis in body text. Do not underline or color text.

## Missing information

Ask only for fields the chosen template has. If the text gives something the template has no field for (such as a recipient in an RFI), do not add a field for it; keep it in the text only where the text itself says it.

| Field | If the text does not give it |
|---|---|
| Contract number | Ask the person. If they confirm there is none, use the header without a number (below) and remove the contract number row from the field list. Never write N/A or make one up. |
| Proposal number | The same as the contract number. |
| Date | Ask. Do not use today's date unless the person says so. |
| Prepared by | Use `Vladan Myska` in the RFI, memorandum, extension justification and proposal, unless the text names someone else. In the transmittal form and shop drawing, use the company and person from the text, or ask. |
| Recipient, client, project name, other party | Ask. |
| Specification reference | Write `N/A` only if the person says there is none. |
| Revision | Use `0` for a first issue, unless the text says otherwise. |
| Photo marked in the text but not attached | Ask the person to attach it. Never leave the mark in the document and never use another photo instead. |

**Header without a contract number.** Replace the `page-header-meta` block with a single line:

```html
<p class="type-h4 page-header-type">Request for Information</p>
```

## Structure rules

- **Never change the styling.** Do not add `<style>`, `style="..."` attributes, scripts, fonts or new class names. Use only the classes in the templates and in `svemy_styleguide.html`.
- **Copy blocks from the styleguide.** For a table, list, callout, badge, card, image, quote or reference, copy its markup from `svemy_styleguide.html` and change only the text.
- **Figures go in a table.** When the text compares several figures, such as tender against actual, planned against completed, quantities, rates or amounts, set them out in a table rather than in sentences. Use the Text table for label and description rows and the Cost table for quantities and money, both from `svemy_styleguide.html`, each with a numbered caption (`Table 01`, `Table 02`). The text around it says what the figures show; it does not repeat them all. This does not apply to lettered items (below).
- **Table captions.** Every table has a caption with its number and a short title: `Table 01`&emsp;`Preliminary structural basis`. If the text gives no title, write one from what the table lists. Keep a table whole; if it must be split, both parts keep the same number and the second title ends with `(continued)`.
- **Sections.** A template shows one section as an example. Repeat it for each section the text needs, numbered in order: `01.`, `02.`, `03.`. Section headings inside a document are `<h2>`.
- **Proposal sections.** In the proposal, all sections go in the one `<section class="page" id="content" data-toc-sections>` page, one after another. Each section starts on a new page by itself; subsections and topics follow on without breaks. Each section is `<h2 id="section-NN">NN. Title</h2>`, subsections `<h3 class="subsection-title" id="...">`, topics `<h4 id="...">` and points `<h5 id="...">`; every id must be unique. The contents on the first page fills itself from these headings: never type it.
- **Headings are headings.** Every line that names the text after it is a heading at its level, never a paragraph set in bold. Only a real heading stays with its text at a page break and appears in the contents. The build stops on a paragraph that is all bold.
- **Pages break by themselves.** Do not add page breaks or empty space. Put flowing text directly in `<main>`, not inside `<article class="subsection">`, because an article never splits across pages.
- **Headings.** Subsection titles in Title Case; topic (`<h4>`) and point (`<h5>`) headings in sentence case.

## Check the text

Read the whole text for mistakes before you write, and treat them in two ways:

- **Structure and numbering: correct them yourself.** The document always uses the SVEMY numbering, whatever the text uses. Numbers that skip (`1, 2, 4`), repeat, run out of order, a level typed wrongly (`2.1` under section 3, a subsection numbered like a section), roman numerals or mixed styles (`1.`, `a)`, `II.` side by side) are typing slips: put each part at the level its meaning gives it, keep the person's order and wording, and number it correctly. List what you corrected with the PDF.
- **Facts: never correct them on a guess.** Amounts that do not add up, a total that differs from its items, dates or names written two ways, a reference to a table, figure or attachment that is not there: ask the person before you write. If you notice one only later, point it out with the PDF and do not choose a value yourself.

## Text with its own structure (RFP responses)

When the text follows the structure of a request for proposal (`Category 1`, `1. Project Examples`, `a. Concept Proposal document`, `i. Description of any design assumptions`), keep its order and titles, but number it the SVEMY way: the contents numbers the headings itself, as in `svemy_styleguide.html`.

- **Levels.** Each category is a section `<h2>` numbered `01.`, `02.` in the same order: `Category 1 Design-Build Capability and Experience` becomes `01. Design-Build Capability and Experience`. A numbered item under it (`1. Project Examples`) is a subsection `<h3>`, a lettered item or named part under that (`a. Concept Proposal document`, `Project 1 Hector Gorge Salt Shed Replacement`) a topic `<h4>`, and a roman item (`i. Description of any design assumptions`) a point `<h5>`. Type subsection, topic and point titles without their RFP number or letter: the contents numbers them.
- **Unnumbered headings in the text** (`Operating use and building geometry`, `RMEI Structural engineering`) are one level below the heading they sit under.
- **No numbers or letters in subsection, topic and point headings.** Not `1.`, `a.`, `i.`, `II.` and not roman numerals: the contents numbers subsections and topics itself, and points are not numbered. The build stops on a heading that starts with one.
- **Text already in SVEMY numbering** (`01. Title`, `1.1 Title`, `1.1.1 Title`): `01.` is the section `<h2>` with its number, `1.1` a subsection `<h3>` and `1.1.1` a topic `<h4>`, both typed without the number; a short unnumbered heading line under a topic is a point `<h5>`.
- **The contents** lists sections and subsections (`01.`, `1.1.`). In the text, subsections and topics show their numbers (`1.1.`, `1.1.1.`) by themselves; points (`<h5>`) have none.
- **Keep the order and every item.** Do not merge, drop or reorder items.
- **Lettered items stay lettered.** Items such as `a. Project name and location. ...`, `b. Owner. ...` are paragraphs in their order, each starting with its label in `<strong>` followed by its text: `<p><strong>a. Project name and location.</strong> Hector Gorge Salt Shed Replacement, ...</p>`. Do not move them into a table and do not drop, merge or renumber any of them.
- **Text before the first section,** such as how the submission is organized, is the introduction under the contents on the first page, under the heading the text gives it (or `Introduction`). Keep the heading: when the introduction fits under the contents the heading is hidden by itself, and it shows only when the introduction moves on to its own page. If there is no such text, delete the introduction heading and text. The first section always starts on the next page by itself.

## Text without numbering

When the text has no sections or numbering of its own, divide it yourself, in the SVEMY numbering (`01.`, `1.1.`, `1.1.1.`):

- **Keep the order.** Group the text by topic as it runs; never move paragraphs to another place.
- **Titles from the text.** Each heading is short and uses the text's own words. It adds no facts and no selling phrases.
- **Depth by length.** A short text has sections only. Add subsections only where a section has at least two separate topics: never a single subsection under a section. Topics (`<h4>`) only in long sections.
- **Report.** With the PDF, list the sections and subsections you made (`01. Background`, `02. Schedule`, ...), so the person can ask to merge, split or rename them.

## Special blocks

- **Checkboxes** (transmittal form, shop drawing): add `checked` to the options the text states, and remove it from the rest. If the text does not say, ask.
- **Signature Block** (agreements): one party after another. Fill `Name` and `Title` from the text; leave `Date` and `Signature` empty for handwriting. Remove the statement of authority if the person signs only for themselves. Keep the heading, the opening sentence and the block together, as in the template.
- **Cover drawing** (proposal only): add `cover-art-building` or `cover-art-bridge` to the first page's `class` only when the text clearly shows the project is a building or a bridge. Otherwise leave the cover plain. Keep the `cover-opening` wrapper either way.
- **Cover photo** (proposal only): when the person gives a photo or illustration for the cover, put it inside the `cover-opening`, right after the title, as `<figure class="cover-photo"><img src="images/<file name>" alt="..." /></figure>`, as Cover Photo in `svemy_styleguide.html`. It stands beside the subtitle and fields. Use either cover art or a cover photo, never both. Write no caption or description of the image anywhere on the cover, and keep the cover fields as in the template (`Prepared for`, `Prepared by`, `Date`).
- **Cover text** (proposal): the title, then one line under it, the project location. Do not repeat the document type (`Design Build Technical Proposal`): it is in the page header. The build stops on any other line. It has no caption and no figure number, and the figures inside the document start at `Figure 01` without it. Where the text refers to it, call it the cover photo or the cover illustration.
- **Status badges.** The badge's text is the status itself, in the person's words where they fit: `badge-success` for done (`Completed`), `badge-warning` for not started or waiting (`Pending`), `badge-danger` for late or blocked (`Delayed`), `badge-primary` for under way (`In progress`), `badge-neutral` for anything else (`Open`, `Mitigated`). Never write the class name, such as `Primary`, as the text. The badge is the status column: do not add another column that repeats it in words.

## Photos

The person attaches photos to the chat together with the text.

- **Where they go.** The text may mark a place with `[photo 1]`, `[photo 2: caption]` or `[photo 3 + photo 4]`. The number is the order in which the photos were attached; a file name such as `[IMG_2041]` also works. `+` means side by side. Put each photo exactly where its mark is and remove the mark. Without marks, place each photo by what it shows, next to the text about the same thing.
- **Files.** Copy each photo into `documents/images/` under its own file name and link it as `images/<file name>`. The build makes photos smaller and turns them upright by itself.
- **Layout.** Copy the markup from Image Layouts in `svemy_styleguide.html`: one photo on its own is the Feature Image; two photos side by side, or a photo standing upright, go in the Two-Column Gallery; three or more go in pairs in Two-Column Galleries. The photos are cropped to the frame, so do not use them for drawings or documents that must show whole.
- **Numbers and captions.** Every photo is a figure: `Figure 01`, `Figure 02` in order through the document. Use the person's caption when they give one. Without one, write a short caption of only what the photo plainly shows (`Steel truss on the north bank`), never dates, places, names or facts that the photo and the text do not give.
- **Report.** When you hand over the PDF, list each photo with its figure number, where you put it and its caption, so the person can ask for changes, for example `Figure 02 (IMG_2041): section 04.2, "East abutment formwork"`.

## Changes after the PDF

When the person asks for changes to a document you have handed over:

- **Change only what they ask.** Edit the same file in `documents/`, build it again with `build_document.py` and give the new PDF. Keep every other word, number, photo and caption as it was.
- **List every change,** one line each, in the order they asked, for example `4.2 Price: Site restoration $38,000 → $48,000`.
- **Name what changed as a result,** on its own lines: a total recalculated, figures or tables numbered anew, headings renamed in the contents, a section that moved to another page.
- **Ask before a change that contradicts another fact** in the document, such as a new date that differs from the schedule, instead of choosing which one to keep.
- If the file in `documents/` is gone (the chat lost its working files), say so and ask the person to send the text again; do not rebuild the document from memory.

## Checklist before you build

- [ ] No `[` placeholders and no Lorem ipsum are left.
- [ ] Every fact comes from the person's text or their answers.
- [ ] Contract or proposal number is filled in, or removed after the person confirmed there is none.
- [ ] Sections are numbered `01.`, `02.`, ... without gaps.
- [ ] No new styles, classes or inline styles were added.
- [ ] Every photo mark is replaced by its photo, every photo is in `documents/images/`, and the figures are numbered in order.
- [ ] Every line that names the text after it is a heading, not a bold paragraph; in the proposal, every heading has an id.
- [ ] The proposal has only the template's two pages, the cover with the contents and the content page.
- [ ] The file is in `documents/` and links `../css/` and `../js/` as the template does.

## Printing steps for the person

Only when no PDF was made, give the person these steps with the `.print.html` file:

1. **Download** the `.print.html` file and open it from your computer in **Google Chrome**. Do not print from the preview inside the chat, and do not use the chat's "Convert to PDF": both change the document.
2. Wait a moment until the pages appear.
3. Press **Ctrl+P** (Cmd+P on a Mac).
4. Destination: **Save as PDF**. Paper size: **Letter**. Margins: **None**. Under More settings, turn **Background graphics** on.
5. Click **Save**.
