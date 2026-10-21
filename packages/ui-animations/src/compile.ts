import type { SceneSpec } from "./scene-spec";

/**
 * Compile a normalised, valid SceneSpec into a self-contained React (TSX)
 * source string, stored in `animation.reactCode` for editors to copy.
 *
 * Deterministic codegen: string templates over the spec's data, with every
 * label and value emitted as an escaped string literal, never as code. The
 * output is never evaluated by the Studio or the website; if it is ever
 * previewed, only inside an `<iframe sandbox="allow-scripts" srcdoc>` with no
 * `allow-same-origin`.
 */
export function compileSceneToReact(_spec: SceneSpec): string {
  throw new Error("compileSceneToReact: not implemented");
}
