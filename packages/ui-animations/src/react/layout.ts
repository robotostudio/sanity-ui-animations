import type {
  CursorTarget,
  ElementKind,
  SceneAnchor,
  SceneSpec,
  SceneWindow,
} from "../scene-spec";

/**
 * Fixed geometry for the primitives, in design px. Windows place themselves
 * from the spec; everything inside a window is laid out here, so the timeline
 * (cursor distances) and the renderer (connectors, cursor) agree on where
 * each element sits.
 */
export const LAYOUT = {
  titleBarPx: 44,
  paddingPx: 16,
  gapPx: 8,
  elementHeightPx: { row: 40, card: 64, button: 40 } satisfies Record<
    ElementKind,
    number
  >,
  /** The cursor rests this far below its target's bottom edge. */
  cursorOffsetPx: 4,
  /** And this far across its target, as a fraction of the width. */
  cursorAcross: 0.72,
} as const;

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** Canvas-space boxes of a window's elements, keyed by element id. */
export function elementRects(window: SceneWindow): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  let y = window.y + LAYOUT.titleBarPx + LAYOUT.paddingPx;
  for (const element of window.elements) {
    const h =
      LAYOUT.elementHeightPx[element.kind] ?? LAYOUT.elementHeightPx.row;
    rects.set(element.id, {
      x: window.x + LAYOUT.paddingPx,
      y,
      w: window.w - LAYOUT.paddingPx * 2,
      h,
    });
    y += h + LAYOUT.gapPx;
  }
  return rects;
}

/** Box of a window, or of one element in it. `undefined` if it dangles. */
export function anchorRect(
  scene: SceneSpec,
  anchor: SceneAnchor
): Rect | undefined {
  const window = scene.windows.find((entry) => entry.id === anchor.windowId);
  if (!window) {
    return;
  }
  if (!anchor.elementId) {
    return { x: window.x, y: window.y, w: window.w, h: window.h };
  }
  return elementRects(window).get(anchor.elementId);
}

/** Where the cursor waits before its first move. */
export function cursorStart(scene: SceneSpec): Point {
  const size = scene.canvas.size;
  return scene.cursor?.start ?? { x: size + 32, y: size * 0.75 };
}

/**
 * Where the cursor tip rests for a target: just below it, never over it.
 * A window target aims at its title bar.
 */
export function cursorRestPoint(
  scene: SceneSpec,
  target: CursorTarget
): Point | undefined {
  const rect = anchorRect(scene, target);
  if (!rect) {
    return;
  }
  const x = rect.x + rect.w * LAYOUT.cursorAcross;
  if (!target.elementId) {
    return { x, y: rect.y + LAYOUT.titleBarPx / 2 };
  }
  return { x, y: rect.y + rect.h + LAYOUT.cursorOffsetPx };
}

/** Rest point of the cursor target with id `targetId`, if there is one. */
export function cursorDestination(
  scene: SceneSpec,
  targetId: string
): Point | undefined {
  const target = scene.cursor?.targets.find((entry) => entry.id === targetId);
  return target ? cursorRestPoint(scene, target) : undefined;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
