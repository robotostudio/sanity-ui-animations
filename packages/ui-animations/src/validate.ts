import type { SceneSpec } from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "./tokens";

/** One segment of a path into the scene, Sanity-style. */
export type ScenePathSegment = string | number | { _key: string };

export type ValidationIssue = {
  /** `error` blocks publishing; `warning` is shown but allowed. */
  severity: "error" | "warning";
  /** Stable machine code, e.g. `tide-overused`, `dangling-target`. */
  code: string;
  /** Sentence-case message for editors. */
  message: string;
  /** Path from the scene root, e.g. `["steps", { _key: "a1" }, "target"]`. */
  path: ScenePathSegment[];
};

/**
 * Hard rules a normalised scene must pass before it can be published. The
 * Studio's `animation.scene` validation calls this and maps errors to
 * `Rule.custom` failures; the web route refuses to render a scene with errors.
 *
 * Checks (non-exhaustive): unique ids, every reference resolves, windows
 * inside the canvas, at most `tokens.tide.maxPerScene` accents, every
 * `durationMs` inside its role's range, step actions match their target type
 * (`move`/`click` on cursor targets only), at most `maxItems` per reveal run,
 * at least one window and one step.
 *
 * Returns an empty array when the scene is valid.
 */
export function validateScene(
  _spec: SceneSpec,
  _tokens: DesignTokens = DEFAULT_TOKENS
): ValidationIssue[] {
  throw new Error("validateScene: not implemented");
}
