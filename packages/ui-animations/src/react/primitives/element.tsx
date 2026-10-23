import { type CSSProperties, type RefObject, useEffect, useRef } from "react";

import type { SceneElement } from "../../scene-spec";
import type { Rect } from "../layout";
import { usePxToCqw, useScene, useVisibility } from "../context";
import { entryAt, findRole } from "../timeline";
import { Badge } from "./badge";

/**
 * Fade an element's trailing content in whenever an `update` step changes it.
 * Under reduced motion the scene is a still, so there is nothing to play.
 */
function useUpdateFade(ref: RefObject<HTMLElement | null>, id: string) {
  const { tokens, timeline, state, reducedMotion } = useScene();
  const entry = entryAt(timeline, state.lastStep[id]);
  const update = entry?.step.action === "update" ? entry : undefined;

  useEffect(() => {
    const node = ref.current;
    if (!(update && node?.animate) || reducedMotion) {
      return;
    }
    const role = findRole(tokens, update.step.role);
    node.animate(
      [
        { opacity: 0, transform: `scale(${role?.scaleFrom ?? 1})` },
        { opacity: 1, transform: "none" },
      ],
      { duration: update.durationMs, easing: update.easing }
    );
  }, [ref, update, tokens, reducedMotion]);
}

/** Press an element (scale to `pressScale` and back) when the cursor clicks it. */
function usePress(ref: RefObject<HTMLElement | null>, id: string) {
  const { scene, tokens, timeline, state, reducedMotion } = useScene();
  const click = entryAt(timeline, state.lastClick);
  const target = scene.cursor?.targets.find(
    (entry) => entry.id === click?.step.target
  );
  const press = target?.elementId === id ? click : undefined;

  useEffect(() => {
    const node = ref.current;
    if (!(press && node?.animate) || reducedMotion) {
      return;
    }
    node.animate(
      [
        { transform: "scale(1)" },
        { transform: `scale(${tokens.choreography.pressScale})` },
        { transform: "scale(1)" },
      ],
      {
        delay: tokens.choreography.cursor.clickSettleMs,
        duration: press.durationMs,
        easing: press.easing,
      }
    );
  }, [ref, press, tokens, reducedMotion]);
}

/**
 * A solid row, card or button inside a window, at `rect` (relative to the
 * window). Its value and badge come from the scene state, so `update` steps
 * swap them in place with an enter-role fade.
 */
export function Element({
  element,
  rect,
}: {
  element: SceneElement;
  rect: Rect;
}) {
  const { tokens, theme, state } = useScene();
  const unit = usePxToCqw();
  const visibility = useVisibility(element.id);
  const ref = useRef<HTMLDivElement>(null);
  const trailingRef = useRef<HTMLSpanElement>(null);

  const value = state.values[element.id];
  const badge = state.badges[element.id];
  const radius = tokens.windowChrome.cornerRadiusPx / 2;

  useUpdateFade(trailingRef, element.id);
  usePress(ref, element.id);

  const shape: CSSProperties =
    element.kind === "row"
      ? { borderBottom: `1px solid ${theme.hairline}` }
      : {
          borderRadius: unit(radius),
          border: `1px solid ${theme.hairline}`,
          background: theme.card,
        };
  const accent: CSSProperties = element.accent
    ? {
        background: tokens.tide.color,
        borderColor: tokens.tide.color,
        color: tokens.tide.textColor,
      }
    : {};

  return (
    <div
      data-element={element.kind}
      ref={ref}
      style={{
        position: "absolute",
        left: unit(rect.x),
        top: unit(rect.y),
        width: unit(rect.w),
        height: unit(rect.h),
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: element.kind === "button" ? "center" : "space-between",
        gap: unit(8),
        paddingInline: unit(element.kind === "row" ? 4 : 14),
        color: theme.text,
        fontSize: unit(14),
        fontWeight:
          element.kind === "button"
            ? tokens.typography.weights.strong
            : tokens.typography.weights.regular,
        ...shape,
        ...accent,
        ...visibility,
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {element.label}
      </span>
      {value !== undefined || badge ? (
        <span
          ref={trailingRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: unit(8),
            flexShrink: 0,
          }}
        >
          {badge ? <Badge badge={badge} /> : null}
          {value === undefined ? null : (
            <span
              style={{
                color: element.accent ? undefined : theme.secondaryText,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </span>
          )}
        </span>
      ) : null}
    </div>
  );
}
