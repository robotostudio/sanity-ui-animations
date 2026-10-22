import { studioTheme, ThemeProvider } from "@sanity/ui";
import { ToastProvider } from "@sanity/ui/toast";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimationView } from "./animation-view";

const execute = vi.fn();

vi.mock("sanity", () => ({
  getPublishedId: (id: string) => id.replace(/^drafts\./, ""),
  useClient: () => ({}),
  useDocumentOperation: () => ({ patch: { execute, disabled: false } }),
}));

type ViewProps = ComponentProps<typeof AnimationView>;

/** The view as the structure pane mounts it, over a stored document. */
function renderView(stored: Record<string, unknown>) {
  const document = { _id: "drafts.anim-1", _type: "animation", ...stored };
  const props = {
    document: {
      draft: document,
      displayed: document,
      historical: null,
      published: null,
    },
    documentId: "anim-1",
    options: {},
    schemaType: { name: "animation" },
  } as unknown as ViewProps;
  return render(
    <ThemeProvider theme={studioTheme}>
      <ToastProvider>
        <AnimationView {...props} />
      </ToastProvider>
    </ThemeProvider>
  );
}

const radio = (name: RegExp) => screen.getByRole("radio", { name });

/** jsdom has no ResizeObserver; the workspace measures its pane with one. */
class NoopResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
  vi.stubGlobal(
    "matchMedia",
    (query: string): Partial<MediaQueryList> => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })
  );
});

afterEach(() => {
  cleanup();
  execute.mockReset();
  vi.unstubAllGlobals();
});

describe("AnimationView: Fast / Good is remembered per document", () => {
  it("opens on the mode the document stores", () => {
    renderView({ generationMode: "good" });

    expect(radio(/^Good/).getAttribute("aria-checked")).toBe("true");
    expect(radio(/^Fast/).getAttribute("aria-checked")).toBe("false");
  });

  it("opens on Fast when the document stores no mode", () => {
    renderView({});

    expect(radio(/^Fast/).getAttribute("aria-checked")).toBe("true");
  });

  it("patches generationMode when the choice changes, and only then", () => {
    renderView({ generationMode: "fast" });

    fireEvent.click(radio(/^Fast/));
    expect(execute).not.toHaveBeenCalled();

    fireEvent.click(radio(/^Good/));
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith([{ set: { generationMode: "good" } }]);
  });

  it("patches from the keyboard too", () => {
    renderView({ generationMode: "good" });

    fireEvent.keyDown(radio(/^Good/), { key: "ArrowLeft" });
    expect(execute).toHaveBeenCalledWith([{ set: { generationMode: "fast" } }]);
  });
});
