import { describe, expect, it } from "vitest";

import { checkoutScene } from "../fixtures/checkout";
import type { SceneSpec } from "../scene-spec";
import { DEFAULT_TOKENS } from "../tokens";
import { buildTimeline, restStepCount, sceneStateAt } from "./timeline";

const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const IN_OUT = "cubic-bezier(0.8, 0, 0.2, 1)";

describe("buildTimeline", () => {
  it("starts each step delayMs after the previous step finished", () => {
    const timeline = buildTimeline(checkoutScene, DEFAULT_TOKENS);
    const s1 = timeline.entries[0];
    expect(s1).toMatchObject({ startMs: 0, durationMs: 240, easing: OUT });
    // s2 waits 300ms after s1 (0 + 240) ends.
    expect(timeline.entries[1]?.startMs).toBe(540);
  });

  it("falls back to the role's longest duration when durationMs is omitted", () => {
    const scene: SceneSpec = {
      ...checkoutScene,
      steps: [
        {
          _key: "a",
          action: "reveal",
          target: "row-discount",
          role: "reveal",
          delayMs: 0,
        },
        {
          _key: "b",
          action: "click",
          target: "target-apply",
          role: "press",
          delayMs: 10,
        },
      ],
    };
    const { entries, totalMs } = buildTimeline(scene, DEFAULT_TOKENS);
    expect(entries.map((e) => [e.startMs, e.durationMs])).toEqual([
      [0, 500],
      [510, 140],
    ]);
    expect(totalMs).toBe(650);
  });

  it("gives a cursor glide from off-canvas its full duration on the glide curve", () => {
    const scene: SceneSpec = {
      ...checkoutScene,
      cursor: { targets: checkoutScene.cursor?.targets ?? [] },
      steps: [
        {
          _key: "m",
          action: "move",
          target: "target-apply",
          role: "glide",
          delayMs: 0,
        },
      ],
    };
    expect(buildTimeline(scene, DEFAULT_TOKENS).entries[0]).toMatchObject({
      durationMs: 1750,
      easing: IN_OUT,
    });
  });

  it("gives a short cursor hop the hop duration", () => {
    const first = buildTimeline(
      {
        ...checkoutScene,
        steps: [
          {
            _key: "m1",
            action: "move",
            target: "target-apply",
            role: "glide",
            delayMs: 0,
          },
          {
            _key: "m2",
            action: "move",
            target: "target-apply",
            role: "glide",
            delayMs: 0,
          },
        ],
      },
      DEFAULT_TOKENS
    );
    // The second move goes nowhere: distance 0 is a hop.
    expect(first.entries[1]?.durationMs).toBe(400);
  });
});

describe("sceneStateAt", () => {
  it("starts anything an enter or reveal step targets hidden", () => {
    const state = sceneStateAt(checkoutScene, 0);
    expect([...state.hidden].sort()).toEqual([
      "cart",
      "conn-pay",
      "payments",
      "row-discount",
    ]);
    expect(state.values["row-total"]).toBe("$150");
    expect(state.badges["row-order"]).toEqual({
      status: "info",
      label: "Pending",
    });
    expect(state.cursor).toEqual({ x: 560, y: 120 });
  });

  it("lands every step in the rest state", () => {
    const state = sceneStateAt(checkoutScene, checkoutScene.steps.length);
    expect(state.hidden.size).toBe(0);
    expect(state.values["row-total"]).toBe("$135");
    expect(state.badges["row-order"]).toEqual({
      status: "success",
      label: "Paid",
    });
    expect(state.lastClick).toBe(6);
    // s5 last touched the total; s7 (the pay click) the cursor.
    expect(state.lastStep["row-total"]).toBe(4);
    expect(state.lastStep.cursor).toBe(6);
  });

  it("hides a target again after an exit", () => {
    const scene: SceneSpec = {
      ...checkoutScene,
      steps: [
        ...checkoutScene.steps,
        {
          _key: "x",
          action: "exit",
          target: "payments",
          role: "exit",
          delayMs: 0,
        },
      ],
    };
    expect([...sceneStateAt(scene, scene.steps.length).hidden]).toEqual([
      "payments",
    ]);
  });
});

describe("restStepCount", () => {
  it("is every step for an intro scene", () => {
    expect(restStepCount(checkoutScene)).toBe(10);
  });

  it("is up to and including stillStepKey for an ambient scene", () => {
    expect(
      restStepCount({
        ...checkoutScene,
        sceneMode: "ambient",
        stillStepKey: "s5",
      })
    ).toBe(5);
  });

  it("falls back to every step when an ambient stillStepKey dangles", () => {
    expect(
      restStepCount({
        ...checkoutScene,
        sceneMode: "ambient",
        stillStepKey: "nope",
      })
    ).toBe(10);
  });
});
