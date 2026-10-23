import { studioTheme, ThemeProvider } from "@sanity/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptComposer } from "./prompt-composer";

const renderComposer = (value: string) => {
  const props = { onChange: vi.fn(), onSubmit: vi.fn() };
  const view = render(
    <ThemeProvider theme={studioTheme}>
      <PromptComposer value={value} {...props} />
    </ThemeProvider>
  );
  const rerender = (next: string) =>
    view.rerender(
      <ThemeProvider theme={studioTheme}>
        <PromptComposer value={next} {...props} />
      </ThemeProvider>
    );
  return { box: screen.getByLabelText("Prompt"), rerender };
};

afterEach(cleanup);

describe("PromptComposer", () => {
  it("keeps the editor's text while focused and shows the stored prompt on blur", () => {
    const { box, rerender } = renderComposer("first prompt");
    fireEvent.focus(box);
    rerender("edited elsewhere");
    expect(box).toHaveProperty("value", "first prompt");
    fireEvent.blur(box);
    expect(box).toHaveProperty("value", "edited elsewhere");
  });

  it("takes a stored prompt that arrives after blur", () => {
    const { box, rerender } = renderComposer("a");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "ab" } });
    fireEvent.blur(box);
    rerender("ab");
    expect(box).toHaveProperty("value", "ab");
  });
});
