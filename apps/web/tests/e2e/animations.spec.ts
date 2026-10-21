import { expect, test } from "./fixtures";

test.describe("Smoke: animations", { tag: "@smoke" }, () => {
  test("index loads", async ({ page }) => {
    const response = await page.goto("/animations");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Animations" })
    ).toBeVisible();
  });

  test("each listed animation renders a labelled scene or the fallback", async ({
    page,
  }) => {
    await page.goto("/animations");
    const hrefs = await page
      .locator('main a[href^="/animations/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    test.skip(hrefs.length === 0, "No published animations in this dataset");

    for (const href of hrefs) {
      const response = await page.goto(href ?? "");
      expect(response?.status(), href ?? "").toBe(200);

      const scene = page.locator('main [role="img"][aria-label]');
      const fallback = page.getByText(
        "This animation isn’t available right now."
      );
      await expect(scene.or(fallback)).toBeVisible();
      // Compiled code stays in the Studio.
      await expect(page.locator("main pre, main code")).toHaveCount(0);
    }
  });

  test("unknown slug is a 404", async ({ page }) => {
    const response = await page.goto("/animations/does-not-exist-e2e");

    expect(response?.status()).toBe(404);
  });
});
