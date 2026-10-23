import {
  GENERATION_CALLS,
  type GenerationMode,
} from "@sanity-ui-animations/ui-animations";

export const MODE_TITLES: Record<GenerationMode, string> = {
  fast: "Fast",
  good: "Good",
};

export const credits = (calls: number) =>
  `${calls} credit${calls === 1 ? "" : "s"}`;

/** The cost, kept on one line when the text wraps. */
const cost = (calls: number) =>
  `·\u00a0${credits(calls).replace(" ", "\u00a0")}`;

/** One line inside each Fast / Good option: what the mode does and costs. */
export const MODE_DETAILS: Record<GenerationMode, string> = {
  fast: `One pass, quicker ${cost(GENERATION_CALLS.fast)}`,
  good: `Generates then refines · slower, better ${cost(GENERATION_CALLS.good)}`,
};

export const GENERATION_MODES = Object.keys(MODE_TITLES) as GenerationMode[];

/**
 * The `generationMode` radio options. Each Agent Actions request is one AI
 * credit, so the labels say what a run costs. See docs/spec.md, "Modes".
 */
export const generationModeOptions = GENERATION_MODES.map((value) => ({
  title: `${MODE_TITLES[value]} · ${credits(GENERATION_CALLS[value])}`,
  value,
}));

/** Prompts an editor can start from when the animation is still empty. */
export const EXAMPLE_PROMPTS = [
  "Show our checkout flow, and adding a discount to the cart",
  "A teammate approves a pull request and the deploy goes live",
  "An invoice is paid and the dashboard total updates",
  "A new signup gets a welcome email and joins the team list",
] as const;
