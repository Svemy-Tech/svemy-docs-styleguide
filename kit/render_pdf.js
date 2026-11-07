// Prints a built document (.print.html) to PDF with headless Chromium, after
// the page script has laid out the pages. Called by build_document.py.
//
// Usage: node render_pdf.js <input.print.html> <output.pdf> <chromium-dir>
// With SVEMY_CHROME set, that browser is used instead of the bundled one.
const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const [input, output, chromiumDir] = process.argv.slice(2);
  const puppeteer = require("puppeteer-core");

  let executablePath = process.env.SVEMY_CHROME;
  let args = ["--no-sandbox"];
  let env = process.env;
  if (!executablePath) {
    const mod = require("@sparticuz/chromium");
    const chromium = mod.default || mod;
    executablePath = path.join(chromiumDir, "chromium");
    args = chromium.args;
    env = {
      ...process.env,
      LD_LIBRARY_PATH: [path.join(chromiumDir, "lib"), process.env.LD_LIBRARY_PATH || ""].join(":"),
      FONTCONFIG_PATH: path.join(chromiumDir, "fonts"),
    };
  }

  const browser = await puppeteer.launch({ executablePath, args, env, headless: "shell" });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(input)).href, { waitUntil: "load", timeout: 60000 });
    // The page script adds this class once every page, the contents and the
    // page numbers are in place
    await page.waitForFunction(() => document.body.classList.contains("auto-paginated"), { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    const pages = await page.evaluate(() => document.querySelectorAll(".page").length);
    await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true });
    console.log(`PDF OK ${pages} pages`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.log(`PDF FAILED: ${error.message.split("\n")[0]}`);
  process.exit(1);
});
