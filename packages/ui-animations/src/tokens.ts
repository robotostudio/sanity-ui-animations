/**
 * Design tokens for Scenes, transcribed from robotostudio.com/design.md and
 * robotostudio.com/design/motion.md.
 *
 * `DEFAULT_TOKENS` is the offline fallback and the shape `pnpm tokens:sync`
 * writes to the `designTokens` singleton. Values marked "project choice" are
 * not in the source docs and were picked here; everything else is verbatim.
 */

import type { BadgeStatus, MotionRole, SceneTheme } from "./scene-spec";

/** A CSS easing: a cubic-bezier's four control values, or `linear`. */
export type Easing =
  | { type: "cubic-bezier"; points: [number, number, number, number] }
  | { type: "linear" };

export type DurationRange = {
  /** Shortest allowed duration, ms. */
  minMs: number;
  /** Longest allowed duration, ms. Equal to `minMs` for a fixed duration. */
  maxMs: number;
};

export type MotionRoleToken = {
  role: MotionRole;
  /** What the role is for, as written in motion.md. */
  use: string;
  easing: Easing;
  /** The same easing as a CSS value, e.g. `cubic-bezier(0.23, 1, 0.32, 1)`. */
  css: string;
  /**
   * Allowed duration. `null` for `sweep`, whose duration is the length of
   * its track.
   */
  duration: DurationRange | null;
  /** Gap between staggered items, ms. */
  staggerMs?: number;
  /** Starting scale for enters (never 0). */
  scaleFrom?: number;
  /** Rise distance for reveals, px. */
  risePx?: number;
  /** Most items a single staggered run may animate. */
  maxItems?: number;
};

export type SpringName = "snap" | "pop" | "track";

/** A spring in `motion` (Framer Motion) transition config shape. */
export type SpringConfig =
  | { type: "spring"; duration: number; bounce: number }
  | { type: "spring"; stiffness: number; damping: number; mass: number };

export type SpringToken = {
  name: SpringName;
  use: string;
  config: SpringConfig;
};

export type SceneThemeTokens = {
  /** The five neutral mesh-gradient tones, lightest to darkest in light. */
  groundTones: [string, string, string, string, string];
  glassFill: { color: string; opacity: number };
  card: string;
  hairline: string;
  text: string;
  secondaryText: string;
  tide: string;
  /** Traffic lights: always neutral grey. Project choice from the tones. */
  trafficLight: { active: string; inactive: string };
};

export type BadgeTokens = {
  heightPx: number;
  dotPx: number;
  /** Fill opacity of the status colour behind the label. */
  fillOpacity: number;
  colors: Record<Exclude<BadgeStatus, "neutral">, string>;
  neutral: { fill: string; border: string };
};

export type TideTokens = {
  color: string;
  /** Text drawn on Tide (Ink). */
  textColor: string;
  /** How many elements in one scene may carry Tide. */
  maxPerScene: number;
};

export type WindowChromeTokens = {
  cornerRadiusPx: number;
  backdropBlurPx: number;
  /** The bright top edge. */
  topEdgePx: number;
  trafficLightDiameterPx: number;
  trafficLightGapPx: number;
  trafficLightInsetPx: number;
  /** Panels have no drop shadow. */
  shadow: false;
};

export type ChoreographyTokens = {
  cursor: {
    /** A hop at or under this distance takes `hopMs`. */
    hopDistancePx: number;
    hopMs: number;
    /** From this distance on, the glide takes its full duration. */
    fullGlideDistancePx: number;
    clickSettleMs: number;
    clickPressMs: number;
    clickPressScale: number;
    clickHoldMs: number;
    clickReleaseSpring: SpringName;
  };
  tick: {
    fillMs: number;
    strokeMs: number;
    strokeDelayMs: number;
  };
  pressScale: number;
  hoverMs: number;
  maxBlurPx: number;
};

export type CanvasTokens = {
  /** Project choice. */
  defaultSizePx: number;
  /** Project choice. */
  minSizePx: number;
  /** Project choice. */
  maxSizePx: number;
};

export type TypographyTokens = {
  sans: string;
  mono: string;
  /** Nothing is bold; strong is 500. */
  weights: { regular: number; strong: number };
};

export type ControlTokens = {
  /** Ink in light; the text colour in dark. */
  ink: Record<SceneTheme, string>;
  uncheckedBorder: string;
};

export type DesignTokens = {
  source: {
    designMdUrl: string;
    motionMdUrl: string;
  };
  roles: MotionRoleToken[];
  springs: SpringToken[];
  scene: Record<SceneTheme, SceneThemeTokens>;
  badges: BadgeTokens;
  tide: TideTokens;
  windowChrome: WindowChromeTokens;
  choreography: ChoreographyTokens;
  canvas: CanvasTokens;
  typography: TypographyTokens;
  controls: ControlTokens;
};

const OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const IN_OUT: [number, number, number, number] = [0.8, 0, 0.2, 1];
const DRAWER: [number, number, number, number] = [0.32, 0.72, 0, 1];

const bezier = (points: [number, number, number, number]) => ({
  easing: { type: "cubic-bezier" as const, points },
  css: `cubic-bezier(${points.join(", ")})`,
});

const TIDE = "#9FDCCF";
const INK = "#0B0C0E";

export const DEFAULT_TOKENS: DesignTokens = {
  source: {
    designMdUrl: "https://robotostudio.com/design.md",
    motionMdUrl: "https://robotostudio.com/design/motion.md",
  },
  roles: [
    {
      role: "press",
      use: "anything pressable: :active scale 0.97",
      ...bezier(OUT),
      duration: { minMs: 140, maxMs: 140 },
      scaleFrom: 0.97,
    },
    {
      role: "enter",
      use: "popovers, menus, tooltips, content swaps; scale from 0.96, never from 0",
      ...bezier(OUT),
      duration: { minMs: 180, maxMs: 240 },
      scaleFrom: 0.96,
    },
    {
      role: "exit",
      use: "close, dismiss, swap out",
      ...bezier(OUT),
      duration: { minMs: 120, maxMs: 160 },
    },
    {
      role: "move",
      use: "tab indicators, repositions, reorders",
      ...bezier(IN_OUT),
      duration: { minMs: 240, maxMs: 320 },
    },
    {
      role: "glide",
      use: "choreography: cursor travel, fans, Scene repositions",
      ...bezier(IN_OUT),
      duration: { minMs: 1200, maxMs: 1750 },
      staggerMs: 50,
    },
    {
      role: "reveal",
      use: "sections entering on scroll, once",
      ...bezier(OUT),
      duration: { minMs: 500, maxMs: 500 },
      staggerMs: 50,
      risePx: 16,
      maxItems: 8,
    },
    {
      role: "drawer",
      use: "sheets and the mobile nav; 340ms open, 260ms close",
      ...bezier(DRAWER),
      duration: { minMs: 260, maxMs: 340 },
    },
    {
      role: "sweep",
      use: "progress, spinners, anything constant",
      easing: { type: "linear" },
      css: "linear",
      duration: null,
    },
  ],
  springs: [
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
  ],
  scene: {
    light: {
      groundTones: ["#F8F7F4", "#E7E5DF", "#D2D1CB", "#B0B3B6", "#9A9EA3"],
      glassFill: { color: "#FFFFFF", opacity: 0.55 },
      card: "#FFFFFF",
      hairline: "#E3E2DD",
      text: INK,
      secondaryText: "#6B6E73",
      tide: TIDE,
      trafficLight: { active: "#B0B3B6", inactive: "#D2D1CB" },
    },
    dark: {
      groundTones: ["#08090A", "#131416", "#1E1F22", "#3A3C40", "#4A4D52"],
      glassFill: { color: "#1A1B1D", opacity: 0.55 },
      card: "#1A1B1D",
      hairline: "#2E2F30",
      text: "#FAFAF8",
      secondaryText: "#A4A4A4",
      tide: TIDE,
      trafficLight: { active: "#4A4D52", inactive: "#3A3C40" },
    },
  },
  badges: {
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
  },
  tide: { color: TIDE, textColor: INK, maxPerScene: 1 },
  windowChrome: {
    cornerRadiusPx: 16,
    backdropBlurPx: 22,
    topEdgePx: 1,
    trafficLightDiameterPx: 12,
    trafficLightGapPx: 8,
    trafficLightInsetPx: 20,
    shadow: false,
  },
  choreography: {
    cursor: {
      hopDistancePx: 60,
      hopMs: 400,
      fullGlideDistancePx: 240,
      clickSettleMs: 100,
      clickPressMs: 80,
      clickPressScale: 0.8,
      clickHoldMs: 50,
      clickReleaseSpring: "pop",
    },
    tick: { fillMs: 120, strokeMs: 180, strokeDelayMs: 40 },
    pressScale: 0.97,
    hoverMs: 150,
    maxBlurPx: 4,
  },
  canvas: { defaultSizePx: 640, minSizePx: 320, maxSizePx: 1200 },
  typography: {
    sans: "Geist",
    mono: "Geist Mono",
    weights: { regular: 400, strong: 500 },
  },
  controls: {
    ink: { light: INK, dark: "#FAFAF8" },
    uncheckedBorder: "#C9CCCF",
  },
};

/** Look up one role's token. Throws if the tokens are missing a role. */
export function roleToken(
  tokens: DesignTokens,
  role: MotionRole
): MotionRoleToken {
  const token = tokens.roles.find((entry) => entry.role === role);
  if (!token) {
    throw new Error(`Design tokens have no "${role}" role`);
  }
  return token;
}
