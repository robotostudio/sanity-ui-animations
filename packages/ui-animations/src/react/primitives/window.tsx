import type { SceneWindow } from "../../scene-spec";
import { LAYOUT, elementRects } from "../layout";
import { useScene, usePxToCqw, useVisibility, withOpacity } from "../context";
import { Element } from "./element";

/**
 * A rounded glass panel with macOS chrome: three neutral traffic lights,
 * then the title (or, for `browser`, a centred address field). No shadow.
 */
export function Window({ sceneWindow }: { sceneWindow: SceneWindow }) {
  const { tokens, theme, scene } = useScene();
  const unit = usePxToCqw();
  const visibility = useVisibility(sceneWindow.id);
  const chrome = tokens.windowChrome;
  const rects = elementRects(sceneWindow);
  const lightColor = sceneWindow.active
    ? theme.trafficLight.active
    : theme.trafficLight.inactive;
  // The bright top edge: whichever of card and hairline is the lighter tone
  // in this theme.
  const edge = scene.theme === "light" ? theme.card : theme.hairline;

  return (
    <div
      data-window={sceneWindow.kind}
      style={{
        position: "absolute",
        left: unit(sceneWindow.x),
        top: unit(sceneWindow.y),
        width: unit(sceneWindow.w),
        height: unit(sceneWindow.h),
        boxSizing: "border-box",
        borderRadius: unit(chrome.cornerRadiusPx),
        border: `1px solid ${theme.hairline}`,
        background: withOpacity(
          theme.glassFill.color,
          theme.glassFill.opacity * 100
        ),
        backdropFilter: `blur(${unit(chrome.backdropBlurPx)})`,
        WebkitBackdropFilter: `blur(${unit(chrome.backdropBlurPx)})`,
        boxShadow: `inset 0 ${chrome.topEdgePx}px 0 ${edge}`,
        overflow: "hidden",
        ...visibility,
      }}
    >
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: unit(LAYOUT.titleBarPx),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${theme.hairline}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: unit(chrome.trafficLightInsetPx),
            display: "grid",
            gridAutoFlow: "column",
            gap: unit(chrome.trafficLightGapPx),
          }}
        >
          {[0, 1, 2].map((light) => (
            <span
              key={light}
              style={{
                width: unit(chrome.trafficLightDiameterPx),
                height: unit(chrome.trafficLightDiameterPx),
                borderRadius: "50%",
                background: lightColor,
              }}
            />
          ))}
        </div>
        <span
          style={{
            maxWidth: "55%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: theme.secondaryText,
            fontSize: unit(12),
            ...(sceneWindow.kind === "browser"
              ? {
                  paddingInline: unit(12),
                  lineHeight: unit(24),
                  borderRadius: unit(chrome.cornerRadiusPx / 2),
                  background: withOpacity(theme.card, 70),
                }
              : {}),
          }}
        >
          {sceneWindow.title}
        </span>
      </div>
      {sceneWindow.elements.map((element) => {
        const rect = rects.get(element.id);
        if (!rect) {
          return null;
        }
        return (
          <Element
            element={element}
            key={element._key}
            rect={{
              ...rect,
              x: rect.x - sceneWindow.x,
              y: rect.y - sceneWindow.y,
            }}
          />
        );
      })}
    </div>
  );
}
