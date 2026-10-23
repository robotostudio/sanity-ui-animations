import { expect, type Page, test } from "@playwright/test";
import { checkoutAnimation } from "@sanity-ui-animations/ui-animations/fixtures/checkout-animation";

/**
 * The checkout animation `pnpm seed:checkout` writes, read back through the
 * real route. Needs that seed in the dataset the site reads; skips otherwise.
 */

const PATH = `/animations/${checkoutAnimation.slug.current}`;
const { label } = checkoutAnimation.scene;

/**
 * Lines only the compiled component has: template code, not scene data, so
 * none of them can appear in the page by way of the scene's own props.
 */
const COMPILED_CODE_MARKERS = checkoutAnimation.reactCode
  .split("\n")
  .map((line) => line.trim())
  .filter(
    (line) => line.length > 20 && /\b(SCENE|THEME)\b|function /.test(line)
  );

async function openSeeded(page: Page) {
  const response = await page.goto(PATH);
  test.skip(
    response?.status() === 404,
    `${PATH} is not published here; run \`pnpm seed:checkout\` first`
  );
  expect(response?.status()).toBe(200);
  return response;
}

test.describe("Animation: checkout flow", () => {
  test("renders the seeded scene as one labelled image", async ({ page }) => {
    await openSeeded(page);

    await expect(
      page.getByRole("heading", { level: 1, name: checkoutAnimation.title })
    ).toBeVisible();
    const scene = page.getByRole("img", { name: label, exact: true });
    await expect(scene).toBeVisible();
    await expect(scene.locator("> [aria-hidden='true']")).toHaveCount(1);
    await expect(scene).toContainText("shop.example.com/cart");
    await expect(scene).toContainText("Apply discount");
    await expect(page).toHaveTitle(/Checkout flow/);
  });

  test("is listed on the animations index", async ({ page, request }) => {
    const seeded = await request.get(PATH);
    test.skip(
      seeded.status() === 404,
      `${PATH} is not published here; run \`pnpm seed:checkout\` first`
    );
    await page.goto("/animations");

    await expect(
      page.locator(`main a[href="${PATH}"]`, {
        hasText: checkoutAnimation.title,
      })
    ).toBeVisible();
  });

  test("never ships the compiled reactCode or any script from the scene", async ({
    page,
    request,
  }) => {
    expect(COMPILED_CODE_MARKERS.length).toBeGreaterThan(5);
    await openSeeded(page);
    await expect(page.getByRole("img", { name: label })).toBeVisible();

    // Both the server's HTML (with its RSC payload) and the hydrated DOM.
    const served = await (await request.get(PATH)).text();
    const hydrated = await page.content();
    for (const html of [served, hydrated]) {
      expect(html).toContain("Apply discount");
      expect(html).not.toContain("reactCode");
      for (const marker of COMPILED_CODE_MARKERS) {
        expect(html, marker).not.toContain(marker);
      }
    }

    // Scripts are the app's own: same-origin bundles from /_next/ (and
    // Vercel Analytics' /_vercel/), or Next's inline payload.
    const scripts = await page.locator("script").evaluateAll((nodes) =>
      nodes.map((node) => ({
        src: node.getAttribute("src"),
        text: node.textContent ?? "",
      }))
    );
    for (const { src, text } of scripts) {
      if (src) {
        const url = new URL(src, page.url());
        expect(url.origin, src).toBe(new URL(page.url()).origin);
        expect(url.pathname, src).toMatch(/^\/(_next|_vercel)\//);
      }
      expect(text).not.toContain("SceneAnimation");
    }
    // No code surface, and no frame a preview could run in.
    await expect(page.locator("main pre, main code, main iframe")).toHaveCount(
      0
    );
  });
});
