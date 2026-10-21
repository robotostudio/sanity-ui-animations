import { describe, expect, it } from "vitest";

import { checkoutScene } from "./fixtures/checkout";
import { normalizeScene } from "./normalize";
import type { SceneSpec, SceneStep } from "./scene-spec";
import { DEFAULT_TOKENS } from "./tokens";
import { validateScene } from "./validate";

/** A copy of the reference scene, changed by `edit`. */
const edited = (edit: (scene: SceneSpec) => void): SceneSpec => {
  const scene = structuredClone(checkoutScene);
  edit(scene);
  return scene;
};

const step = (scene: SceneSpec, key: string): SceneStep => {
  const found = scene.steps.find((entry) => entry._key === key);
  if (!found) {
    throw new Error(`no step ${key}`);
  }
  return found;
};

const codes = (scene: SceneSpec) =>
  validateScene(scene).map((issue) => `${issue.severity}:${issue.code}`);

describe("validateScene", () => {
  it("passes the checkout reference scene with no issues", () => {
    expect(validateScene(checkoutScene)).toEqual([]);
  });

  it("passes the checkout scene once normalised", () => {
    expect(validateScene(normalizeScene(checkoutScene))).toEqual([]);
  });

  it("writes every message in sentence case", () => {
    const scene = edited((s) => {
      s.windows = [];
      s.steps = [];
    });
    for (const issue of validateScene(scene)) {
      expect(issue.message).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("needs at least one window and one step", () => {
    const scene = edited((s) => {
      s.windows = [];
      s.connectors = [];
      s.cursor = undefined;
      s.steps = [];
    });
    expect(codes(scene)).toEqual(
      expect.arrayContaining(["error:no-windows", "error:no-steps"])
    );
  });

  it("needs an accessible label", () => {
    const issues = validateScene(edited((s) => (s.label = " ")));
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "missing-label",
        path: ["label"],
      })
    );
  });

  it("reports a duplicate id at the second use", () => {
    const issues = validateScene(
      edited((s) => {
        const second = s.windows[1];
        if (second) {
          second.id = "cart";
        }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "duplicate-id",
        path: ["windows", { _key: "w-payments" }, "id"],
      })
    );
  });

  it("reports a duplicate _key within an array", () => {
    const issues = validateScene(
      edited((s) => {
        const last = s.steps.at(-1);
        if (last) {
          last._key = "s1";
        }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", code: "duplicate-key" })
    );
  });

  it("reports a step target that does not resolve", () => {
    const issues = validateScene(
      edited((s) => (step(s, "s4").target = "ghost"))
    );
    expect(issues).toContainEqual({
      severity: "error",
      code: "dangling-target",
      message: expect.stringContaining("ghost"),
      path: ["steps", { _key: "s4" }, "target"],
    });
  });

  it("reports connector anchors that do not resolve", () => {
    const issues = validateScene(
      edited((s) => {
        const connector = s.connectors[0];
        if (connector) {
          connector.from = { windowId: "ghost" };
          connector.to = { windowId: "cart", elementId: "row-order" };
        }
      })
    );
    expect(
      issues
        .filter((issue) => issue.code === "dangling-anchor")
        .map((i) => i.path)
    ).toEqual([
      ["connectors", { _key: "c-pay" }, "from", "windowId"],
      ["connectors", { _key: "c-pay" }, "to", "elementId"],
    ]);
  });

  it("reports cursor targets that do not resolve", () => {
    const issues = validateScene(
      edited((s) => {
        const target = s.cursor?.targets[0];
        if (target) {
          target.elementId = "ghost";
        }
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "dangling-cursor-target",
        path: ["cursor", "targets", { _key: "t-apply" }, "elementId"],
      })
    );
  });

  it("reports a stillStepKey that names no step", () => {
    expect(codes(edited((s) => (s.stillStepKey = "ghost")))).toContain(
      "error:dangling-still-step"
    );
  });

  it("warns when an ambient scene has no reduced-motion still", () => {
    expect(codes(edited((s) => (s.sceneMode = "ambient")))).toEqual([
      "warning:missing-still-step",
    ]);
  });

  it("reports a canvas size outside the tokens' range", () => {
    expect(codes(edited((s) => (s.canvas.size = 2000)))).toContain(
      "error:canvas-size"
    );
  });

  it.each([
    ["off the right edge", { x: 400 }],
    ["off the top", { y: -1 }],
    ["taller than the canvas", { h: 700 }],
  ])("reports a window %s", (_, patch) => {
    const issues = validateScene(
      edited((s) => Object.assign(s.windows[0] ?? {}, patch))
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "window-outside-canvas",
        path: ["windows", { _key: "w-cart" }],
      })
    );
  });

  it("reports more Tide accents than the tokens allow", () => {
    const scene = edited((s) => {
      const pay = s.windows[0]?.elements.find((e) => e.id === "btn-pay");
      if (pay) {
        pay.accent = true;
      }
    });
    expect(validateScene(scene)).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "tide-overused",
        path: [
          "windows",
          { _key: "w-cart" },
          "elements",
          { _key: "e-pay" },
          "accent",
        ],
      })
    );
    const twoAllowed = {
      ...DEFAULT_TOKENS,
      tide: { ...DEFAULT_TOKENS.tide, maxPerScene: 2 },
    };
    expect(validateScene(scene, twoAllowed)).toEqual([]);
  });

  describe("durations", () => {
    it("reports a duration outside its role's range", () => {
      const issues = validateScene(
        edited((s) => (step(s, "s1").durationMs = 600))
      );
      expect(issues).toContainEqual({
        severity: "error",
        code: "duration-out-of-range",
        message: expect.stringContaining("180"),
        path: ["steps", { _key: "s1" }, "durationMs"],
      });
    });

    it("allows a cursor glide anywhere from a hop to a full glide", () => {
      expect(codes(edited((s) => (step(s, "s2").durationMs = 400)))).toEqual(
        []
      );
      expect(codes(edited((s) => (step(s, "s2").durationMs = 1750)))).toEqual(
        []
      );
      expect(codes(edited((s) => (step(s, "s2").durationMs = 300)))).toEqual([
        "error:duration-out-of-range",
      ]);
    });

    it("bounds a sweep only by being non-negative", () => {
      expect(codes(edited((s) => (step(s, "s9").durationMs = 4000)))).toEqual(
        []
      );
      expect(codes(edited((s) => (step(s, "s9").durationMs = -1)))).toEqual([
        "error:duration-out-of-range",
      ]);
    });
  });

  describe("actions suit their targets", () => {
    it.each([
      ["move onto an element", "s2", { target: "btn-apply" }],
      ["click a window", "s3", { target: "cart" }],
      ["update a window", "s5", { target: "cart" }],
      ["enter a cursor target", "s1", { target: "target-apply" }],
    ])("reports a step that tries to %s", (_, key, patch) => {
      const issues = validateScene(
        edited((s) => Object.assign(step(s, key), patch))
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          severity: "error",
          code: "action-target-mismatch",
          path: ["steps", { _key: key }, "action"],
        })
      );
    });

    it("warns when a cursor step uses the wrong role", () => {
      expect(codes(edited((s) => (step(s, "s3").role = "enter")))).toContain(
        "warning:role-mismatch"
      );
    });

    it("warns when the cursor clicks a target it has not moved to", () => {
      expect(
        codes(edited((s) => (step(s, "s3").target = "target-pay")))
      ).toEqual(["warning:click-before-move"]);
    });

    it("warns when an update changes nothing", () => {
      expect(codes(edited((s) => (step(s, "s5").value = undefined)))).toEqual([
        "warning:update-without-change",
      ]);
    });
  });

  it("reports a reveal run longer than the role's maxItems", () => {
    // s4 already reveals the discount row; eight more make a run of nine.
    const scene = edited((s) => {
      const reveals = Array.from({ length: 8 }, (_, index) => ({
        _key: `r${index}`,
        action: "reveal" as const,
        target: "item-case",
        role: "reveal" as const,
        delayMs: 0,
      }));
      s.steps.splice(4, 0, ...reveals);
    });
    expect(validateScene(scene)).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "reveal-run-too-long",
        path: ["steps", { _key: "r7" }],
      })
    );
  });

  it("warns about step and window counts outside the brief", () => {
    const scene = edited((s) => {
      s.steps = s.steps.slice(0, 3);
      s.windows.push(
        ...["a", "b"].map((id) => ({
          _key: id,
          id,
          title: id,
          kind: "app" as const,
          x: 0,
          y: 0,
          w: 200,
          h: 200,
          elements: [],
        }))
      );
    });
    expect(codes(scene)).toEqual(
      expect.arrayContaining(["warning:step-count", "warning:window-count"])
    );
  });

  it("uses array indexes in paths when an item has no _key", () => {
    const issues = validateScene(
      edited((s) => {
        const first = step(s, "s1");
        first._key = undefined as unknown as string;
        first.target = "ghost";
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "dangling-target",
        path: ["steps", 0, "target"],
      })
    );
  });

  it("does not throw on a partial scene straight from the dataset", () => {
    const partial = {
      windows: [{ _key: "w" }],
      steps: [{}],
    } as unknown as SceneSpec;
    expect(() => validateScene(partial)).not.toThrow();
    expect(codes(partial)).toContain("error:dangling-target");
  });
});
