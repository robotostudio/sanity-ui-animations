import { checkoutScene } from "@sanity-ui-animations/ui-animations/fixtures/checkout";
import { describe, expect, it } from "vitest";

import { resolveAnimationScene } from "./animation-scene";

describe("resolveAnimationScene", () => {
  it("renders a valid stored scene", () => {
    const result = resolveAnimationScene(checkoutScene);

    expect(result.renderable).toBe(true);
    expect(result.renderable && result.scene.label).toBe(checkoutScene.label);
  });

  it("normalises the stored scene before rendering it", () => {
    const { _key: _ignored, ...windowWithoutKey } = checkoutScene.windows[0]!;
    const result = resolveAnimationScene({
      ...checkoutScene,
      canvas: { size: 99_999 },
      windows: [windowWithoutKey, ...checkoutScene.windows.slice(1)],
    });

    expect(result.renderable).toBe(true);
    if (result.renderable) {
      expect(result.scene.canvas.size).toBe(1200);
      expect(result.scene.windows[0]?._key).toBeTruthy();
    }
  });

  it("refuses a scene that validateScene reports errors on", () => {
    const duplicate = { ...checkoutScene.windows[0]!, _key: "w-dupe" };
    const result = resolveAnimationScene({
      ...checkoutScene,
      windows: [...checkoutScene.windows, duplicate],
    });

    expect(result.renderable).toBe(false);
    expect(result.renderable || result.errors.length).toBeGreaterThan(0);
  });

  it("refuses a scene with no windows or steps", () => {
    const result = resolveAnimationScene({ label: "Empty" });

    expect(result.renderable).toBe(false);
  });

  it("refuses a missing scene", () => {
    expect(resolveAnimationScene(null).renderable).toBe(false);
    expect(resolveAnimationScene(undefined).renderable).toBe(false);
  });
});
