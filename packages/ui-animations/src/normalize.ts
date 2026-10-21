import { cursorGlideRange, cursorTargetPoint, type Point } from "./cursor";
import { nearestMember } from "./enum";
import { MAX_STEP_MS, MIN_WINDOW_H, MIN_WINDOW_W } from "./limits";
import {
  BADGE_STATUSES,
  ELEMENT_KINDS,
  MOTION_ROLES,
  type MotionRole,
  SCENE_MODES,
  SCENE_THEMES,
  type SceneAnchor,
  type SceneBadge,
  type SceneConnector,
  type SceneCursor,
  type SceneElement,
  type SceneSpec,
  type SceneSpecDraft,
  type SceneStep,
  type SceneWindow,
  STEP_ACTIONS,
  type StepAction,
  WINDOW_KINDS,
} from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens, roleToken } from "./tokens";

const DEFAULT_WINDOW_W = 360;
const DEFAULT_WINDOW_H = 320;

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
 * Duplicate ids are left alone for `validateScene` to report: which of two
 * things the model meant is not something to guess.
 *
 * Pure and deterministic: the same draft and tokens give the same output,
 * and normalising a normalised scene changes nothing.
 */
export function normalizeScene(
  spec: SceneSpecDraft,
  tokens: DesignTokens = DEFAULT_TOKENS
): SceneSpec {
  const raw = asRecord(spec);
  const size = Math.round(
    clamp(
      asNumber(asRecord(raw.canvas).size) ?? tokens.canvas.defaultSizePx,
      tokens.canvas.minSizePx,
      tokens.canvas.maxSizePx
    )
  );
  const ids = new IdAllocator(raw);

  let accentsLeft = tokens.tide.maxPerScene;
  const rawWindows = asArray(raw.windows);
  const windowKeys = assignKeys(rawWindows, "window");
  const windows = rawWindows.map((item, index): SceneWindow => {
    const win = asRecord(item);
    const id = ids.take(win.id, "window");
    const rawElements = asArray(win.elements);
    const elementKeys = assignKeys(rawElements, "element");
    const elements = rawElements.map((entry, elementIndex) => {
      const element = normalizeElement(
        asRecord(entry),
        elementKeys[elementIndex] ?? "",
        ids,
        accentsLeft > 0
      );
      if (element.accent) {
        accentsLeft -= 1;
      }
      return element;
    });
    const w = Math.round(
      clamp(asNumber(win.w) ?? DEFAULT_WINDOW_W, MIN_WINDOW_W, size)
    );
    const h = Math.round(
      clamp(asNumber(win.h) ?? DEFAULT_WINDOW_H, MIN_WINDOW_H, size)
    );
    return {
      _key: windowKeys[index] ?? "",
      id,
      title: asString(win.title) || id,
      kind:
        nearestMember(win.kind, WINDOW_KINDS, WINDOW_KIND_SYNONYMS) ?? "app",
      x: Math.round(clamp(asNumber(win.x) ?? (size - w) / 2, 0, size - w)),
      y: Math.round(clamp(asNumber(win.y) ?? (size - h) / 2, 0, size - h)),
      w,
      h,
      ...(typeof win.active === "boolean" ? { active: win.active } : {}),
      elements,
    };
  });

  const resolveAnchor = anchorResolver(windows);

  const rawConnectors = asArray(raw.connectors);
  const connectorKeys = assignKeys(rawConnectors, "connector");
  const connectors = rawConnectors.flatMap((item, index): SceneConnector[] => {
    const connector = asRecord(item);
    const id = ids.take(connector.id, "connector");
    const from = resolveAnchor(asRecord(connector.from));
    const to = resolveAnchor(asRecord(connector.to));
    if (!(from && to)) {
      return [];
    }
    return [
      {
        _key: connectorKeys[index] ?? "",
        id,
        from,
        to,
        dots: typeof connector.dots === "boolean" ? connector.dots : true,
      },
    ];
  });

  const cursor = normalizeCursor(raw.cursor, size, ids, resolveAnchor);

  const targetKinds = new Map<string, TargetKind>();
  const register = (id: string, kind: TargetKind) => {
    if (!targetKinds.has(id)) {
      targetKinds.set(id, kind);
    }
  };
  for (const win of windows) {
    register(win.id, "window");
    for (const element of win.elements) {
      register(element.id, "element");
    }
  }
  for (const connector of connectors) {
    register(connector.id, "connector");
  }
  for (const target of cursor?.targets ?? []) {
    register(target.id, "cursor");
  }

  const steps = normalizeSteps(
    asArray(raw.steps),
    targetKinds,
    { windows, cursor },
    tokens
  );

  const sceneMode = nearestMember(raw.sceneMode, SCENE_MODES, MODE_SYNONYMS);
  const stillStepKey = asString(raw.stillStepKey);
  const stillStep =
    steps.find((step) => step._key === stillStepKey)?._key ??
    (sceneMode === "ambient" ? steps.at(-1)?._key : undefined);

  return {
    sceneMode: sceneMode ?? "intro",
    theme: nearestMember(raw.theme, SCENE_THEMES, THEME_SYNONYMS) ?? "light",
    canvas: { size },
    label: asString(raw.label) ?? "",
    windows,
    connectors,
    ...(cursor ? { cursor } : {}),
    steps,
    ...(stillStep ? { stillStepKey: stillStep } : {}),
  };
}

function normalizeElement(
  element: Raw,
  key: string,
  ids: IdAllocator,
  accentAllowed: boolean
): SceneElement {
  const value = asString(element.value);
  const badge = normalizeBadge(element.badge);
  return {
    _key: key,
    id: ids.take(element.id, "element"),
    kind:
      nearestMember(element.kind, ELEMENT_KINDS, ELEMENT_KIND_SYNONYMS) ??
      "row",
    label: asString(element.label) ?? "",
    ...(value ? { value } : {}),
    ...(badge ? { badge } : {}),
    ...(element.accent === true && accentAllowed ? { accent: true } : {}),
  };
}

function normalizeBadge(value: unknown): SceneBadge | undefined {
  if (value === undefined || value === null) {
    return;
  }
  const badge = asRecord(value);
  const label = asString(badge.label);
  if (!label) {
    return;
  }
  return {
    status:
      nearestMember(badge.status, BADGE_STATUSES, BADGE_SYNONYMS) ?? "neutral",
    label,
  };
}

type AnchorResolver = (anchor: Raw) => SceneAnchor | undefined;

/**
 * Resolve an anchor against the windows. An element id is the more specific
 * of the two, so when it names an element in a different window the anchor
 * moves to that window; an element id that resolves nowhere is dropped and
 * the anchor falls back to its window; with no window either, there is
 * nothing to anchor to.
 */
function anchorResolver(windows: readonly SceneWindow[]): AnchorResolver {
  return (anchor) => {
    const elementId = asString(anchor.elementId);
    const owner = elementId
      ? windows.find((win) =>
          win.elements.some((element) => element.id === elementId)
        )
      : undefined;
    if (owner && elementId) {
      return { windowId: owner.id, elementId };
    }
    const windowId = asString(anchor.windowId);
    return windows.some((win) => win.id === windowId) && windowId
      ? { windowId }
      : undefined;
  };
}

function normalizeCursor(
  value: unknown,
  size: number,
  ids: IdAllocator,
  resolveAnchor: AnchorResolver
): SceneCursor | undefined {
  if (value === undefined || value === null) {
    return;
  }
  const cursor = asRecord(value);
  const start = asRecord(cursor.start);
  const x = asNumber(start.x);
  const y = asNumber(start.y);
  const rawTargets = asArray(cursor.targets);
  const keys = assignKeys(rawTargets, "target");
  const targets = rawTargets.flatMap((item, index) => {
    const target = asRecord(item);
    const id = ids.take(target.id, "target");
    const anchor = resolveAnchor(target);
    if (!anchor) {
      return [];
    }
    return [
      {
        _key: keys[index] ?? "",
        id,
        ...anchor,
        click: typeof target.click === "boolean" ? target.click : true,
      },
    ];
  });
  return {
    ...(x !== undefined && y !== undefined
      ? {
          start: {
            x: Math.round(clamp(x, 0, size)),
            y: Math.round(clamp(y, 0, size)),
          },
        }
      : {}),
    targets,
  };
}

type TargetKind = "window" | "element" | "connector" | "cursor";

function normalizeSteps(
  rawSteps: unknown[],
  targetKinds: ReadonlyMap<string, TargetKind>,
  scene: Pick<SceneSpec, "windows" | "cursor">,
  tokens: DesignTokens
): SceneStep[] {
  const kept = rawSteps.flatMap((item) => {
    const step = asRecord(item);
    const target = asString(step.target);
    const kind = target ? targetKinds.get(target) : undefined;
    return target && kind ? [{ step, target, kind }] : [];
  });
  const keys = assignKeys(
    kept.map(({ step }) => step),
    "step"
  );
  const glideDistance = cursorTravel(scene);

  return kept.map(({ step, target, kind }, index): SceneStep => {
    const action =
      nearestMember(step.action, STEP_ACTIONS, ACTION_SYNONYMS) ??
      (kind === "cursor" ? "move" : "enter");
    const role =
      nearestMember(step.role, MOTION_ROLES, ROLE_SYNONYMS) ??
      defaultRole(action, kind);
    const distance =
      action === "move" && kind === "cursor"
        ? glideDistance(target)
        : undefined;

    const durationMs = snapDuration(step.durationMs, role, distance, tokens);
    const value = asString(step.value);
    const badge = normalizeBadge(step.badge);

    return {
      _key: keys[index] ?? "",
      action,
      target,
      role,
      delayMs: Math.round(clamp(asNumber(step.delayMs) ?? 0, 0, MAX_STEP_MS)),
      ...(durationMs === undefined ? {} : { durationMs }),
      ...(value ? { value } : {}),
      ...(badge ? { badge } : {}),
    };
  });
}

/**
 * Follows the cursor through its `move` steps: each call returns how far the
 * cursor travels to the named target from where the last move left it (or
 * from `cursor.start`), and moves it there. With no known starting point the
 * glide counts as a full one.
 */
function cursorTravel(
  scene: Pick<SceneSpec, "windows" | "cursor">
): (targetId: string) => number {
  let at: Point | undefined = scene.cursor?.start;
  return (targetId) => {
    const target = scene.cursor?.targets.find((entry) => entry.id === targetId);
    const point = target ? cursorTargetPoint(target, scene.windows) : undefined;
    const distance =
      at && point
        ? Math.hypot(point.x - at.x, point.y - at.y)
        : Number.POSITIVE_INFINITY;
    at = point ?? at;
    return distance;
  };
}

function defaultRole(action: StepAction, kind: TargetKind): MotionRole {
  if (action === "enter" && kind === "connector") {
    return "sweep";
  }
  return DEFAULT_ROLE[action];
}

const DEFAULT_ROLE: Record<StepAction, MotionRole> = {
  enter: "enter",
  move: "glide",
  click: "press",
  reveal: "reveal",
  update: "enter",
  exit: "exit",
};

/**
 * Clamp a duration into its role's range. A cursor glide uses the range the
 * distance rule gives for how far the cursor travels; `sweep` has no range
 * (its duration is the length of its track) and only stays within the
 * schema's bounds. Anything that is not a number is dropped, so the renderer
 * picks the role's default.
 */
function snapDuration(
  value: unknown,
  role: MotionRole,
  glideDistance: number | undefined,
  tokens: DesignTokens
): number | undefined {
  const ms = asNumber(value);
  if (ms === undefined) {
    return;
  }
  const range =
    role === "glide" && glideDistance !== undefined
      ? cursorGlideRange(glideDistance, tokens)
      : roleToken(tokens, role).duration;
  const min = range?.minMs ?? 0;
  const max = range?.maxMs ?? MAX_STEP_MS;
  return Math.round(clamp(ms, min, max));
}

/**
 * Hands out ids in the scene's one shared namespace. Every id the draft
 * already uses is reserved up front, so a generated id never collides with
 * one that appears later in the draft.
 */
class IdAllocator {
  private readonly used = new Set<string>();
  private readonly next = new Map<string, number>();

  constructor(raw: Raw) {
    const reserve = (item: unknown) => {
      const id = asString(asRecord(item).id);
      if (id) {
        this.used.add(id);
      }
    };
    for (const win of asArray(raw.windows)) {
      reserve(win);
      asArray(asRecord(win).elements).forEach(reserve);
    }
    asArray(raw.connectors).forEach(reserve);
    asArray(asRecord(raw.cursor).targets).forEach(reserve);
  }

  take(value: unknown, prefix: string): string {
    const id = asString(value);
    if (id) {
      return id;
    }
    let n = this.next.get(prefix) ?? 1;
    while (this.used.has(`${prefix}-${n}`)) {
      n += 1;
    }
    this.next.set(prefix, n + 1);
    const generated = `${prefix}-${n}`;
    this.used.add(generated);
    return generated;
  }
}

/**
 * One `_key` per array item, unique within the array as Sanity requires: an
 * item keeps its own key unless an earlier item already took it, and items
 * without one get `<prefix>-<n>`.
 */
function assignKeys(items: readonly unknown[], prefix: string): string[] {
  const used = new Set<string>();
  const own = items.map((item): string | undefined => {
    const key = asString(asRecord(item)._key);
    if (!key || used.has(key)) {
      return undefined;
    }
    used.add(key);
    return key;
  });
  let n = 1;
  return own.map((key) => {
    if (key) {
      return key;
    }
    while (used.has(`${prefix}-${n}`)) {
      n += 1;
    }
    const generated = `${prefix}-${n}`;
    used.add(generated);
    return generated;
  });
}

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A trimmed string, or `undefined` for anything that is not text. */
function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return;
}

/** A finite number, accepting numeric strings ("240"). */
function asNumber(value: unknown): number | undefined {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number)
    ? number
    : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const MODE_SYNONYMS = {
  loop: "ambient",
  looping: "ambient",
  background: "ambient",
  once: "intro",
  "play-once": "intro",
  interaction: "interactive",
} as const;

const THEME_SYNONYMS = {
  night: "dark",
  "dark-mode": "dark",
  day: "light",
  "light-mode": "light",
} as const;

const WINDOW_KIND_SYNONYMS = {
  safari: "browser",
  web: "browser",
  website: "browser",
  window: "app",
  desktop: "app",
  native: "app",
} as const;

const ELEMENT_KIND_SYNONYMS = {
  item: "row",
  "list-item": "row",
  line: "row",
  "line-item": "row",
  panel: "card",
  tile: "card",
  summary: "card",
  cta: "button",
  link: "button",
  action: "button",
} as const;

const BADGE_SYNONYMS = {
  ok: "success",
  paid: "success",
  done: "success",
  complete: "success",
  completed: "success",
  pending: "warning",
  caution: "warning",
  danger: "error",
  failed: "error",
  failure: "error",
  note: "info",
  default: "neutral",
  grey: "neutral",
  gray: "neutral",
} as const;

const ACTION_SYNONYMS = {
  show: "enter",
  appear: "enter",
  "fade-in": "enter",
  open: "enter",
  hide: "exit",
  remove: "exit",
  dismiss: "exit",
  close: "exit",
  change: "update",
  edit: "update",
  modify: "update",
  set: "update",
  tap: "click",
  press: "click",
  glide: "move",
  hover: "move",
  rise: "reveal",
} as const;

const ROLE_SYNONYMS = {
  click: "press",
  tap: "press",
  appear: "enter",
  "fade-in": "enter",
  close: "exit",
  reposition: "move",
  travel: "glide",
  cursor: "glide",
  rise: "reveal",
  sheet: "drawer",
  progress: "sweep",
  linear: "sweep",
} as const;
