import type { SceneBadge, SceneSpec, SceneStep } from "../scene-spec";
import type { DesignTokens, MotionRoleToken } from "../tokens";
import { cursorDestination, cursorStart, distance, type Point } from "./layout";

/** Used when a `sweep` step has no `durationMs`: sweep has no fixed range. */
export const SWEEP_FALLBACK_MS = 1000;

export type TimelineEntry = {
  step: SceneStep;
  /** When the step starts, ms from the start of the scene. */
  startMs: number;
  durationMs: number;
  /** CSS easing for the step's role. */
  easing: string;
};

export type Timeline = {
  entries: TimelineEntry[];
  /** When the last step finishes, ms. */
  totalMs: number;
};

function findRole(
  tokens: DesignTokens,
  role: SceneStep["role"]
): MotionRoleToken | undefined {
  return tokens.roles.find((entry) => entry.role === role);
}

/** Cursor travel time by distance (motion.md's hop / glide rule). */
function glideMs(tokens: DesignTokens, from: Point, to: Point): number {
  const { hopDistancePx, hopMs, fullGlideDistancePx } =
    tokens.choreography.cursor;
  const fullMs = findRole(tokens, "glide")?.duration?.maxMs ?? hopMs;
  const travelled = distance(from, to);
  if (travelled <= hopDistancePx) {
    return hopMs;
  }
  if (travelled >= fullGlideDistancePx) {
    return fullMs;
  }
  const t = (travelled - hopDistancePx) / (fullGlideDistancePx - hopDistancePx);
  return Math.round(hopMs + (fullMs - hopMs) * t);
}

/**
 * Schedule a scene's steps. Steps run in array order and each starts
 * `delayMs` after the previous one finished. A step without `durationMs`
 * takes its role's longest duration, and a cursor `move` takes the
 * distance rule from `tokens.choreography.cursor`.
 */
export function buildTimeline(
  scene: SceneSpec,
  tokens: DesignTokens
): Timeline {
  const entries: TimelineEntry[] = [];
  let clock = 0;
  let cursor = cursorStart(scene);

  for (const step of scene.steps) {
    const role = findRole(tokens, step.role);
    const destination = cursorDestination(scene, step.target);

    let durationMs = step.durationMs;
    if (durationMs === undefined) {
      if (step.action === "move" && destination) {
        durationMs = glideMs(tokens, cursor, destination);
      } else {
        durationMs = role?.duration?.maxMs ?? SWEEP_FALLBACK_MS;
      }
    }
    if (destination && (step.action === "move" || step.action === "click")) {
      cursor = destination;
    }

    const startMs = clock + step.delayMs;
    entries.push({
      step,
      startMs,
      durationMs,
      easing: role?.css ?? "linear",
    });
    clock = startMs + durationMs;
  }

  return { entries, totalMs: clock };
}

/** What the scene shows after some number of steps have landed. */
export type SceneState = {
  /** Ids (windows, elements, connectors) not on screen. */
  hidden: ReadonlySet<string>;
  /** Trailing text per element id. */
  values: Readonly<Record<string, string | undefined>>;
  /** Badge per element id. */
  badges: Readonly<Record<string, SceneBadge | undefined>>;
  /** Cursor tip, design px. */
  cursor: Point;
  /** Index of the latest `click` step, or -1. */
  lastClick: number;
  /**
   * Index of the step that last touched each id (`cursor` for the cursor), so
   * the renderer can transition it on that step's duration and curve.
   */
  lastStep: Readonly<Record<string, number>>;
};

/** The key the cursor uses in `SceneState.lastStep`. */
export const CURSOR_ID = "cursor";

/** State after the first `count` steps of `scene` have landed. */
export function sceneStateAt(scene: SceneSpec, count: number): SceneState {
  const hidden = new Set<string>();
  const values: Record<string, string | undefined> = {};
  const badges: Record<string, SceneBadge | undefined> = {};
  const lastStep: Record<string, number> = {};
  let cursor = cursorStart(scene);
  let lastClick = -1;

  for (const window of scene.windows) {
    for (const element of window.elements) {
      values[element.id] = element.value;
      badges[element.id] = element.badge;
    }
  }
  for (const step of scene.steps) {
    if (step.action === "enter" || step.action === "reveal") {
      hidden.add(step.target);
    }
  }

  scene.steps.slice(0, count).forEach((step, index) => {
    switch (step.action) {
      case "enter":
      case "reveal":
        hidden.delete(step.target);
        break;
      case "exit":
        hidden.add(step.target);
        break;
      case "update":
        if (step.value !== undefined) {
          values[step.target] = step.value;
        }
        if (step.badge !== undefined) {
          badges[step.target] = step.badge;
        }
        break;
      case "move":
      case "click": {
        cursor = cursorDestination(scene, step.target) ?? cursor;
        if (step.action === "click") {
          lastClick = index;
        }
        lastStep[CURSOR_ID] = index;
        return;
      }
      default:
        return;
    }
    lastStep[step.target] = index;
  });

  return { hidden, values, badges, cursor, lastClick, lastStep };
}

/**
 * How many steps the still shown under reduced motion has landed. Intro and
 * interactive scenes rest on their final state; ambient scenes on the end of
 * `stillStepKey` (or the final state if it dangles).
 */
export function restStepCount(scene: SceneSpec): number {
  if (scene.sceneMode === "ambient" && scene.stillStepKey) {
    const index = scene.steps.findIndex(
      (step) => step._key === scene.stillStepKey
    );
    if (index !== -1) {
      return index + 1;
    }
  }
  return scene.steps.length;
}
