import type { SceneSpec } from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "./tokens";
import {
  type ScenePathSegment,
  type ValidationIssue,
  validateScene,
} from "./validate";

/**
 * The shape a Sanity `Rule.custom` validator may return for one marker. Its
 * `path` is relative to the field being validated, so a scene path maps onto
 * it unchanged.
 */
export type SceneValidationMarker = {
  message: string;
  path: ScenePathSegment[];
};

/**
 * Body of the `animation.scene` field's `Rule.custom` validators: one rule
 * per severity, because a Sanity rule has a single level. Errors block
 * publishing; the warning rule is registered with `.warning()`.
 *
 * Validates the stored value as it is, not a normalised copy, so an editor
 * who mistypes a target id sees the mistake instead of having the step
 * silently dropped. AI output is already normalised before it is written.
 */
export function sceneValidation(
  value: unknown,
  severity: ValidationIssue["severity"],
  tokens: DesignTokens = DEFAULT_TOKENS
): true | SceneValidationMarker[] {
  if (value === undefined || value === null) {
    return severity === "error"
      ? [{ message: "Generate a scene before publishing.", path: [] }]
      : true;
  }
  const markers = validateScene(value as SceneSpec, tokens)
    .filter((issue) => issue.severity === severity)
    .map(({ message, path }) => ({ message, path }));
  return markers.length > 0 ? markers : true;
}
