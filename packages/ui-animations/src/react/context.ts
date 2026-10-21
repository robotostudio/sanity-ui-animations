import { type CSSProperties, createContext, useContext } from "react";

import type { SceneSpec } from "../scene-spec";
import type { DesignTokens, SceneThemeTokens } from "../tokens";
import type { SceneState, Timeline, TimelineEntry } from "./timeline";

export type SceneContextValue = {
  scene: SceneSpec;
  tokens: DesignTokens;
  /** `tokens.scene[scene.theme]`. */
  theme: SceneThemeTokens;
  timeline: Timeline;
  state: SceneState;
  reducedMotion: boolean;
};

export const SceneContext = createContext<SceneContextValue | null>(null);

/** The scene a primitive is drawn in. Primitives only render inside `<Scene>`. */
export function useScene(): SceneContextValue {
  const value = useContext(SceneContext);
  if (!value) {
    throw new Error("Scene primitives must be rendered inside <Scene>");
  }
  return value;
}

/**
 * A length in design px, as a share of the canvas width. The canvas is a
 * size container, so the whole scene scales with it in plain CSS, with no
 * measuring and nothing to hydrate.
 */
export function useUnit(): (px: number) => string {
  const { scene } = useScene();
  const size = scene.canvas.size;
  return (px) => `${Number(((px / size) * 100).toFixed(4))}cqw`;
}

/** `color` at `percent` opacity. */
export function withOpacity(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/**
 * The timeline entry that last touched `id`, or, while nothing has yet, the
 * first one that will. That step decides how `id` is hidden and on which
 * curve it transitions.
 */
export function entryFor(
  context: SceneContextValue,
  id: string
): TimelineEntry | undefined {
  const index = context.state.lastStep[id];
  if (index !== undefined) {
    return context.timeline.entries[index];
  }
  return context.timeline.entries.find((entry) => entry.step.target === id);
}

/**
 * Show/hide styles for a window, element or connector. Enters scale up from
 * the role's `scaleFrom`, reveals rise and unblur, exits fade. Under reduced
 * motion only the opacity changes.
 */
export function useVisibility(id: string): CSSProperties {
  const context = useScene();
  const { tokens, state, reducedMotion } = context;
  const unit = useUnit();
  const entry = entryFor(context, id);
  const hidden = state.hidden.has(id);
  const transitioned = state.lastStep[id] !== undefined && entry;

  const style: CSSProperties = { opacity: hidden ? 0 : 1 };
  if (transitioned) {
    const properties = reducedMotion
      ? ["opacity"]
      : ["opacity", "transform", "filter"];
    style.transition = properties
      .map((property) => `${property} ${entry.durationMs}ms ${entry.easing}`)
      .join(", ");
  }
  if (!(hidden && entry) || reducedMotion) {
    return style;
  }

  const role = tokens.roles.find((token) => token.role === entry.step.role);
  if (entry.step.action === "reveal") {
    style.transform = `translateY(${unit(role?.risePx ?? 0)})`;
    style.filter = `blur(${unit(tokens.choreography.maxBlurPx)})`;
  } else if (entry.step.action === "enter" && role?.scaleFrom) {
    style.transform = `scale(${role.scaleFrom})`;
  }
  return style;
}
