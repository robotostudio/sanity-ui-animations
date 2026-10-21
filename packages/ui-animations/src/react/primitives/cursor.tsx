import { useEffect, useRef } from "react";

import { transitionFor, usePxToCqw, useScene } from "../context";
import { CURSOR_ID, entryAt } from "../timeline";

/** Arrow pointer, tip at the origin, in design px. */
const ARROW = "M 0 0 L 0 17 L 4.5 13 L 7.5 20 L 10.5 18.8 L 7.6 12 L 13 12 Z";

/**
 * The pointer. It glides between cursor targets on each `move` step's
 * duration and curve, and gives the two-beat click (settle, press to
 * `clickPressScale`, hold, release) on `click` steps.
 */
export function Cursor() {
  const context = useScene();
  const { scene, tokens, theme, state, timeline, reducedMotion } = context;
  const unit = usePxToCqw();
  const ref = useRef<HTMLDivElement>(null);
  // A click aimed somewhere new travels there too, on the press curve.
  const travel = entryAt(timeline, state.lastStep[CURSOR_ID]);
  const click = entryAt(timeline, state.lastClick);

  useEffect(() => {
    const node = ref.current?.firstElementChild;
    if (!(click && node?.animate) || reducedMotion) {
      return;
    }
    const { clickSettleMs, clickPressMs, clickHoldMs, clickPressScale } =
      tokens.choreography.cursor;
    const total = clickPressMs * 2 + clickHoldMs;
    node.animate(
      [
        { transform: "scale(1)", offset: 0 },
        {
          transform: `scale(${clickPressScale})`,
          offset: clickPressMs / total,
        },
        {
          transform: `scale(${clickPressScale})`,
          offset: (clickPressMs + clickHoldMs) / total,
        },
        { transform: "scale(1)", offset: 1 },
      ],
      { delay: clickSettleMs, duration: total, easing: click.easing }
    );
  }, [click, tokens, reducedMotion]);

  if (!scene.cursor) {
    return null;
  }

  return (
    <div
      data-cursor=""
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${unit(state.cursor.x)}, ${unit(state.cursor.y)})`,
        transition:
          travel && !reducedMotion
            ? transitionFor(travel, ["transform"])
            : undefined,
      }}
    >
      <svg
        aria-hidden="true"
        style={{
          display: "block",
          width: unit(14),
          height: unit(21),
          transformOrigin: "0 0",
          overflow: "visible",
        }}
        viewBox="0 0 14 21"
      >
        <path
          d={ARROW}
          fill={theme.text}
          stroke={theme.card}
          strokeLinejoin="round"
          strokeWidth={1.2}
        />
      </svg>
    </div>
  );
}
