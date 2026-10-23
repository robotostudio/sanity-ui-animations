import { checkoutScene } from "@sanity-ui-animations/ui-animations/fixtures/checkout";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveAnimationScene } from "@/lib/animation-scene";

import { AnimationView } from "./animation-view";

const brokenScene = {
  ...checkoutScene,
  steps: [
    ...checkoutScene.steps,
    { ...checkoutScene.steps[0]!, _key: "s-dangling", target: "nowhere" },
  ],
  windows: [
    ...checkoutScene.windows,
    { ...checkoutScene.windows[0]!, _key: "w-dupe" },
  ],
};

describe("AnimationView", () => {
  it("renders a valid scene as one labelled image", () => {
    const html = renderToStaticMarkup(
      <AnimationView
        scene={resolveAnimationScene(checkoutScene)}
        title="Checkout"
      />
    );

    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${checkoutScene.label}"`);
    expect(html).toContain("Wireless headphones");
  });

  it("renders the neutral fallback, not the scene, when validation fails", () => {
    const html = renderToStaticMarkup(
      <AnimationView
        scene={resolveAnimationScene(brokenScene)}
        title="Checkout"
      />
    );

    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("Wireless headphones");
    expect(html).toContain("Checkout");
    expect(html).toContain("This animation isn’t available right now.");
  });

  it("renders the fallback when the document has no scene", () => {
    const html = renderToStaticMarkup(
      <AnimationView scene={resolveAnimationScene(null)} title="Checkout" />
    );

    expect(html).not.toContain('role="img"');
    expect(html).toContain("This animation isn’t available right now.");
  });
});
