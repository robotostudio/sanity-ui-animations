import type { SceneSpec } from "@sanity-ui-animations/ui-animations";
import { checkoutScene } from "@sanity-ui-animations/ui-animations/fixtures/checkout";
import { studioTheme, ThemeProvider } from "@sanity/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScenePreview } from "./scene-preview";

function renderPreview(props: ComponentProps<typeof ScenePreview>) {
  return render(
    <ThemeProvider theme={studioTheme}>
      <ScenePreview {...props} />
    </ThemeProvider>
  );
}

const withDanglingStep: SceneSpec = {
  ...checkoutScene,
  steps: checkoutScene.steps.map((step, index) =>
    index === 0 ? { ...step, target: "basket" } : step
  ),
};

beforeEach(() => {
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
  vi.unstubAllGlobals();
});

describe("ScenePreview", () => {
  it("asks for a generation when there is no scene yet", () => {
    renderPreview({ scene: undefined });

    expect(screen.queryByRole("img")).toBeNull();
    expect(
      screen.getByText("No scene yet. Write a prompt and press Generate.")
    ).toBeTruthy();
  });

  it("renders the scene with the primitive library", () => {
    renderPreview({ scene: checkoutScene });

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      checkoutScene.label
    );
    expect(screen.getByText("No validation issues.")).toBeTruthy();
  });

  it("lists validation issues beside the preview", () => {
    renderPreview({ scene: withDanglingStep });

    const issues = screen.getByRole("list", { name: "Validation issues" });
    expect(issues.textContent).toContain(
      'Nothing in the scene has the id "basket".'
    );
    expect(screen.getByRole("img")).toBeTruthy();
  });
});

describe("ScenePreview: code preview", () => {
  const reactCode = [
    'import { useState } from "react";',
    "export default function SceneAnimation() {",
    '  const label = "</script><script>alert(1)</script>";',
    "  return <div>{label}</div>;",
    "}",
  ].join("\n");

  const openCodePreview = () =>
    fireEvent.click(screen.getByRole("tab", { name: "Code preview" }));

  it("mounts nothing that runs code until the tab is opened", () => {
    renderPreview({ scene: checkoutScene, reactCode });

    expect(document.querySelector("iframe")).toBeNull();
  });

  it("runs the compiled code only in a sandbox without same-origin", () => {
    renderPreview({ scene: checkoutScene, reactCode });
    openCodePreview();

    const frame = screen.getByTitle("Compiled React code preview");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.hasAttribute("src")).toBe(false);
  });

  it("embeds the code as an escaped string, so it cannot close its script", () => {
    renderPreview({ scene: checkoutScene, reactCode });
    openCodePreview();

    const srcdoc =
      screen.getByTitle("Compiled React code preview").getAttribute("srcdoc") ??
      "";
    expect(srcdoc).not.toContain("alert(1)</script>");
    expect(srcdoc).toContain("\\u003c/script>\\u003cscript>alert(1)");
    expect(srcdoc).toContain("\\u003cSceneAnimation />");
  });

  it("goes back to the scene when the compiled code disappears", () => {
    const { rerender } = renderPreview({ scene: checkoutScene, reactCode });
    openCodePreview();

    rerender(
      <ThemeProvider theme={studioTheme}>
        <ScenePreview scene={checkoutScene} />
      </ThemeProvider>
    );

    expect(document.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("disables the tab until there is compiled code", () => {
    renderPreview({ scene: checkoutScene });

    expect(
      screen.getByRole("tab", { name: "Code preview" }).hasAttribute("disabled")
    ).toBe(true);
  });
});
