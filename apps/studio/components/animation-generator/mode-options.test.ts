import { describe, expect, it } from "vitest";

import { generationModeOptions } from "./mode-options";

describe("generationModeOptions", () => {
  it("labels each mode with the AI credits it spends", () => {
    expect(generationModeOptions).toEqual([
      { title: "Fast · 1 credit", value: "fast" },
      { title: "Good · 2 credits", value: "good" },
    ]);
  });
});
