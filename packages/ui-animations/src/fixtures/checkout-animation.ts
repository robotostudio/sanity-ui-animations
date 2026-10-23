import { compileSceneToReact } from "../compile";
import type {
  CursorTarget,
  SceneConnector,
  SceneCursor,
  SceneElement,
  SceneSpec,
  SceneStep,
  SceneWindow,
} from "../scene-spec";
import { checkoutScene } from "./checkout";

type Typed<T, Name extends string> = T & { _type: Name };

/** `SceneSpec` as the Studio stores it: every array item carries its `_type`. */
export type StoredScene = Omit<
  SceneSpec,
  "windows" | "connectors" | "cursor" | "steps"
> & {
  windows: (Omit<Typed<SceneWindow, "sceneWindow">, "elements"> & {
    elements: Typed<SceneElement, "sceneElement">[];
  })[];
  connectors: Typed<SceneConnector, "sceneConnector">[];
  cursor?: Omit<SceneCursor, "targets"> & {
    targets: Typed<CursorTarget, "cursorTarget">[];
  };
  steps: Typed<SceneStep, "sceneStep">[];
};

const storedScene: StoredScene = {
  ...checkoutScene,
  windows: checkoutScene.windows.map((window) => ({
    ...window,
    _type: "sceneWindow",
    elements: window.elements.map((element) => ({
      ...element,
      _type: "sceneElement",
    })),
  })),
  connectors: checkoutScene.connectors.map((connector) => ({
    ...connector,
    _type: "sceneConnector",
  })),
  cursor: checkoutScene.cursor && {
    ...checkoutScene.cursor,
    targets: checkoutScene.cursor.targets.map((target) => ({
      ...target,
      _type: "cursorTarget",
    })),
  },
  steps: checkoutScene.steps.map((step) => ({ ...step, _type: "sceneStep" })),
};

/**
 * The published `animation` document `pnpm seed:checkout` writes, and the
 * website e2e spec reads back at `/animations/checkout-flow`: the reference
 * checkout scene as the Studio would store it, plus its compiled
 * `reactCode` so the spec can prove compiled code never reaches the page.
 */
export const checkoutAnimation = {
  _id: "animation-checkout",
  _type: "animation",
  title: "Checkout flow",
  slug: { _type: "slug", current: "checkout-flow" },
  prompt: "Show our checkout flow, and adding discounts to cart",
  generationMode: "fast",
  showAdvanced: false,
  scene: storedScene,
  reactCode: compileSceneToReact(checkoutScene),
} as const;
