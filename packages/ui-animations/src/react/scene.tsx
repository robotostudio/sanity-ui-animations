import { useMemo } from "react";

import type { SceneSpec } from "../scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "../tokens";
import { SceneContext, type SceneContextValue } from "./context";
import { Connector } from "./primitives/connector";
import { Cursor } from "./primitives/cursor";
import { Ground } from "./primitives/ground";
import { Window } from "./primitives/window";
import { buildTimeline, sceneStateAt } from "./timeline";
import { usePrefersReducedMotion } from "./use-reduced-motion";
import { AMBIENT_FADE_MS, useScenePlayer } from "./use-scene-player";

export type SceneProps = {
  /** An already normalised scene. */
  scene: SceneSpec;
  /** Design tokens; `DEFAULT_TOKENS` when omitted. */
  tokens?: DesignTokens;
  /**
   * Force reduced motion on or off. Omit to follow the reader's
   * `prefers-reduced-motion`.
   */
  reducedMotion?: boolean;
  className?: string;
};

/**
 * Renders a SceneSpec with the fixed primitive library. The square canvas
 * fills its container's width and scales uniformly. To assistive tech it is
 * one image described by `scene.label`; the UI inside is `aria-hidden`.
 *
 * Every string in the scene reaches the DOM only as a React text child.
 */
export function Scene({
  scene,
  tokens = DEFAULT_TOKENS,
  reducedMotion: forced,
  className,
}: SceneProps) {
  const prefersReduced = usePrefersReducedMotion();
  const reducedMotion = forced ?? prefersReduced;
  const timeline = useMemo(() => buildTimeline(scene, tokens), [scene, tokens]);
  const { count, resetting } = useScenePlayer(scene, timeline, reducedMotion);
  const state = useMemo(() => sceneStateAt(scene, count), [scene, count]);
  const theme = tokens.scene[scene.theme] ?? tokens.scene.light;

  const context = useMemo<SceneContextValue>(
    () => ({ scene, tokens, theme, timeline, state, reducedMotion }),
    [scene, tokens, theme, timeline, state, reducedMotion]
  );

  return (
    <div
      aria-label={scene.label}
      className={className}
      data-reduced-motion={reducedMotion ? "" : undefined}
      role="img"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        containerType: "inline-size",
        overflow: "hidden",
        fontFamily: `"${tokens.typography.sans}", ui-sans-serif, system-ui, sans-serif`,
        fontWeight: tokens.typography.weights.regular,
      }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        <SceneContext.Provider value={context}>
          <Ground />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: resetting ? 0 : 1,
              transition: `opacity ${AMBIENT_FADE_MS}ms linear`,
            }}
          >
            {scene.windows.map((window) => (
              <Window key={window._key} window={window} />
            ))}
            <svg
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
                pointerEvents: "none",
              }}
              viewBox={`0 0 ${scene.canvas.size} ${scene.canvas.size}`}
            >
              {scene.connectors.map((connector) => (
                <Connector connector={connector} key={connector._key} />
              ))}
            </svg>
            <Cursor />
          </div>
        </SceneContext.Provider>
      </div>
    </div>
  );
}
