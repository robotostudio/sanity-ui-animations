import {
  GENERATION_CALLS,
  type GenerationMode,
} from "@sanity-ui-animations/ui-animations";

const MODE_TITLES: Record<GenerationMode, string> = {
  fast: "Fast",
  good: "Good",
};

const credits = (calls: number) => `${calls} credit${calls === 1 ? "" : "s"}`;

/**
 * The `generationMode` radio options. Each Agent Actions request is one AI
 * credit, so the labels say what a run costs. See docs/spec.md, "Modes".
 */
export const generationModeOptions = (
  Object.keys(MODE_TITLES) as GenerationMode[]
).map((value) => ({
  title: `${MODE_TITLES[value]} · ${credits(GENERATION_CALLS[value])}`,
  value,
}));
