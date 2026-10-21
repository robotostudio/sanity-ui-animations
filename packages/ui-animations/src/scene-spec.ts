/**
 * SceneSpec: the structured description of one UI animation ("Scene").
 *
 * This is the only thing the AI produces. The Studio's `animation.scene`
 * field mirrors it one to one, Agent Actions write into that field, and a
 * fixed, trusted primitive library renders it. Nothing in a SceneSpec is ever
 * executed: every value is data (ids, labels, numbers, enum members).
 *
 * Coordinates and sizes are design pixels on a square canvas (see
 * `SceneCanvas`); renderers scale the whole canvas uniformly to fit.
 *
 * Ids (`SceneWindow.id`, `SceneElement.id`, `SceneConnector.id`,
 * `CursorTarget.id`) share one namespace and must be unique across the scene,
 * because `SceneStep.target` refers to any of them by id.
 */

/** How the Scene plays. See motion.md, "Modes". */
export const SCENE_MODES = ["ambient", "intro", "interactive"] as const;
export type SceneMode = (typeof SCENE_MODES)[number];

/** Colour scheme the Scene is drawn in. */
export const SCENE_THEMES = ["light", "dark"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

/**
 * Motion roles from motion.md. A step names a role, never a raw curve; the
 * curve and duration range come from `DesignTokens.roles`.
 */
export const MOTION_ROLES = [
  "press",
  "enter",
  "exit",
  "move",
  "glide",
  "reveal",
  "drawer",
  "sweep",
] as const;
export type MotionRole = (typeof MOTION_ROLES)[number];

/** Window chrome to draw. `browser` adds Safari's centred address field. */
export const WINDOW_KINDS = ["browser", "app"] as const;
export type WindowKind = (typeof WINDOW_KINDS)[number];

/** Shape of a solid item inside a window. */
export const ELEMENT_KINDS = ["row", "card", "button"] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

/** Badge status. `neutral` has no dot. Colours live in `DesignTokens.badges`. */
export const BADGE_STATUSES = [
  "success",
  "warning",
  "error",
  "info",
  "neutral",
] as const;
export type BadgeStatus = (typeof BADGE_STATUSES)[number];

/** What a step does to its target. */
export const STEP_ACTIONS = [
  "enter",
  "move",
  "click",
  "reveal",
  "update",
  "exit",
] as const;
export type StepAction = (typeof STEP_ACTIONS)[number];

/** Square canvas. Designed at desktop size in real CSS pixels. */
export type SceneCanvas = {
  /** Width and height in design pixels. Square only. */
  size: number;
};

/** A fully round status pill. */
export type SceneBadge = {
  status: BadgeStatus;
  /** Short sentence-case text, e.g. "Paid", "10% off". */
  label: string;
};

/** A solid row, card or button inside a window. Never glass. */
export type SceneElement = {
  _key: string;
  /** Unique across the scene. Referenced by steps, connectors and cursor. */
  id: string;
  kind: ElementKind;
  /** Primary text, sentence case. */
  label: string;
  /** Secondary text on the trailing side, e.g. a price. */
  value?: string;
  badge?: SceneBadge;
  /**
   * Draw this element in Tide, the one accent. At most one element per scene,
   * on the action that matters most. motion.md bars it from controls
   * (checkboxes, toggles, radios, segmented controls), none of which are
   * element kinds, so a `button` carrying the key action may take it.
   */
  accent?: boolean;
};

/** A rounded glass panel with macOS chrome. */
export type SceneWindow = {
  _key: string;
  /** Unique across the scene. */
  id: string;
  /** Title-bar text, or the address shown in a `browser` window. */
  title: string;
  kind: WindowKind;
  /** Left edge, design px from the canvas origin. */
  x: number;
  /** Top edge, design px. */
  y: number;
  /** Width, design px. */
  w: number;
  /** Height, design px. */
  h: number;
  /**
   * Whether this is the focused window. Inactive windows draw their traffic
   * lights in the lighter grey, as macOS dims them.
   */
  active?: boolean;
  /** Content, top to bottom. */
  elements: SceneElement[];
};

/** Endpoint of a connector: a window, or one element inside it. */
export type SceneAnchor = {
  windowId: string;
  elementId?: string;
};

/** A line between two windows (or elements), optionally with travelling dots. */
export type SceneConnector = {
  _key: string;
  /** Unique across the scene. */
  id: string;
  from: SceneAnchor;
  to: SceneAnchor;
  /** Draw dots travelling from `from` to `to` on the sweep role. */
  dots: boolean;
};

/** A place the cursor visits. It rests just off the target, never over it. */
export type CursorTarget = {
  _key: string;
  /** Unique across the scene. Steps with `move`/`click` target this id. */
  id: string;
  windowId: string;
  /** Element to aim at; omit to aim at the window itself. */
  elementId?: string;
  /** Whether the cursor clicks on arrival (two-beat click). */
  click: boolean;
};

export type SceneCursor = {
  /** Where the cursor starts, design px. Omit to start off-canvas. */
  start?: { x: number; y: number };
  /** Targets in visit order. */
  targets: CursorTarget[];
};

/**
 * One beat of the timeline. Steps run in array order; each starts
 * `delayMs` after the previous step finished.
 *
 * Targeting rules:
 * - `enter` / `reveal` / `exit`: a window, element or connector id. Anything
 *   targeted by an `enter` or `reveal` step starts hidden.
 * - `update`: an element id; swaps in `value` and/or `badge` without an
 *   entrance (e.g. a total changing after a click).
 * - `move` / `click`: a cursor target id.
 */
export type SceneStep = {
  _key: string;
  action: StepAction;
  /** Id of a window, element, connector or cursor target. */
  target: string;
  role: MotionRole;
  /** Pause before this step, ms. */
  delayMs: number;
  /**
   * Explicit duration, ms. Omit to let the renderer pick from the role's
   * range (and, for cursor glides, from travel distance).
   */
  durationMs?: number;
  /** New `value` text the target shows once this step lands, e.g. a total. */
  value?: string;
  /** New badge the target shows once this step lands. */
  badge?: SceneBadge;
};

export type SceneSpec = {
  sceneMode: SceneMode;
  theme: SceneTheme;
  canvas: SceneCanvas;
  /** Accessible description used as the `aria-label` of the `role="img"`. */
  label: string;
  windows: SceneWindow[];
  connectors: SceneConnector[];
  cursor?: SceneCursor;
  steps: SceneStep[];
  /**
   * Ambient scenes only: the `_key` of the step whose end state is the still
   * shown under reduced motion. Intro scenes show their rest (final) state.
   */
  stillStepKey?: string;
};

/** Recursive partial, for raw AI output before `normalizeScene`. */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Raw, possibly incomplete scene as written by Agent Actions. */
export type SceneSpecDraft = DeepPartial<SceneSpec>;
