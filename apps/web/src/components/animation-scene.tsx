"use client";

import type { SceneSpec } from "@sanity-ui-animations/ui-animations";
import { Scene } from "@sanity-ui-animations/ui-animations/react";

/**
 * Client boundary for the trusted primitive renderer, which plays the scene
 * with hooks. It only ever receives data: a normalised, validated SceneSpec.
 */
export function AnimationScene({ scene }: Readonly<{ scene: SceneSpec }>) {
  return <Scene scene={scene} />;
}
