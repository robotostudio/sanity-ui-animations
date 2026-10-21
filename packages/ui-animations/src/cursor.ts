import type { CursorTarget, SceneWindow } from "./scene-spec";
import { type DesignTokens, type DurationRange, roleToken } from "./tokens";

/**
 * Height of a window's title bar, design px. The field description in the
 * Studio tells the model to leave about this much room above the elements.
 */
export const TITLE_BAR_PX = 52;

export type Point = { x: number; y: number };

/**
 * Where a cursor target sits on the canvas, approximately: the centre of the
 * window, or of the element's slot when the window's content area is split
 * evenly between its elements top to bottom. Only distances are derived from
 * it, so the approximation is close enough for the glide-duration rule; the
 * renderer computes its own exact positions.
 */
export function cursorTargetPoint(
  target: Pick<CursorTarget, "windowId" | "elementId">,
  windows: readonly SceneWindow[]
): Point | undefined {
  const win = windows.find((entry) => entry.id === target.windowId);
  if (!win) {
    return;
  }
  const x = win.x + win.w / 2;
  const index = target.elementId
    ? win.elements.findIndex((element) => element.id === target.elementId)
    : -1;
  if (index < 0) {
    return { x, y: win.y + win.h / 2 };
  }
  const slot = (win.h - TITLE_BAR_PX) / win.elements.length;
  return { x, y: win.y + TITLE_BAR_PX + slot * (index + 0.5) };
}

/**
 * motion.md: "Duration follows distance: a hop to a neighbouring target (60px
 * or less) takes 400ms, rising to the full glide at 240px." Between the two
 * the duration rises linearly from `hopMs` to the glide's shortest duration.
 * Returns the allowed range for a glide of `distancePx`; an unknown distance
 * (the cursor starts off-canvas) is a full glide.
 */
export function cursorGlideRange(
  distancePx: number,
  tokens: DesignTokens
): DurationRange {
  const glide = roleToken(tokens, "glide").duration ?? {
    minMs: tokens.choreography.cursor.hopMs,
    maxMs: tokens.choreography.cursor.hopMs,
  };
  const { hopDistancePx, hopMs, fullGlideDistancePx } =
    tokens.choreography.cursor;
  if (distancePx <= hopDistancePx) {
    return { minMs: hopMs, maxMs: hopMs };
  }
  if (distancePx >= fullGlideDistancePx) {
    return glide;
  }
  const t =
    (distancePx - hopDistancePx) / (fullGlideDistancePx - hopDistancePx);
  const ms = Math.round(hopMs + t * (glide.minMs - hopMs));
  return { minMs: ms, maxMs: ms };
}

/**
 * Every duration a cursor glide may take at any distance: from a hop up to
 * the longest full glide. Validation uses this envelope because it does not
 * depend on the approximate layout in `cursorTargetPoint`.
 */
export function cursorGlideEnvelope(tokens: DesignTokens): DurationRange {
  return {
    minMs: cursorGlideRange(0, tokens).minMs,
    maxMs: cursorGlideRange(Number.POSITIVE_INFINITY, tokens).maxMs,
  };
}
