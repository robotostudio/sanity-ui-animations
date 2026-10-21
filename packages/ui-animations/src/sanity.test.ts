import { describe, expect, it } from "vitest";

import { checkoutScene } from "./fixtures/checkout";
import { normalizeScene } from "./normalize";
import { sceneValidation, toScenePatch } from "./sanity";
import type { SceneSpecDraft } from "./scene-spec";

describe("sceneValidation", () => {
  it("accepts the checkout scene at both levels", () => {
    expect(sceneValidation(checkoutScene, "error")).toBe(true);
    expect(sceneValidation(checkoutScene, "warning")).toBe(true);
  });

  it("blocks publishing an animation that has no scene yet", () => {
    expect(sceneValidation(undefined, "error")).toEqual([
      { message: "Generate a scene before publishing.", path: [] },
    ]);
    expect(sceneValidation(undefined, "warning")).toBe(true);
  });

  it("returns only the issues of the requested severity, with paths relative to the scene", () => {
    const scene = structuredClone(checkoutScene);
    scene.sceneMode = "ambient";
    const first = scene.steps[0];
    if (first) {
      first.target = "ghost";
    }
    expect(sceneValidation(scene, "error")).toEqual([
      {
        message: 'Nothing in the scene has the id "ghost".',
        path: ["steps", { _key: "s1" }, "target"],
      },
    ]);
    expect(sceneValidation(scene, "warning")).toEqual([
      {
        message:
          "Pick the step shown as a still to people who prefer reduced motion.",
        path: ["stillStepKey"],
      },
    ]);
  });
});

describe("toScenePatch", () => {
  it("wraps the normalised draft as the set payload for `scene`", () => {
    const draft = { canvas: { size: 9000 } } as SceneSpecDraft;
    expect(toScenePatch(draft)).toEqual({ scene: normalizeScene(draft) });
    expect(toScenePatch(draft).scene.canvas.size).toBe(1200);
  });

  it("is JSON-safe, so the patch stores exactly what was normalised", () => {
    const { scene } = toScenePatch(checkoutScene);
    expect(JSON.parse(JSON.stringify(scene))).toStrictEqual(scene);
  });
});
