import { checkoutScene } from "../checkout";
import { generateCheckoutResponse } from "./generate-checkout";

/**
 * Recorded shape of the call 2 (Good only) response: the refine pass at
 * temperature 0, reviewing the scene call 1 wrote. It fixed what the rules
 * flag (one Tide accent, an in-range glide, no dangling `row-shipping`
 * update, a cursor start) and kept the rest, which leaves the reference
 * checkout scene with the schema's `_type`s still on its items.
 */
export const refineCheckoutResponse = {
  ...generateCheckoutResponse,
  _rev: "x7Qe1bVZ0aC4kQ2r9Lw9mB",
  _updatedAt: "2026-10-21T09:14:52Z",
  scene: {
    _type: "object",
    ...checkoutScene,
    windows: checkoutScene.windows.map((window) => ({
      _type: "sceneWindow",
      ...window,
      elements: window.elements.map((element) => ({
        _type: "sceneElement",
        ...element,
      })),
    })),
    steps: checkoutScene.steps.map((step) => ({
      _type: "sceneStep",
      ...step,
    })),
  },
};
