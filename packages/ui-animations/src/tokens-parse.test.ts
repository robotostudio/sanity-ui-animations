import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEFAULT_TOKENS } from "./tokens";
import { parseDesignTokens, toDesignTokensDocument } from "./tokens-parse";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/markdown/${name}`, import.meta.url), "utf8");

const recorded = {
  designMd: fixture("design.md"),
  motionMd: fixture("motion.md"),
};

describe("parseDesignTokens", () => {
  it("reads every motion role from the Roles table", () => {
    const { tokens } = parseDesignTokens(recorded, DEFAULT_TOKENS);

    expect(tokens.roles.map((role) => role.role)).toEqual([
      "press",
      "enter",
      "exit",
      "move",
      "glide",
      "reveal",
      "drawer",
      "sweep",
    ]);
    expect(tokens.roles.find((role) => role.role === "glide")).toEqual({
      role: "glide",
      use: "choreography: cursor travel, fans, Scene repositions",
      easing: { type: "cubic-bezier", points: [0.8, 0, 0.2, 1] },
      css: "cubic-bezier(0.8, 0, 0.2, 1)",
      duration: { minMs: 1200, maxMs: 1750 },
      staggerMs: 50,
    });
  });

  it("matches the hand-transcribed defaults for every role", () => {
    const { tokens } = parseDesignTokens(recorded, DEFAULT_TOKENS);

    expect(tokens.roles).toEqual(
      DEFAULT_TOKENS.roles.map((role) =>
        role.role === "drawer"
          ? { ...role, use: "sheets and the mobile nav" }
          : role
      )
    );
  });

  it("finds the Roles table by its headers, whatever the column order", () => {
    const motionMd = [
      "| Duration | Role | Curve | Use |",
      "|---|---|---|---|",
      "| 90 to 110ms | press | `cubic-bezier(0, 0, 1, 1)` | taps: scale 0.9 |",
    ].join("\n");

    const { tokens } = parseDesignTokens(
      { designMd: recorded.designMd, motionMd },
      DEFAULT_TOKENS
    );

    expect(tokens.roles[0]).toEqual({
      role: "press",
      use: "taps: scale 0.9",
      easing: { type: "cubic-bezier", points: [0, 0, 1, 1] },
      css: "cubic-bezier(0, 0, 1, 1)",
      duration: { minMs: 90, maxMs: 110 },
      scaleFrom: 0.9,
    });
  });

  it("falls back per value and warns once for each fallback", () => {
    const motionMd = [
      "| Role | Light | Dark |",
      "|---|---|---|",
      "| press | x | y |",
      "",
      "| Role | Use | Curve | Duration |",
      "|---|---|---|---|",
      "| press | taps | springy | 140ms |",
    ].join("\n");

    const { tokens, warnings } = parseDesignTokens(
      { designMd: "", motionMd },
      DEFAULT_TOKENS
    );
    const press = tokens.roles.find((role) => role.role === "press");

    expect(press).toEqual({ ...DEFAULT_TOKENS.roles[0], use: "taps" });
    expect(warnings).toContain(
      'roles.press.curve: could not read "springy", using the default'
    );
    expect(warnings).toContain(
      "roles.press.scaleFrom: not found in the Roles table, using the default"
    );
    expect(warnings).toContain(
      "roles.glide: row missing from the Roles table, using the default"
    );
  });

  it("reads the recorded files without warnings", () => {
    expect(parseDesignTokens(recorded, DEFAULT_TOKENS).warnings).toEqual([]);
  });

  it("reads each spring's motion config from the Springs table", () => {
    const { tokens } = parseDesignTokens(recorded, DEFAULT_TOKENS);

    expect(tokens.springs).toEqual([
      {
        name: "snap",
        use: "layout and size changes",
        config: { type: "spring", duration: 0.3, bounce: 0 },
      },
      {
        name: "pop",
        use: "a release after a press, with about 2% overshoot",
        config: { type: "spring", stiffness: 400, damping: 22, mass: 1 },
      },
      {
        name: "track",
        use: "following the pointer: tilt, parallax",
        config: { type: "spring", stiffness: 150, damping: 25, mass: 0.5 },
      },
    ]);
  });

  it("keeps the default spring when its config cannot be read", () => {
    const motionMd = [
      "| Spring | Use | Motion config |",
      "|---|---|---|",
      '| snap | layout | `{ type: "spring", stiffness: 1 }` |',
      '| pop | release | `{ type: "spring", stiffness: 1, damping: 2, mass: 3 }` |',
    ].join("\n");

    const { tokens, warnings } = parseDesignTokens(
      { designMd: "", motionMd },
      DEFAULT_TOKENS
    );

    expect(tokens.springs[0]).toEqual({
      ...DEFAULT_TOKENS.springs[0],
      use: "layout",
    });
    expect(tokens.springs[1]?.config).toEqual({
      type: "spring",
      stiffness: 1,
      damping: 2,
      mass: 3,
    });
    expect(warnings).toContain(
      'springs.snap.config: could not read "{ type: "spring", stiffness: 1 }", using the default'
    );
    expect(warnings).toContain(
      "springs.track: row missing from the Springs table, using the default"
    );
  });

  it("reads light and dark colours from the Scene tokens table", () => {
    const { tokens } = parseDesignTokens(recorded, DEFAULT_TOKENS);

    expect(tokens.scene.dark).toEqual({
      groundTones: ["#08090A", "#131416", "#1E1F22", "#3A3C40", "#4A4D52"],
      glassFill: { color: "#1A1B1D", opacity: 0.55 },
      card: "#1A1B1D",
      hairline: "#2E2F30",
      text: "#FAFAF8",
      secondaryText: "#A4A4A4",
      tide: "#9FDCCF",
      trafficLight: { active: "#4A4D52", inactive: "#3A3C40" },
    });
    expect(tokens.scene.light).toEqual(DEFAULT_TOKENS.scene.light);
  });

  it("falls back per colour when a Scene tokens cell cannot be read", () => {
    const motionMd = [
      "| Dark | Token | Light |",
      "|---|---|---|",
      "| `#000001` | Card | `#FFFFFE` |",
      "| `#111111` at 40% | Glass fill | white |",
      "| `#1` `#2` | Ground tones | `#A1A1A1` `#A2A2A2` `#A3A3A3` `#A4A4A4` `#A5A5A5` |",
    ].join("\n");

    const { tokens, warnings } = parseDesignTokens(
      { designMd: "", motionMd },
      DEFAULT_TOKENS
    );

    expect(tokens.scene.light.card).toBe("#FFFFFE");
    expect(tokens.scene.dark.card).toBe("#000001");
    expect(tokens.scene.dark.glassFill).toEqual({
      color: "#111111",
      opacity: 0.4,
    });
    expect(tokens.scene.light.glassFill).toEqual(
      DEFAULT_TOKENS.scene.light.glassFill
    );
    expect(tokens.scene.light.groundTones).toEqual([
      "#A1A1A1",
      "#A2A2A2",
      "#A3A3A3",
      "#A4A4A4",
      "#A5A5A5",
    ]);
    expect(tokens.scene.dark.groundTones).toEqual(
      DEFAULT_TOKENS.scene.dark.groundTones
    );
    expect(warnings).toContain(
      'scene.light.glassFill: could not read "white", using the default'
    );
    expect(warnings).toContain(
      'scene.dark.groundTones: could not read "#1 #2", using the default'
    );
    expect(warnings).toContain(
      "scene.light.hairline: row missing from the Scene tokens table, using the default"
    );
  });

  it("reads badge geometry and colours from the Badges bullet", () => {
    const { tokens } = parseDesignTokens(recorded, DEFAULT_TOKENS);

    expect(tokens.badges).toEqual({
      heightPx: 28,
      dotPx: 6,
      fillOpacity: 0.12,
      colors: {
        success: "#2E9E6B",
        warning: "#C98A0B",
        error: "#D6453D",
        info: "#3B6FD8",
      },
      neutral: { fill: "#F1F0EC", border: "#E3E2DD" },
    });
  });

  it("falls back per badge value the bullet does not state", () => {
    const motionMd =
      "- **Badges** are pills, 30px tall: success `#00AA00`, error red. A neutral badge is `#EEEEEE`.";

    const { tokens, warnings } = parseDesignTokens(
      { designMd: "", motionMd },
      DEFAULT_TOKENS
    );

    expect(tokens.badges).toEqual({
      ...DEFAULT_TOKENS.badges,
      heightPx: 30,
      colors: { ...DEFAULT_TOKENS.badges.colors, success: "#00AA00" },
      neutral: { ...DEFAULT_TOKENS.badges.neutral, fill: "#EEEEEE" },
    });
    expect(warnings).toEqual(
      expect.arrayContaining([
        "badges.dotPx: not found in the Badges bullet, using the default",
        "badges.colors.error: not found in the Badges bullet, using the default",
        "badges.neutral.border: not found in the Badges bullet, using the default",
      ])
    );
  });

  it("keeps every badge default when there is no Badges bullet", () => {
    const { tokens, warnings } = parseDesignTokens(
      { designMd: "", motionMd: "" },
      DEFAULT_TOKENS
    );

    expect(tokens).toEqual(DEFAULT_TOKENS);
    expect(warnings).toEqual([
      "roles: no table headed Role / Use / Curve / Duration, using the default",
      "springs: no table headed Spring / Use / Motion config, using the default",
      "scene: no table headed Token / Light / Dark, using the default",
      'badges: no "Badges" bullet, using the default',
    ]);
  });
});

describe("toDesignTokensDocument", () => {
  const document = toDesignTokensDocument(DEFAULT_TOKENS, {
    rawDesignMd: "# design",
    rawMotionMd: "# motion",
    syncedAt: "2026-10-21T12:00:00.000Z",
  });

  it("is the designTokens singleton with both raw files and syncedAt", () => {
    expect(document).toMatchObject({
      _id: "designTokens",
      _type: "designTokens",
      designMdUrl: "https://robotostudio.com/design.md",
      motionMdUrl: "https://robotostudio.com/design/motion.md",
      syncedAt: "2026-10-21T12:00:00.000Z",
      rawDesignMd: "# design",
      rawMotionMd: "# motion",
    });
  });

  it("flattens roles and springs into keyed schema objects", () => {
    expect(document.roles[0]).toEqual({
      _key: "press",
      _type: "motionRole",
      role: "press",
      use: "anything pressable: :active scale 0.97",
      curve: "cubic-bezier(0.23, 1, 0.32, 1)",
      minMs: 140,
      maxMs: 140,
      scaleFrom: 0.97,
    });
    expect(document.roles.at(-1)).toEqual({
      _key: "sweep",
      _type: "motionRole",
      role: "sweep",
      use: "progress, spinners, anything constant",
      curve: "linear",
    });
    expect(document.springs[1]).toEqual({
      _key: "pop",
      _type: "spring",
      name: "pop",
      use: "a release after a press, with about 2% overshoot",
      stiffness: 400,
      damping: 22,
      mass: 1,
    });
  });

  it("flattens scene, badge, tide and window chrome tokens", () => {
    expect(document.sceneTokens.dark).toEqual({
      groundTones: ["#08090A", "#131416", "#1E1F22", "#3A3C40", "#4A4D52"],
      glassFill: "#1A1B1D",
      glassOpacity: 0.55,
      card: "#1A1B1D",
      hairline: "#2E2F30",
      text: "#FAFAF8",
      secondaryText: "#A4A4A4",
      tide: "#9FDCCF",
      trafficLightActive: "#4A4D52",
      trafficLightInactive: "#3A3C40",
    });
    expect(document.badges).toEqual({
      heightPx: 28,
      dotPx: 6,
      fillOpacity: 0.12,
      success: "#2E9E6B",
      warning: "#C98A0B",
      error: "#D6453D",
      info: "#3B6FD8",
      neutralFill: "#F1F0EC",
      neutralBorder: "#E3E2DD",
    });
    expect(document.tide).toEqual({
      color: "#9FDCCF",
      textColor: "#0B0C0E",
      maxPerScene: 1,
    });
    expect(document.windowChrome).toEqual({
      cornerRadiusPx: 16,
      backdropBlurPx: 22,
      topEdgePx: 1,
      trafficLightDiameterPx: 12,
      trafficLightGapPx: 8,
      trafficLightInsetPx: 20,
    });
  });
});
