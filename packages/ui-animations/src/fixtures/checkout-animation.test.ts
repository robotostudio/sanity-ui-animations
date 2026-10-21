import { describe, expect, it } from "vitest";

import { sceneValidation } from "../sanity";
import { checkoutAnimation } from "./checkout-animation";

describe("checkoutAnimation (the seeded document)", () => {
  it("is a published animation at /animations/checkout-flow", () => {
    expect(checkoutAnimation).toMatchObject({
      _id: "animation-checkout",
      _type: "animation",
      title: "Checkout flow",
      slug: { _type: "slug", current: "checkout-flow" },
      prompt: "Show our checkout flow, and adding discounts to cart",
      generationMode: "fast",
    });
    expect(checkoutAnimation._id.startsWith("drafts.")).toBe(false);
  });

  it("passes the Studio's publish gate", () => {
    expect(sceneValidation(checkoutAnimation.scene, "error")).toBe(true);
  });

  it("types every array item as the Studio schema does", () => {
    const { scene } = checkoutAnimation;
    const types = [
      ...scene.windows.map((window) => window._type),
      ...scene.windows.flatMap((window) =>
        window.elements.map((element) => element._type)
      ),
      ...scene.connectors.map((connector) => connector._type),
      ...(scene.cursor?.targets ?? []).map((target) => target._type),
      ...scene.steps.map((step) => step._type),
    ];
    expect(new Set(types)).toEqual(
      new Set([
        "sceneWindow",
        "sceneElement",
        "sceneConnector",
        "cursorTarget",
        "sceneStep",
      ])
    );
    expect(types).not.toContain(undefined);
  });

  it("carries compiled code, so the website can prove it never leaks", () => {
    expect(checkoutAnimation.reactCode).toContain(
      "export default function SceneAnimation()"
    );
    expect(checkoutAnimation.reactCode).toContain(
      JSON.stringify(checkoutAnimation.scene.label)
    );
  });
});
