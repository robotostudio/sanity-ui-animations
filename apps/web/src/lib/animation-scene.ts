import {
  DEFAULT_TOKENS,
  type DesignTokens,
  normalizeScene,
  type SceneSpec,
  type SceneSpecDraft,
  type ValidationIssue,
  validateScene,
} from "@sanity-ui-animations/ui-animations";

export type AnimationSceneResult =
  | { renderable: true; scene: SceneSpec }
  | { renderable: false; errors: ValidationIssue[] };

/**
 * The website's gate in front of `<Scene>`: normalise what the dataset holds,
 * then refuse it if `validateScene` reports any error. Warnings still render,
 * as they do in the Studio. A missing scene is refused with no issues, since
 * there is nothing to validate.
 */
export function resolveAnimationScene(
  stored: unknown,
  tokens: DesignTokens = DEFAULT_TOKENS
): AnimationSceneResult {
  if (stored === null || typeof stored !== "object") {
    return { renderable: false, errors: [] };
  }
  const scene = normalizeScene(stored as SceneSpecDraft, tokens);
  const errors = validateScene(scene, tokens).filter(
    (issue) => issue.severity === "error"
  );
  return errors.length > 0
    ? { renderable: false, errors }
    : { renderable: true, scene };
}
