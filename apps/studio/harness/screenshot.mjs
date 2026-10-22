/**
 * Screenshots every harness state at 1280×900.
 *
 *   pnpm --filter studio harness            # in one terminal
 *   node apps/studio/harness/screenshot.mjs /tmp/shots/ux-
 *
 * The argument is an output prefix: files land as
 * `<prefix><state>-<scheme>.png`. A trailing `/` makes it a directory.
 * HARNESS_URL overrides http://localhost:3334.
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";

/** Playwright is a dependency of apps/web (`@playwright/test`), not the Studio. */
function loadPlaywright() {
  const places = [import.meta.url, new URL("../../web/", import.meta.url)];
  for (const from of places) {
    for (const name of ["playwright", "@playwright/test"]) {
      try {
        return createRequire(from)(name);
      } catch {
        // Try the next one.
      }
    }
  }
  throw new Error("Playwright not found. Run `pnpm install` at the root.");
}

const prefix = process.argv[2];
if (!prefix) {
  process.stderr.write("Usage: screenshot.mjs <output-prefix>\n");
  process.exit(1);
}
mkdirSync(prefix.endsWith("/") ? prefix : dirname(prefix), {
  recursive: true,
});

const base = process.env.HARNESS_URL ?? "http://localhost:3334";
const STATES = ["empty", "loading", "regenerating", "success", "error"];
const PRESSES_GENERATE = new Set(["loading", "regenerating", "error"]);
const SCHEMES = ["light", "dark"];

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
});

for (const scheme of SCHEMES) {
  for (const state of STATES) {
    await page.goto(`${base}/?state=${state}&scheme=${scheme}`);
    await page.waitForLoadState("networkidle");
    if (PRESSES_GENERATE.has(state)) {
      await page
        .getByRole("button", { name: /^(re)?generate$/i })
        .first()
        .click();
    }
    // Let the run report progress, or the scene play to its rest state.
    await page.waitForTimeout(state === "success" ? 6000 : 800);
    const file = `${prefix}${state}-${scheme}.png`;
    await page.screenshot({ path: file });
    process.stdout.write(`${file}\n`);
  }
}

// The Fields view (the form) keeps the same controls; one shot per scheme.
for (const scheme of SCHEMES) {
  await page.goto(`${base}/?state=success&scheme=${scheme}&view=form`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(6000);
  const file = `${prefix}form-success-${scheme}.png`;
  await page.screenshot({ path: file });
  process.stdout.write(`${file}\n`);
}

await browser.close();
