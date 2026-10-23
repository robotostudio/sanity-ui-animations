import { useEffect, useState } from "react";

import type { SceneSpec } from "../scene-spec";
import { restStepCount, type Timeline } from "./timeline";

/** Ambient scenes hold their final state this long before looping. */
export const AMBIENT_HOLD_MS = 2000;
/** And fade the stage out over this long while they reset. */
export const AMBIENT_FADE_MS = 400;

export type ScenePlayback = {
  /** How many steps have landed. */
  count: number;
  /** True while an ambient scene fades out to loop. */
  resetting: boolean;
};

/**
 * Step player. Each step lands at its `startMs`, and the primitives
 * transition into the new state on that step's duration and curve. Intro and
 * interactive scenes play once and rest; ambient scenes hold, fade and loop.
 * Under reduced motion nothing plays: the scene shows its still
 * (`restStepCount`).
 */
export function useScenePlayer(
  scene: SceneSpec,
  timeline: Timeline,
  reducedMotion: boolean
): ScenePlayback {
  const [playback, setPlayback] = useState<ScenePlayback>({
    count: 0,
    resetting: false,
  });

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let frame = 0;
    const later = (ms: number, run: () => void) => {
      timers.push(setTimeout(run, ms));
    };

    const play = () => {
      // Everything scheduled by the previous loop has fired by now.
      timers.length = 0;
      setPlayback({ count: 0, resetting: false });
      // Two frames, so the hidden start state is painted before step one
      // lands and CSS transitions have something to run from.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          timeline.entries.forEach((entry, index) => {
            later(entry.startMs, () =>
              setPlayback({ count: index + 1, resetting: false })
            );
          });
          if (scene.sceneMode === "ambient") {
            later(timeline.totalMs + AMBIENT_HOLD_MS, () =>
              setPlayback((current) => ({ ...current, resetting: true }))
            );
            later(timeline.totalMs + AMBIENT_HOLD_MS + AMBIENT_FADE_MS, play);
          }
        });
      });
    };
    play();

    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [scene.sceneMode, timeline, reducedMotion]);

  return reducedMotion
    ? { count: restStepCount(scene), resetting: false }
    : playback;
}
