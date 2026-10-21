import type { SceneConnector } from "../../scene-spec";
import { anchorRect, type Rect } from "../layout";
import { entryFor, transitionFor, useScene, useVisibility } from "../context";

/** Default travel time for connector dots when no step times the line. */
const DOT_TRAVEL_MS = 1600;
const DOT_COUNT = 3;

function overlapsHorizontally(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w;
}

/**
 * A curve from one anchor to the other: side to side when the boxes sit
 * apart horizontally, otherwise top to bottom. Numbers only, so the path
 * string never carries scene text.
 */
export function connectorPath(from: Rect, to: Rect): string {
  if (overlapsHorizontally(from, to)) {
    const down = to.y > from.y;
    const start = {
      x: from.x + from.w / 2,
      y: down ? from.y + from.h : from.y,
    };
    const end = { x: to.x + to.w / 2, y: down ? to.y : to.y + to.h };
    const bend = (end.y - start.y) / 2;
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend} ${end.x} ${end.y - bend} ${end.x} ${end.y}`;
  }
  const right = to.x > from.x;
  const start = { x: right ? from.x + from.w : from.x, y: from.y + from.h / 2 };
  const end = { x: right ? to.x : to.x + to.w, y: to.y + to.h / 2 };
  const bend = (end.x - start.x) / 2;
  return `M ${start.x} ${start.y} C ${start.x + bend} ${start.y} ${end.x - bend} ${end.y} ${end.x} ${end.y}`;
}

/**
 * A hairline between two windows or elements, drawn on (sweep) when it
 * enters. With `dots`, dots travel from `from` to `to`; they are movement,
 * so reduced motion drops them. Renders inside the scene's SVG layer.
 */
export function Connector({ connector }: { connector: SceneConnector }) {
  const context = useScene();
  const { scene, theme, state, reducedMotion } = context;
  const visibility = useVisibility(connector.id);
  const from = anchorRect(scene, connector.from);
  const to = anchorRect(scene, connector.to);
  if (!(from && to)) {
    return null;
  }

  const path = connectorPath(from, to);
  const hidden = state.hidden.has(connector.id);
  const entry = entryFor(context, connector.id);
  const drawn = reducedMotion
    ? {}
    : {
        strokeDasharray: 1,
        strokeDashoffset: hidden ? 1 : 0,
        transition:
          state.lastStep[connector.id] === undefined || !entry
            ? undefined
            : transitionFor(entry, ["stroke-dashoffset"]),
      };
  const travelMs = entry?.durationMs ?? DOT_TRAVEL_MS;

  return (
    <g
      data-connector=""
      style={{
        opacity: visibility.opacity,
        transition: visibility.transition,
      }}
    >
      <path
        d={path}
        fill="none"
        pathLength={1}
        stroke={theme.secondaryText}
        strokeLinecap="round"
        strokeWidth={1.5}
        style={drawn}
      />
      {connector.dots && !hidden && !reducedMotion
        ? Array.from({ length: DOT_COUNT }, (_, dot) => (
            <circle fill={theme.secondaryText} key={dot} r={3}>
              <animateMotion
                begin={`${(dot * travelMs) / DOT_COUNT}ms`}
                dur={`${travelMs}ms`}
                path={path}
                repeatCount="indefinite"
              />
            </circle>
          ))
        : null}
    </g>
  );
}
