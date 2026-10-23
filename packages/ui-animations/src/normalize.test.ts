import { describe, expect, it } from "vitest";

import { checkoutScene } from "./fixtures/checkout";
import { normalizeScene } from "./normalize";
import type { SceneSpecDraft, SceneStep, SceneWindow } from "./scene-spec";
import { DEFAULT_TOKENS } from "./tokens";

/** A draft as messy as Agent Actions output can get. */
const messyDraft = {
  sceneMode: "loop",
  theme: "night",
  canvas: { size: 5000 },
  label: "  A messy scene  ",
  windows: [
    {
      title: "shop.example.com",
      kind: "safari",
      x: -40,
      y: 900,
      w: 2000,
      h: 50,
      elements: [
        { id: "a", label: "First", accent: true, kind: "line-item" },
        { _key: "dup", label: "Second", accent: true, badge: { status: "?" } },
        {
          _key: "dup",
          id: "c",
          label: "Third",
          badge: { label: "Paid", status: "paid" },
        },
      ],
    },
  ],
  connectors: [{ from: { windowId: "nowhere" }, to: { windowId: "window-1" } }],
  cursor: { targets: [{ windowId: "window-1", elementId: "a" }] },
  steps: [
    { action: "appear", target: "window-1", role: "?", durationMs: 9999 },
    { action: "glide", target: "target-1", delayMs: -5 },
    { action: "enter", target: "ghost", role: "enter" },
  ],
} as unknown as SceneSpecDraft;

const minimalWindow: SceneWindow = {
  _key: "w",
  id: "win",
  title: "App",
  kind: "app",
  x: 0,
  y: 0,
  w: 320,
  h: 320,
  elements: [{ _key: "e", id: "el", kind: "row", label: "Row" }],
};

const withSteps = (
  steps: Partial<SceneStep>[],
  extra: SceneSpecDraft = {}
): SceneSpecDraft => ({
  windows: [minimalWindow],
  ...extra,
  steps: steps.map((step, index) => ({ _key: `s${index}`, ...step })),
});

describe("normalizeScene", () => {
  it("leaves the checkout reference scene unchanged", () => {
    expect(normalizeScene(checkoutScene)).toEqual(checkoutScene);
  });

  it("is idempotent", () => {
    const once = normalizeScene(messyDraft);
    expect(normalizeScene(once)).toEqual(once);
  });

  it("does not mutate the draft", () => {
    const draft = structuredClone(messyDraft);
    normalizeScene(draft);
    expect(draft).toEqual(messyDraft);
  });

  it("fills every default for an empty draft", () => {
    expect(normalizeScene({})).toEqual({
      sceneMode: "intro",
      theme: "light",
      canvas: { size: 640 },
      label: "",
      windows: [],
      connectors: [],
      steps: [],
    });
  });

  it("survives a draft that is not an object at all", () => {
    expect(normalizeScene(null as unknown as SceneSpecDraft).windows).toEqual(
      []
    );
  });

  describe("canvas", () => {
    it.each([
      [5000, 1200],
      [100, 320],
      ["800", 800],
      [700.4, 700],
      [Number.NaN, 640],
      [undefined, 640],
    ])("clamps size %s to %s", (size, expected) => {
      const draft = { canvas: { size } } as unknown as SceneSpecDraft;
      expect(normalizeScene(draft).canvas.size).toBe(expected);
    });
  });

  describe("windows", () => {
    it("pulls a window back inside the canvas", () => {
      const scene = normalizeScene({
        windows: [{ ...minimalWindow, x: 500, y: -20 }],
      });
      expect(scene.windows[0]).toMatchObject({ x: 320, y: 0 });
    });

    it("shrinks an oversized window to the canvas and grows a tiny one to the minimum", () => {
      const scene = normalizeScene({
        windows: [
          { ...minimalWindow, w: 2000, h: 10 },
          { ...minimalWindow, _key: "w2", id: "win2", w: 10, h: 2000 },
        ],
      });
      expect(scene.windows[0]).toMatchObject({ x: 0, w: 640, h: 80 });
      expect(scene.windows[1]).toMatchObject({ y: 0, w: 120, h: 640 });
    });

    it("centres a window with no position or size", () => {
      const scene = normalizeScene({ windows: [{ id: "win" }] });
      expect(scene.windows[0]).toEqual({
        _key: "window-1",
        id: "win",
        title: "win",
        kind: "app",
        x: 140,
        y: 160,
        w: 360,
        h: 320,
        elements: [],
      });
    });
  });

  describe("keys and ids", () => {
    it("generates missing keys and replaces duplicates, without colliding with later keys", () => {
      const scene = normalizeScene({
        windows: [
          {
            ...minimalWindow,
            elements: [
              { id: "a" },
              { _key: "x", id: "b" },
              { _key: "x", id: "c" },
              { _key: "element-1", id: "d" },
            ],
          },
        ],
      });
      expect(scene.windows[0]?.elements.map((e) => e._key)).toEqual([
        "element-2",
        "x",
        "element-3",
        "element-1",
      ]);
    });

    it("generates missing ids that no other id in the scene uses", () => {
      const scene = normalizeScene({
        windows: [
          { elements: [{ label: "No id" }] },
          { id: "window-1", elements: [{ id: "element-1" }] },
        ],
      });
      expect(scene.windows.map((w) => w.id)).toEqual(["window-2", "window-1"]);
      expect(scene.windows[0]?.elements[0]?.id).toBe("element-2");
    });

    it("leaves duplicate ids for validation to report", () => {
      const scene = normalizeScene({
        windows: [
          { ...minimalWindow, id: "same" },
          { ...minimalWindow, _key: "w2", id: "same" },
        ],
      });
      expect(scene.windows.map((w) => w.id)).toEqual(["same", "same"]);
    });
  });

  describe("enums", () => {
    it.each([
      ["sceneMode", "ambeint", "ambient"],
      ["sceneMode", "LOOP", "ambient"],
      ["sceneMode", "zoom", "intro"],
      ["theme", "night", "dark"],
      ["theme", "purple", "light"],
      ["theme", "drak", "light"],
    ] as const)("maps %s %j to %j", (field, value, expected) => {
      expect(normalizeScene({ [field]: value } as SceneSpecDraft)[field]).toBe(
        expected
      );
    });

    it("maps window and element kinds and badge statuses", () => {
      const scene = normalizeScene(messyDraft);
      const win = scene.windows[0];
      expect(win?.kind).toBe("browser");
      expect(win?.elements.map((e) => e.kind)).toEqual(["row", "row", "row"]);
      expect(win?.elements[2]?.badge).toEqual({
        status: "success",
        label: "Paid",
      });
    });

    it("drops a badge with no label and defaults an unknown status to neutral", () => {
      const scene = normalizeScene({
        windows: [
          {
            ...minimalWindow,
            elements: [
              { id: "a", badge: { status: "success" } },
              { id: "b", badge: { status: "sparkly" as never, label: "New" } },
            ],
          },
        ],
      });
      expect(scene.windows[0]?.elements[0]).not.toHaveProperty("badge");
      expect(scene.windows[0]?.elements[1]?.badge).toEqual({
        status: "neutral",
        label: "New",
      });
    });

    it("never reads a short word as a near-miss of another, so `edit` updates rather than exits", () => {
      const scene = normalizeScene(
        withSteps([
          { action: "edit" as never, target: "el", value: "$1" },
          { action: "exti" as never, target: "el" },
        ])
      );
      expect(scene.steps.map((s) => s.action)).toEqual(["update", "enter"]);
    });

    it("infers an unknown action from what the step targets", () => {
      const scene = normalizeScene(
        withSteps([{ target: "win" }, { target: "t" }], {
          cursor: { targets: [{ _key: "t", id: "t", windowId: "win" }] },
        })
      );
      expect(scene.steps.map((s) => [s.action, s.role])).toEqual([
        ["enter", "enter"],
        ["move", "glide"],
      ]);
    });

    it("gives a connector entrance the sweep role when its role is unknown", () => {
      const scene = normalizeScene(
        withSteps([{ action: "enter", target: "c", role: "bounce" as never }], {
          connectors: [
            {
              _key: "c",
              id: "c",
              from: { windowId: "win" },
              to: { windowId: "win" },
            },
          ],
        })
      );
      expect(scene.steps[0]?.role).toBe("sweep");
      expect(scene.connectors[0]?.dots).toBe(true);
    });
  });

  describe("durations", () => {
    it.each([
      ["enter", 1000, 240],
      ["enter", 10, 180],
      ["press", 500, 140],
      ["reveal", 200, 500],
      ["sweep", 900, 900],
      ["sweep", 9000, 5000],
    ] as const)(
      "snaps a %s step of %ims to %ims",
      (role, durationMs, expected) => {
        const scene = normalizeScene(
          withSteps([{ action: "enter", target: "el", role, durationMs }])
        );
        expect(scene.steps[0]?.durationMs).toBe(expected);
      }
    );

    it("drops a duration that is not a number and leaves an absent one absent", () => {
      const scene = normalizeScene(
        withSteps([
          {
            action: "enter",
            target: "el",
            role: "enter",
            durationMs: "soon" as never,
          },
          { action: "enter", target: "el", role: "enter" },
        ])
      );
      expect(scene.steps[0]).not.toHaveProperty("durationMs");
      expect(scene.steps[1]).not.toHaveProperty("durationMs");
    });

    it("clamps the delay to 0..5000ms", () => {
      const scene = normalizeScene(
        withSteps([
          { action: "enter", target: "el", role: "enter", delayMs: -5 },
          { action: "enter", target: "el", role: "enter", delayMs: 99_999 },
        ])
      );
      expect(scene.steps.map((s) => s.delayMs)).toEqual([0, 5000]);
    });
  });

  describe("cursor glides follow the distance rule", () => {
    // The window's centre is (160, 160); the cursor starts `distance` px below.
    const glide = (distance: number | undefined, durationMs: number) =>
      normalizeScene(
        withSteps(
          [{ action: "move", target: "t", role: "glide", durationMs }],
          {
            cursor: {
              ...(distance === undefined
                ? {}
                : { start: { x: 160, y: 160 + distance } }),
              targets: [{ _key: "t", id: "t", windowId: "win", click: true }],
            },
          }
        )
      ).steps[0]?.durationMs;

    it("takes 400ms for a hop of 60px or less", () => {
      expect(glide(40, 1500)).toBe(400);
    });

    it("rises linearly between a hop and a full glide", () => {
      // Halfway between 60px and 240px: halfway between 400ms and 1200ms.
      expect(glide(150, 1500)).toBe(800);
    });

    it("keeps a full glide inside the glide range", () => {
      expect(glide(300, 3000)).toBe(1750);
      expect(glide(300, 500)).toBe(1200);
    });

    it("treats a cursor with no start as a full glide", () => {
      expect(glide(undefined, 1500)).toBe(1500);
      expect(glide(undefined, 3000)).toBe(1750);
    });

    it("measures each glide from where the previous one ended", () => {
      const scene = normalizeScene(
        withSteps(
          [
            { action: "move", target: "a", role: "glide", durationMs: 1500 },
            { action: "move", target: "b", role: "glide", durationMs: 1500 },
          ],
          {
            cursor: {
              start: { x: 0, y: 640 },
              targets: [
                { _key: "a", id: "a", windowId: "win" },
                { _key: "b", id: "b", windowId: "win", elementId: "el" },
              ],
            },
          }
        )
      );
      // a is the window centre (160, 160); b is the single element's slot
      // centre (160, 186): a 26px hop.
      expect(scene.steps.map((s) => s.durationMs)).toEqual([1500, 400]);
    });
  });

  describe("accent", () => {
    it("keeps Tide on the first accented element only", () => {
      const scene = normalizeScene(messyDraft);
      expect(scene.windows[0]?.elements.map((e) => e.accent)).toEqual([
        true,
        undefined,
        undefined,
      ]);
    });

    it("follows tokens.tide.maxPerScene", () => {
      const tokens = {
        ...DEFAULT_TOKENS,
        tide: { ...DEFAULT_TOKENS.tide, maxPerScene: 2 },
      };
      const scene = normalizeScene(messyDraft, tokens);
      expect(scene.windows[0]?.elements.map((e) => e.accent)).toEqual([
        true,
        true,
        undefined,
      ]);
    });
  });

  describe("dangling references", () => {
    it("drops steps whose target does not exist", () => {
      const scene = normalizeScene(
        withSteps([
          { action: "enter", target: "ghost", role: "enter" },
          { action: "enter", target: "el", role: "enter" },
        ])
      );
      expect(scene.steps.map((s) => s.target)).toEqual(["el"]);
    });

    it("drops connectors anchored to a missing window, and the steps that target them", () => {
      const scene = normalizeScene(messyDraft);
      expect(scene.connectors).toEqual([]);
      expect(scene.steps.map((s) => s.target)).toEqual([
        "window-1",
        "target-1",
      ]);
    });

    it("moves an anchor to the window that owns its element, and drops an unknown element", () => {
      const scene = normalizeScene({
        windows: [
          minimalWindow,
          { ...minimalWindow, _key: "w2", id: "other", elements: [] },
        ],
        connectors: [
          {
            _key: "c",
            id: "c",
            from: { windowId: "other", elementId: "el" },
            to: { windowId: "other", elementId: "ghost" },
            dots: false,
          },
        ],
      });
      expect(scene.connectors[0]).toEqual({
        _key: "c",
        id: "c",
        from: { windowId: "win", elementId: "el" },
        to: { windowId: "other" },
        dots: false,
      });
    });

    it("drops cursor targets with no window", () => {
      const scene = normalizeScene({
        windows: [minimalWindow],
        cursor: {
          start: { x: -10, y: 2000 },
          targets: [
            { _key: "a", id: "a", windowId: "ghost" },
            { _key: "b", id: "b", windowId: "win" },
          ],
        },
      });
      expect(scene.cursor).toEqual({
        start: { x: 0, y: 640 },
        targets: [{ _key: "b", id: "b", windowId: "win", click: true }],
      });
    });

    it("drops a stillStepKey that names no step", () => {
      const scene = normalizeScene(
        withSteps([{ action: "enter", target: "el", role: "enter" }], {
          stillStepKey: "ghost",
        })
      );
      expect(scene).not.toHaveProperty("stillStepKey");
    });

    it("gives an ambient scene its last step as the reduced-motion still", () => {
      const scene = normalizeScene(
        withSteps(
          [
            { action: "enter", target: "win", role: "enter" },
            { action: "enter", target: "el", role: "enter" },
          ],
          { sceneMode: "ambient" }
        )
      );
      expect(scene.stillStepKey).toBe("s1");
    });
  });
});

describe("normalizeScene output", () => {
  it("is JSON-safe, so the draft stores exactly what was normalised", () => {
    const scene = normalizeScene(checkoutScene);
    expect(JSON.parse(JSON.stringify(scene))).toStrictEqual(scene);
  });
});
