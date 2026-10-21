import { cursorGlideEnvelope } from "./cursor";
import { MIN_WINDOW_H, MIN_WINDOW_W } from "./limits";
import {
  BADGE_STATUSES,
  ELEMENT_KINDS,
  MOTION_ROLES,
  type MotionRole,
  SCENE_MODES,
  SCENE_THEMES,
  STEP_ACTIONS,
  type SceneAnchor,
  type SceneSpec,
  type SceneStep,
  type SceneWindow,
  type StepAction,
  WINDOW_KINDS,
} from "./scene-spec";
import {
  DEFAULT_TOKENS,
  type DesignTokens,
  type DurationRange,
  roleToken,
} from "./tokens";

/** One segment of a path into the scene, Sanity-style. */
export type ScenePathSegment = string | number | { _key: string };

export type ValidationIssue = {
  /** `error` blocks publishing; `warning` is shown but allowed. */
  severity: "error" | "warning";
  /** Stable machine code, e.g. `tide-overused`, `dangling-target`. */
  code: ValidationCode;
  /** Sentence-case message for editors. */
  message: string;
  /** Path from the scene root, e.g. `["steps", { _key: "a1" }, "target"]`. */
  path: ScenePathSegment[];
};

/** Every code `validateScene` reports, errors first. */
export const VALIDATION_CODES = [
  "no-windows",
  "no-steps",
  "missing-label",
  "canvas-size",
  "invalid-value",
  "duplicate-id",
  "duplicate-key",
  "dangling-target",
  "dangling-anchor",
  "dangling-cursor-target",
  "dangling-still-step",
  "window-outside-canvas",
  "window-too-small",
  "tide-overused",
  "duration-out-of-range",
  "action-target-mismatch",
  "reveal-run-too-long",
  "missing-still-step",
  "role-mismatch",
  "click-before-move",
  "update-without-change",
  "step-count",
  "window-count",
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

/** The brief asks for one to three windows and 6 to 14 steps. */
const MAX_WINDOWS = 3;
const MIN_STEPS = 6;
const MAX_STEPS = 14;

/**
 * Hard rules a normalised scene must pass before it can be published. The
 * Studio's `animation.scene` validation calls this and maps errors to
 * `Rule.custom` failures; the web route refuses to render a scene with errors.
 *
 * Errors: at least one window and one step, an accessible label, canvas size
 * inside `tokens.canvas`, every enum field a known member, unique ids (one namespace) and `_key`s (per array),
 * every reference resolves (step targets, connector anchors, cursor targets,
 * `stillStepKey`), windows inside the canvas and no smaller than the
 * schema's minimum, at most
 * `tokens.tide.maxPerScene` accents, every `durationMs` inside its role's
 * range (cursor glides: anywhere from a hop to a full glide), step actions
 * suit their target (`move`/`click` on cursor targets, `update` on elements,
 * `enter`/`reveal`/`exit` on windows, elements and connectors), and at most
 * `maxItems` consecutive reveal steps.
 *
 * Warnings: an ambient scene with no reduced-motion still, a cursor step on
 * the wrong role, a click on a target the cursor has not moved to, an update
 * that changes nothing, and window or step counts outside the brief.
 *
 * Tolerates a partial scene (straight from the dataset, before
 * `normalizeScene`): a missing field is reported, never thrown on.
 *
 * Returns an empty array when the scene is valid.
 */
export function validateScene(
  scene: SceneSpec,
  tokens: DesignTokens = DEFAULT_TOKENS
): ValidationIssue[] {
  const spec = readable(scene);
  const report = new Report();
  checkCounts(spec, report);
  checkEnums(spec, report);
  checkCanvas(spec, tokens, report);
  const kinds = checkIds(spec, report);
  checkAnchors(spec, report);
  checkAccents(spec, tokens, report);
  checkStillStep(spec, report);
  checkSteps(spec, kinds, tokens, report);
  return report.issues;
}

type Path = ScenePathSegment[];

class Report {
  readonly issues: ValidationIssue[] = [];

  error(code: ValidationCode, message: string, path: Path) {
    this.issues.push({ severity: "error", code, message, path });
  }

  warn(code: ValidationCode, message: string, path: Path) {
    this.issues.push({ severity: "warning", code, message, path });
  }
}

function checkCounts(spec: SceneSpec, report: Report) {
  const windows = spec.windows;
  const steps = spec.steps;
  if (windows.length === 0) {
    report.error("no-windows", "The scene needs at least one window.", [
      "windows",
    ]);
  } else if (windows.length > MAX_WINDOWS) {
    report.warn(
      "window-count",
      `Scenes read best with one to ${MAX_WINDOWS} windows; this one has ${windows.length}.`,
      ["windows"]
    );
  }
  if (steps.length === 0) {
    report.error("no-steps", "The scene needs at least one step.", ["steps"]);
  } else if (steps.length < MIN_STEPS || steps.length > MAX_STEPS) {
    report.warn(
      "step-count",
      `Scenes tell their story in ${MIN_STEPS} to ${MAX_STEPS} steps; this one has ${steps.length}.`,
      ["steps"]
    );
  }
  if (!spec.label.trim()) {
    report.error(
      "missing-label",
      "Add an accessible description: screen readers read it instead of the animation.",
      ["label"]
    );
  }
}

function checkCanvas(spec: SceneSpec, tokens: DesignTokens, report: Report) {
  const size = spec.canvas.size;
  const { minSizePx, maxSizePx } = tokens.canvas;
  if (!isNumber(size) || size < minSizePx || size > maxSizePx) {
    report.error(
      "canvas-size",
      `The canvas must be ${minSizePx} to ${maxSizePx}px square.`,
      ["canvas", "size"]
    );
    return;
  }
  for (const [index, win] of spec.windows.entries()) {
    const path = itemPath(["windows"], win, index);
    if (!insideCanvas(win, size)) {
      report.error(
        "window-outside-canvas",
        `The window "${win.id ?? ""}" must sit inside the ${size}px canvas.`,
        path
      );
    }
    if (win.w < MIN_WINDOW_W || win.h < MIN_WINDOW_H) {
      report.error(
        "window-too-small",
        `The window "${win.id ?? ""}" must be at least ${MIN_WINDOW_W} by ${MIN_WINDOW_H}px.`,
        path
      );
    }
  }
}

/** Every enum field holds one of its members. */
function checkEnums(spec: SceneSpec, report: Report) {
  const check = (
    value: unknown,
    members: readonly string[],
    what: string,
    path: Path
  ) => {
    if (typeof value === "string" && members.includes(value)) {
      return;
    }
    report.error(
      "invalid-value",
      `"${String(value ?? "")}" is not a ${what}; use one of ${members.join(", ")}.`,
      path
    );
  };
  check(spec.sceneMode, SCENE_MODES, "scene mode", ["sceneMode"]);
  check(spec.theme, SCENE_THEMES, "theme", ["theme"]);
  for (const [index, win] of spec.windows.entries()) {
    const path = itemPath(["windows"], win, index);
    check(win.kind, WINDOW_KINDS, "window kind", [...path, "kind"]);
    for (const [elementIndex, element] of win.elements.entries()) {
      const elementPath = itemPath(
        [...path, "elements"],
        element,
        elementIndex
      );
      check(element.kind, ELEMENT_KINDS, "element kind", [
        ...elementPath,
        "kind",
      ]);
      if (element.badge !== undefined) {
        check(element.badge?.status, BADGE_STATUSES, "badge status", [
          ...elementPath,
          "badge",
          "status",
        ]);
      }
    }
  }
  for (const [index, entry] of spec.steps.entries()) {
    const path = itemPath(["steps"], entry, index);
    check(entry.action, STEP_ACTIONS, "step action", [...path, "action"]);
    check(entry.role, MOTION_ROLES, "motion role", [...path, "role"]);
    if (entry.badge !== undefined) {
      check(entry.badge?.status, BADGE_STATUSES, "badge status", [
        ...path,
        "badge",
        "status",
      ]);
    }
  }
}

/**
 * Check ids (one namespace across the scene) and `_key`s (unique per array),
 * and return what each id names, for resolving step targets.
 */
function checkIds(spec: SceneSpec, report: Report): Map<string, TargetKind> {
  const kinds = new Map<string, TargetKind>();
  const claim = (
    item: { _key?: string; id?: string },
    kind: TargetKind,
    path: Path
  ) => {
    const taken = item.id ? kinds.get(item.id) : undefined;
    if (taken) {
      report.error(
        "duplicate-id",
        `The id "${item.id}" is already used by a ${taken}. Ids must be unique across the scene.`,
        [...path, "id"]
      );
    } else if (item.id) {
      kinds.set(item.id, kind);
    }
  };
  const claimAll = (
    items: readonly { _key?: string; id?: string }[],
    kind: TargetKind,
    path: Path
  ) => {
    checkKeys(items, path, report);
    for (const [index, item] of items.entries()) {
      claim(item, kind, itemPath(path, item, index));
    }
  };

  const windows = spec.windows;
  claimAll(windows, "window", ["windows"]);
  for (const [index, win] of windows.entries()) {
    claimAll(win.elements, "element", [
      ...itemPath(["windows"], win, index),
      "elements",
    ]);
  }
  claimAll(spec.connectors, "connector", ["connectors"]);
  claimAll(spec.cursor?.targets ?? [], "cursor target", ["cursor", "targets"]);
  checkKeys(spec.steps, ["steps"], report);
  return kinds;
}

/**
 * Connector ends and cursor targets name a window and, optionally, an
 * element inside that same window.
 */
function checkAnchors(spec: SceneSpec, report: Report) {
  const windows = spec.windows;
  const check = (
    anchor: Partial<SceneAnchor> | undefined,
    path: Path,
    code: "dangling-anchor" | "dangling-cursor-target"
  ) => {
    const win = windows.find((entry) => entry.id === anchor?.windowId);
    if (!win) {
      report.error(code, `No window has the id "${anchor?.windowId ?? ""}".`, [
        ...path,
        "windowId",
      ]);
      return;
    }
    const elementId = anchor?.elementId;
    if (elementId && !win.elements.some((el) => el.id === elementId)) {
      report.error(
        code,
        `The window "${win.id}" has no element with the id "${elementId}".`,
        [...path, "elementId"]
      );
    }
  };
  for (const [index, connector] of spec.connectors.entries()) {
    const path = itemPath(["connectors"], connector, index);
    check(connector.from, [...path, "from"], "dangling-anchor");
    check(connector.to, [...path, "to"], "dangling-anchor");
  }
  for (const [index, target] of (spec.cursor?.targets ?? []).entries()) {
    check(
      target,
      itemPath(["cursor", "targets"], target, index),
      "dangling-cursor-target"
    );
  }
}

function checkAccents(spec: SceneSpec, tokens: DesignTokens, report: Report) {
  const max = tokens.tide.maxPerScene;
  let accents = 0;
  for (const [index, win] of spec.windows.entries()) {
    for (const [elementIndex, element] of win.elements.entries()) {
      if (element.accent === true) {
        accents += 1;
      }
      if (element.accent === true && accents > max) {
        report.error(
          "tide-overused",
          `Tide is the one accent: use it on at most ${max} element per scene.`,
          [
            ...itemPath(["windows"], win, index),
            ...itemPath(["elements"], element, elementIndex),
            "accent",
          ]
        );
      }
    }
  }
}

function checkStillStep(spec: SceneSpec, report: Report) {
  const { stillStepKey } = spec;
  if (stillStepKey === undefined) {
    if (spec.sceneMode === "ambient") {
      report.warn(
        "missing-still-step",
        "Pick the step shown as a still to people who prefer reduced motion.",
        ["stillStepKey"]
      );
    }
    return;
  }
  if (!spec.steps.some((entry) => entry._key === stillStepKey)) {
    report.error(
      "dangling-still-step",
      `No step has the key "${stillStepKey}".`,
      ["stillStepKey"]
    );
  }
}

function checkSteps(
  spec: SceneSpec,
  kinds: ReadonlyMap<string, TargetKind>,
  tokens: DesignTokens,
  report: Report
) {
  const maxReveals =
    roleToken(tokens, "reveal").maxItems ?? Number.POSITIVE_INFINITY;
  let revealRun = 0;
  let cursorOn: string | undefined;

  for (const [index, entry] of spec.steps.entries()) {
    const path = itemPath(["steps"], entry, index);
    const kind = entry.target ? kinds.get(entry.target) : undefined;
    checkStepTarget(entry, kind, path, report);
    checkCursorStep(entry, kind, cursorOn, path, report);
    checkDuration(entry, kind, tokens, path, report);
    if (entry.action === "move") {
      cursorOn = entry.target;
    }

    revealRun = entry.action === "reveal" ? revealRun + 1 : 0;
    if (revealRun === maxReveals + 1) {
      report.error(
        "reveal-run-too-long",
        `Reveal at most ${maxReveals} items in a row; break the run up with another step.`,
        path
      );
    }
  }
}

function checkStepTarget(
  entry: SceneStep,
  kind: TargetKind | undefined,
  path: Path,
  report: Report
) {
  if (!kind) {
    report.error(
      "dangling-target",
      `Nothing in the scene has the id "${entry.target ?? ""}".`,
      [...path, "target"]
    );
    return;
  }
  const allowed = ACTION_TARGETS[entry.action];
  if (allowed && !allowed.includes(kind)) {
    report.error(
      "action-target-mismatch",
      `A ${entry.action} step can't act on a ${kind}; it needs a ${allowed.join(" or ")}.`,
      [...path, "action"]
    );
  }
  if (
    entry.action === "update" &&
    entry.value === undefined &&
    entry.badge === undefined
  ) {
    report.warn(
      "update-without-change",
      "This update step sets neither a new value nor a new badge.",
      path
    );
  }
}

function checkCursorStep(
  entry: SceneStep,
  kind: TargetKind | undefined,
  cursorOn: string | undefined,
  path: Path,
  report: Report
) {
  const expectedRole = CURSOR_ROLES[entry.action];
  if (expectedRole && entry.role !== expectedRole) {
    report.warn(
      "role-mismatch",
      `Cursor ${entry.action} steps use the ${expectedRole} role.`,
      [...path, "role"]
    );
  }
  if (
    entry.action === "click" &&
    kind === "cursor target" &&
    cursorOn !== entry.target
  ) {
    report.warn(
      "click-before-move",
      `The cursor clicks "${entry.target}" before moving to it. Add a move step first.`,
      [...path, "target"]
    );
  }
}

function checkDuration(
  entry: SceneStep,
  kind: TargetKind | undefined,
  tokens: DesignTokens,
  path: Path,
  report: Report
) {
  if (entry.durationMs === undefined) {
    return;
  }
  const range = durationRange(entry, kind, tokens);
  if (
    isNumber(entry.durationMs) &&
    entry.durationMs >= range.minMs &&
    entry.durationMs <= range.maxMs
  ) {
    return;
  }
  report.error(
    "duration-out-of-range",
    range.maxMs === Number.POSITIVE_INFINITY
      ? "The duration can't be negative."
      : `The ${entry.role} role takes ${formatRange(range)}; leave the duration empty to use its default.`,
    [...path, "durationMs"]
  );
}

type TargetKind = "window" | "element" | "connector" | "cursor target";

const ACTION_TARGETS: Record<StepAction, readonly TargetKind[]> = {
  enter: ["window", "element", "connector"],
  reveal: ["window", "element", "connector"],
  exit: ["window", "element", "connector"],
  update: ["element"],
  move: ["cursor target"],
  click: ["cursor target"],
};

const CURSOR_ROLES: Partial<Record<StepAction, MotionRole>> = {
  move: "glide",
  click: "press",
};

function durationRange(
  entry: SceneStep,
  kind: TargetKind | undefined,
  tokens: DesignTokens
): DurationRange {
  if (
    entry.action === "move" &&
    entry.role === "glide" &&
    kind === "cursor target"
  ) {
    return cursorGlideEnvelope(tokens);
  }
  const token = tokens.roles.find((role) => role.role === entry.role);
  return token?.duration ?? { minMs: 0, maxMs: Number.POSITIVE_INFINITY };
}

function formatRange({ minMs, maxMs }: DurationRange) {
  return minMs === maxMs ? `${minMs}ms` : `${minMs} to ${maxMs}ms`;
}

function insideCanvas(win: Partial<SceneWindow>, size: number): boolean {
  const { x, y, w, h } = win;
  return (
    isNumber(x) &&
    isNumber(y) &&
    isNumber(w) &&
    isNumber(h) &&
    x >= 0 &&
    y >= 0 &&
    x + w <= size &&
    y + h <= size
  );
}

/** Report the second and later uses of a `_key` within one array. */
function checkKeys(
  items: readonly { _key?: string }[],
  path: Path,
  report: Report
) {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (!item._key) {
      continue;
    }
    if (seen.has(item._key)) {
      report.error(
        "duplicate-key",
        `The key "${item._key}" appears twice in this list.`,
        [...path, index]
      );
    }
    seen.add(item._key);
  }
}

/** Address an array item by `_key`, as Sanity does, or by index without one. */
function itemPath(path: Path, item: { _key?: string }, index: number): Path {
  return [...path, item._key ? { _key: item._key } : index];
}

/**
 * The scene with every list guaranteed to be a list of objects and the label
 * a string, so the checks can read a partial or malformed value from the
 * dataset without throwing. Values keep their raw types otherwise, for the
 * checks to report.
 */
function readable(scene: unknown): SceneSpec {
  const spec = record(scene);
  const cursor = spec.cursor === undefined ? undefined : record(spec.cursor);
  return {
    ...spec,
    label: typeof spec.label === "string" ? spec.label : "",
    canvas: record(spec.canvas),
    windows: records(spec.windows).map((win) => ({
      ...win,
      elements: records(win.elements),
    })),
    connectors: records(spec.connectors),
    ...(cursor
      ? { cursor: { ...cursor, targets: records(cursor.targets) } }
      : {}),
    steps: records(spec.steps),
  } as SceneSpec;
}

type Raw = Record<string, unknown>;

function record(value: unknown): Raw {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function records(value: unknown): Raw[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
