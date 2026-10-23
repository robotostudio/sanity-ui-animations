import {
  cursorDestination,
  cursorStart,
  LAYOUT,
  type Point,
} from "./react/layout";
import { glideMs, SWEEP_FALLBACK_MS } from "./react/timeline";
import type { SceneSpec, SceneStep } from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "./tokens";

/**
 * Compile a normalised, valid SceneSpec into a self-contained React (TSX)
 * source string, stored in `animation.reactCode` for editors to copy.
 *
 * Deterministic codegen: string templates over the spec's data, with every
 * label and value emitted as an escaped string literal, never as code. The
 * output is never evaluated by the Studio or the website; if it is ever
 * previewed, only inside an `<iframe sandbox="allow-scripts" srcdoc>` with no
 * `allow-same-origin`.
 *
 * Only data crosses into the output, and only through `literal`: the spec is
 * first copied into a plain tree of known fields (`sceneData`), coercing
 * every value to a string, finite number, boolean or null, so a field holding
 * anything else (an object where a label should be, an extra key) never
 * reaches the template. Layout and timing are resolved here, so the emitted
 * component only reads numbers.
 */
export function compileSceneToReact(
  spec: SceneSpec,
  tokens: DesignTokens = DEFAULT_TOKENS
): string {
  const scene = sceneData(spec, tokens);
  const theme = themeData(spec.theme === "dark" ? "dark" : "light", tokens);
  // One pass, so placeholder-like text inside the data is never substituted.
  return RUNTIME.replace(/__(SCENE|THEME)__/g, (_match, name) =>
    literal(name === "SCENE" ? scene : theme)
  );
}

/** A value `literal` can emit. */
type Data = string | number | boolean | null | Data[] | { [key: string]: Data };

/**
 * Sequences escaped even inside a string literal, as defence in depth: `` ` ``
 * and `${` stay inert if the code is pasted into a template literal, `<`, `>`
 * and `&` if it is embedded in an HTML `<script>` or `srcdoc`, and U+2028/9
 * for older parsers. A lone `$` (a price) is left readable.
 */
const UNSAFE_IN_LITERAL = /[<>&\u0060\u2028\u2029]|\$(?=\{)/g;

/** A JavaScript string literal for `value`, built on `JSON.stringify`. */
function stringLiteral(value: string): string {
  return JSON.stringify(value).replace(
    UNSAFE_IN_LITERAL,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

function literal(value: Data, indent = ""): string {
  if (typeof value === "string") {
    return stringLiteral(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0)
      ? String(value)
      : "0";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null) {
    return "null";
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${inner}${literal(item, inner)},`);
    return `[\n${items.join("\n")}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return "{}";
  }
  // Keys are this module's own field names, but quote them anyway so a key
  // can never be read as code.
  const fields = entries.map(
    ([key, item]) => `${inner}${stringLiteral(key)}: ${literal(item, inner)},`
  );
  return `{\n${fields.join("\n")}\n${indent}}`;
}

const str = (value: unknown): string =>
  typeof value === "string" ? value : "";

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const list = <T>(value: readonly T[] | undefined): readonly T[] =>
  Array.isArray(value) ? value : [];

function badgeData(badge: unknown): Data {
  if (!badge || typeof badge !== "object") {
    return null;
  }
  const { status, label } = badge as { status?: unknown; label?: unknown };
  return { status: str(status), label: str(label) };
}

function sceneData(spec: SceneSpec, tokens: DesignTokens) {
  const anchors = new Map<string, Point>();

  const windows = list(spec.windows).map((window) => {
    const x = num(window.x);
    const y = num(window.y);
    const w = num(window.w);
    // The Scene renderer's geometry (react/layout.ts), so the copied code
    // draws what the Preview tab draws.
    let top = LAYOUT.titleBarPx + LAYOUT.paddingPx;
    const elements = list(window.elements).map((element) => {
      const kind = str(element.kind);
      const h =
        kind === "card" || kind === "button"
          ? LAYOUT.elementHeightPx[kind]
          : LAYOUT.elementHeightPx.row;
      const box = {
        x: LAYOUT.paddingPx,
        y: top,
        w: Math.max(0, w - LAYOUT.paddingPx * 2),
        h,
      };
      top += h + LAYOUT.gapPx;
      anchors.set(str(element.id), {
        x: Math.round(x + box.x + box.w / 2),
        y: Math.round(y + box.y + box.h / 2),
      });
      return {
        id: str(element.id),
        kind,
        label: str(element.label),
        value: typeof element.value === "string" ? element.value : null,
        badge: badgeData(element.badge),
        accent: element.accent === true,
        ...box,
      };
    });
    anchors.set(str(window.id), {
      x: Math.round(x + w / 2),
      y: Math.round(y + num(window.h) / 2),
    });
    return {
      id: str(window.id),
      title: str(window.title),
      kind: str(window.kind),
      x,
      y,
      w,
      h: num(window.h),
      active: window.active !== false,
      elements,
    };
  });

  const pointOf = (anchor: { windowId?: unknown; elementId?: unknown }) =>
    anchors.get(str(anchor.elementId)) ??
    anchors.get(str(anchor.windowId)) ?? { x: 0, y: 0 };

  const connectors = list(spec.connectors).map((connector) => {
    const from = pointOf(connector.from ?? {});
    const to = pointOf(connector.to ?? {});
    return {
      id: str(connector.id),
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      dots: connector.dots === true,
    };
  });

  const targets = list(spec.cursor?.targets).map((target) => {
    const point = pointOf(target);
    return { id: str(target.id), x: point.x, y: point.y };
  });

  let clock = 0;
  // The Scene renderer's cursor path, for its distance-timed moves. The spec
  // should be valid here, but a malformed one only loses that timing.
  let cursorAt = guarded(() => cursorStart(spec)) ?? { x: 0, y: 0 };
  const steps = list(spec.steps).map((step) => {
    const at = clock + Math.max(0, num(step.delayMs));
    const destination = guarded(() =>
      cursorDestination(spec, str(step.target))
    );
    const durationMs = stepDuration(step, tokens, cursorAt, destination);
    if (destination && (step.action === "move" || step.action === "click")) {
      cursorAt = destination;
    }
    clock = at + durationMs;
    return {
      key: str(step._key),
      action: str(step.action),
      target: str(step.target),
      at,
      durationMs,
      ease: roleOf(tokens, step.role)?.css ?? "ease",
      value: typeof step.value === "string" ? step.value : null,
      badge: badgeData(step.badge),
    };
  });

  const startsHidden: Data[] = [];
  const seen = new Set<string>();
  for (const step of list(spec.steps)) {
    const target = str(step.target);
    if (
      (step.action === "enter" || step.action === "reveal") &&
      !seen.has(target)
    ) {
      startsHidden.push({
        id: target,
        transform:
          step.action === "reveal"
            ? `translateY(${num(roleOf(tokens, "reveal")?.risePx, 16)}px)`
            : `scale(${num(roleOf(tokens, "enter")?.scaleFrom, 0.96)})`,
      });
    }
    seen.add(target);
  }

  const start = spec.cursor?.start;
  const stillIndex = list(spec.steps).findIndex(
    (step) => step._key === spec.stillStepKey
  );

  return {
    mode: str(spec.sceneMode),
    label: str(spec.label),
    size: num(spec.canvas?.size, tokens.canvas.defaultSizePx),
    titleBar: LAYOUT.titleBarPx,
    windows,
    connectors,
    cursor: spec.cursor
      ? {
          start: start ? { x: num(start.x), y: num(start.y) } : null,
          targets,
        }
      : null,
    steps,
    startsHidden,
    totalMs: clock,
    stillIndex: stillIndex === -1 ? steps.length - 1 : stillIndex,
  };
}

/**
 * The step's duration as react/timeline.ts's buildTimeline sets it, so the
 * compiled component keeps the Preview's timing: a `move` with no
 * `durationMs` takes the hop / glide distance rule, not the glide maximum.
 */
function stepDuration(
  step: SceneStep,
  tokens: DesignTokens,
  from: Point,
  destination: Point | undefined
): number {
  if (typeof step.durationMs === "number" && Number.isFinite(step.durationMs)) {
    return Math.max(0, step.durationMs);
  }
  if (step.action === "move" && destination) {
    return glideMs(tokens, from, destination);
  }
  return roleOf(tokens, step.role)?.duration?.maxMs ?? SWEEP_FALLBACK_MS;
}

/** `read()`, or undefined if it throws on a malformed spec. */
function guarded<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return;
  }
}

/** A role's token, or undefined when the tokens (or the step) lack it. */
const roleOf = (tokens: DesignTokens, role: unknown) =>
  tokens.roles.find((entry) => entry.role === role);

function themeData(theme: "light" | "dark", tokens: DesignTokens) {
  const colors = tokens.scene[theme];
  const chrome = tokens.windowChrome;
  return {
    ground: [...colors.groundTones],
    glass: colors.glassFill.color,
    glassOpacity: num(colors.glassFill.opacity, 0.55),
    card: colors.card,
    hairline: colors.hairline,
    text: colors.text,
    secondaryText: colors.secondaryText,
    tide: tokens.tide.color,
    tideText: tokens.tide.textColor,
    trafficActive: colors.trafficLight.active,
    trafficInactive: colors.trafficLight.inactive,
    radius: num(chrome.cornerRadiusPx),
    blur: num(chrome.backdropBlurPx),
    lightDiameter: num(chrome.trafficLightDiameterPx),
    lightGap: num(chrome.trafficLightGapPx),
    lightInset: num(chrome.trafficLightInsetPx),
    badgeHeight: num(tokens.badges.heightPx),
    badgeDot: num(tokens.badges.dotPx),
    badgeColors: { ...tokens.badges.colors },
    badgeNeutral: tokens.badges.neutral.fill,
    font: tokens.typography.sans,
  };
}

/**
 * The fixed component the data is spliced into. It must contain no template
 * literals, so `${` in the output can only ever come from data, which
 * `literal` escapes.
 */
const RUNTIME = `"use client";

// Generated by compileSceneToReact from @sanity-ui-animations/ui-animations.
// Self-contained: it needs only React. Do not edit by hand; regenerate it.

import { type CSSProperties, useEffect, useState } from "react";

type Badge = { status: string; label: string };
type Point = { x: number; y: number };
type Hidden = { id: string; transform: string };
type Motion = { durationMs: number; ease: string };

type Scene = {
  mode: string;
  label: string;
  size: number;
  titleBar: number;
  windows: {
    id: string;
    title: string;
    kind: string;
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
    elements: {
      id: string;
      kind: string;
      label: string;
      value: string | null;
      badge: Badge | null;
      accent: boolean;
      x: number;
      y: number;
      w: number;
      h: number;
    }[];
  }[];
  connectors: {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    dots: boolean;
  }[];
  cursor: { start: Point | null; targets: (Point & { id: string })[] } | null;
  steps: (Motion & {
    key: string;
    action: string;
    target: string;
    at: number;
    value: string | null;
    badge: Badge | null;
  })[];
  startsHidden: Hidden[];
  totalMs: number;
  stillIndex: number;
};

const SCENE: Scene = __SCENE__;

const THEME = __THEME__;

const LOOP_PAUSE_MS = 1200;

function derive(landed: number) {
  const hidden = new Map<string, string>(
    SCENE.startsHidden.map((entry) => [entry.id, entry.transform])
  );
  const values = new Map<string, string>();
  const badges = new Map<string, Badge | null>();
  const motion = new Map<string, Motion>();
  let cursor: Point | null = SCENE.cursor?.start ?? null;
  let cursorMotion: Motion = { durationMs: 0, ease: "linear" };
  let pressed = false;
  SCENE.steps.slice(0, landed).forEach((step, index) => {
    motion.set(step.target, step);
    if (step.action === "enter" || step.action === "reveal") {
      hidden.delete(step.target);
    } else if (step.action === "exit") {
      hidden.set(step.target, "scale(1)");
    } else if (step.action === "update") {
      if (step.value !== null) {
        values.set(step.target, step.value);
      }
      if (step.badge !== null) {
        badges.set(step.target, step.badge);
      }
    } else if (step.action === "move" || step.action === "click") {
      const target = SCENE.cursor?.targets.find((t) => t.id === step.target);
      if (target) {
        cursor = { x: target.x, y: target.y };
        cursorMotion = step;
      }
      pressed = step.action === "click" && index === landed - 1;
    }
  });
  return { hidden, values, badges, motion, cursor, cursorMotion, pressed };
}

function transition(motion: Motion | undefined): string | undefined {
  if (!motion) {
    return undefined;
  }
  const timing = String(motion.durationMs) + "ms " + motion.ease;
  return "opacity " + timing + ", transform " + timing;
}

function shown(
  id: string,
  state: ReturnType<typeof derive>
): CSSProperties {
  const transform = state.hidden.get(id);
  return {
    opacity: transform === undefined ? 1 : 0,
    transform: transform === undefined ? "none" : transform,
    transition: transition(state.motion.get(id)),
  };
}

function BadgePill({ badge }: { badge: Badge }) {
  const colors: Record<string, string> = THEME.badgeColors;
  const color = colors[badge.status];
  return (
    <span
      style={{
        alignItems: "center",
        background: color ? color + "1F" : THEME.badgeNeutral,
        borderRadius: 999,
        display: "inline-flex",
        fontSize: 12,
        gap: 6,
        height: THEME.badgeHeight,
        padding: "0 10px",
      }}
    >
      {color ? (
        <span
          style={{
            background: color,
            borderRadius: 999,
            height: THEME.badgeDot,
            width: THEME.badgeDot,
          }}
        />
      ) : null}
      {badge.label}
    </span>
  );
}

export default function SceneAnimation() {
  const [landed, setLanded] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      setLanded(
        SCENE.mode === "ambient" ? SCENE.stillIndex + 1 : SCENE.steps.length
      );
      return;
    }
    const timers: number[] = [];
    const play = () => {
      for (const timer of timers.splice(0)) {
        window.clearTimeout(timer);
      }
      setLanded(0);
      SCENE.steps.forEach((step, index) => {
        timers.push(window.setTimeout(() => setLanded(index + 1), step.at));
      });
      if (SCENE.mode === "ambient") {
        timers.push(window.setTimeout(play, SCENE.totalMs + LOOP_PAUSE_MS));
      }
    };
    play();
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const state = derive(landed);
  const [tone1, tone2, tone3] = THEME.ground;

  return (
    <div
      aria-label={SCENE.label}
      role="img"
      style={{
        aspectRatio: "1 / 1",
        background:
          "radial-gradient(circle at 20% 20%, " + tone1 + ", " + tone2 +
          " 55%, " + tone3 + ")",
        color: THEME.text,
        containerType: "inline-size",
        fontFamily: THEME.font + ", system-ui, sans-serif",
        maxWidth: SCENE.size,
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          height: SCENE.size,
          left: 0,
          position: "absolute",
          top: 0,
          transform: "scale(calc(100cqw / " + String(SCENE.size) + "px))",
          transformOrigin: "0 0",
          width: SCENE.size,
        }}
      >
        <svg
          height={SCENE.size}
          style={{ left: 0, position: "absolute", top: 0 }}
          width={SCENE.size}
        >
          {SCENE.connectors.map((connector) => (
            <line
              key={connector.id}
              stroke={THEME.secondaryText}
              strokeDasharray={connector.dots ? "2 6" : undefined}
              strokeLinecap="round"
              style={shown(connector.id, state)}
              x1={connector.x1}
              x2={connector.x2}
              y1={connector.y1}
              y2={connector.y2}
            />
          ))}
        </svg>
        {SCENE.windows.map((win) => (
          <div
            key={win.id}
            style={{
              ...shown(win.id, state),
              backdropFilter: "blur(" + String(THEME.blur) + "px)",
              background: THEME.glass,
              borderRadius: THEME.radius,
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
              height: win.h,
              left: win.x,
              position: "absolute",
              top: win.y,
              width: win.w,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: THEME.lightGap,
                height: SCENE.titleBar,
                paddingLeft: THEME.lightInset,
              }}
            >
              {[0, 1, 2].map((light) => (
                <span
                  key={light}
                  style={{
                    background: win.active
                      ? THEME.trafficActive
                      : THEME.trafficInactive,
                    borderRadius: 999,
                    height: THEME.lightDiameter,
                    width: THEME.lightDiameter,
                  }}
                />
              ))}
              <span
                style={{
                  color: THEME.secondaryText,
                  flex: 1,
                  fontSize: 13,
                  paddingRight: THEME.lightInset,
                  textAlign: "center",
                }}
              >
                {win.title}
              </span>
            </div>
            {win.elements.map((element) => {
              const badge = state.badges.get(element.id) ?? element.badge;
              const value = state.values.get(element.id) ?? element.value;
              return (
                <div
                  key={element.id}
                  style={{
                    ...shown(element.id, state),
                    alignItems: "center",
                    background: element.accent ? THEME.tide : THEME.card,
                    border: "1px solid " + THEME.hairline,
                    borderRadius: element.kind === "button" ? 999 : 12,
                    color: element.accent ? THEME.tideText : THEME.text,
                    display: "flex",
                    fontSize: 14,
                    gap: 8,
                    height: element.h,
                    justifyContent:
                      element.kind === "button" ? "center" : "space-between",
                    left: element.x,
                    padding: "0 14px",
                    position: "absolute",
                    top: element.y,
                    width: element.w,
                  }}
                >
                  <span>{element.label}</span>
                  {badge ? <BadgePill badge={badge} /> : null}
                  {value === null ? null : (
                    <span style={{ color: THEME.secondaryText }}>{value}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {state.cursor ? (
          <svg
            height={22}
            style={{
              left: 0,
              position: "absolute",
              top: 0,
              transform:
                "translate(" + String(state.cursor.x + 6) + "px, " +
                String(state.cursor.y + 6) + "px) scale(" +
                (state.pressed ? "0.8" : "1") + ")",
              transition:
                "transform " + String(state.cursorMotion.durationMs) + "ms " +
                state.cursorMotion.ease,
            }}
            viewBox="0 0 16 22"
            width={16}
          >
            <path
              d="M1 1v17l4.5-4.5 3 7 3-1.3-3-6.9H15z"
              fill={THEME.text}
              stroke={THEME.card}
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
`;
