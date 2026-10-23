import { Button, studioTheme, ThemeProvider } from "@sanity/ui";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

afterEach(cleanup);

/**
 * Guards vitest.config.mts's SC_DISABLE_SPEEDY: without speedy mode,
 * styled-components appends each rule as text to one <style>, jsdom
 * re-parses the whole sheet per rule, and the first Sanity UI render in a
 * test file takes seconds.
 */
it("injects styled-components rules with insertRule, not as style text", () => {
  render(
    <ThemeProvider theme={studioTheme}>
      <Button text="Go" />
    </ThemeProvider>
  );
  const style = document.querySelector<HTMLStyleElement>("style[data-styled]");
  expect(style?.sheet?.cssRules.length).toBeGreaterThan(0);
  expect(style?.textContent).toBe("");
});
