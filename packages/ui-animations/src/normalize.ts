import type { SceneSpec, SceneSpecDraft } from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "./tokens";

/**
 * Auto-correct raw Agent Actions output into a complete, on-brand SceneSpec.
 *
 * Runs client-side after every generation, before validation. It never
 * rejects; it fills defaults and snaps values to the tokens:
 * - canvas `size` clamped to `tokens.canvas` (default `defaultSizePx`)
 * - windows clamped inside the canvas; missing `_key`s and ids generated
 * - unknown enum members (mode, theme, kinds, badge status, action, role)
 *   replaced with the nearest sensible member
 * - `durationMs` snapped into the step role's range (cursor `move` steps use
 *   the distance rule in `tokens.choreography.cursor`)
 * - `accent` kept on the first element only (`tokens.tide.maxPerScene`)
 * - dangling references (step targets, connector anchors, cursor targets)
 *   dropped
 *
 * Pure and deterministic: the same draft and tokens give the same output.
 */
export function normalizeScene(
  _spec: SceneSpecDraft,
  _tokens: DesignTokens = DEFAULT_TOKENS
): SceneSpec {
  throw new Error("normalizeScene: not implemented");
}
