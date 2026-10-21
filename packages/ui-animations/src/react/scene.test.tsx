// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkoutScene } from "../fixtures/checkout";
import type { SceneSpec } from "../scene-spec";
import { DEFAULT_TOKENS } from "../tokens";
import { Scene } from "./scene";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function preferReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string): Partial<MediaQueryList> => ({
      matches: matches && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })
  );
}

function windowNode(container: HTMLElement, title: string): HTMLElement {
  const node = [
    ...container.querySelectorAll<HTMLElement>("[data-window]"),
  ].find((entry) => entry.textContent?.includes(title));
  if (!node) {
    throw new Error(`No window titled ${title}`);
  }
  return node;
}

const HOSTILE = '<img src=x onerror="alert(1)">';

describe("<Scene>", () => {
  it("is one image labelled by scene.label, with its UI hidden from assistive tech", () => {
    render(<Scene scene={checkoutScene} tokens={DEFAULT_TOKENS} />);
    const image = screen.getByRole("img", { name: checkoutScene.label });
    expect(image.children).toHaveLength(1);
    expect(image.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(image.textContent).toContain("Wireless headphones");
  });

  it("renders hostile strings as text, never as markup", () => {
    const scene: SceneSpec = {
      ...checkoutScene,
      label: HOSTILE,
      windows: checkoutScene.windows.map((window, index) =>
        index === 0
          ? {
              ...window,
              title: HOSTILE,
              elements: [
                {
                  _key: "e-x",
                  id: "x",
                  kind: "row",
                  label: HOSTILE,
                  value: HOSTILE,
                  badge: { status: "error", label: HOSTILE },
                },
              ],
            }
          : window
      ),
    };
    const { container } = render(<Scene reducedMotion scene={scene} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(HOSTILE);
    // Title, label, value and badge label each appear verbatim as text.
    expect(container.textContent?.split(HOSTILE)).toHaveLength(5);
  });

  it("never reaches for raw HTML or runtime code in the renderer", () => {
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const sources = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
      .map((file) => readFileSync(path.join(dir, file), "utf8"));
    expect(sources.length).toBeGreaterThan(5);
    for (const source of sources) {
      expect(source).not.toMatch(
        /dangerouslySetInnerHTML|innerHTML|\beval\(|new Function|import\(/
      );
    }
  });
});

describe("<Scene> under prefers-reduced-motion", () => {
  it("shows an intro scene's rest state without movement", () => {
    preferReducedMotion(true);
    const { container } = render(<Scene scene={checkoutScene} />);
    expect(container.textContent).toContain("$135");
    expect(container.textContent).toContain("Paid");
    expect(container.textContent).not.toContain("Pending");
    const payments = windowNode(container, "Payments");
    expect(payments.style.opacity).toBe("1");
    expect(payments.style.transform).toBe("");
    // Travelling dots are movement, so they are dropped.
    expect(container.querySelector("animateMotion")).toBeNull();
  });

  it("shows an ambient scene's stillStepKey state", () => {
    preferReducedMotion(true);
    const { container } = render(
      <Scene
        scene={{ ...checkoutScene, sceneMode: "ambient", stillStepKey: "s5" }}
      />
    );
    expect(container.textContent).toContain("$135");
    expect(container.textContent).toContain("Pending");
    expect(windowNode(container, "Payments").style.opacity).toBe("0");
  });

  it("keeps opacity but drops transform and blur from hidden things", () => {
    const { container } = render(
      <Scene
        reducedMotion
        scene={{ ...checkoutScene, sceneMode: "ambient", stillStepKey: "s1" }}
      />
    );
    const discount = container.querySelector<HTMLElement>(
      "[data-element='row']:nth-child(4)"
    );
    expect(discount?.textContent).toContain("Discount");
    expect(discount?.style.opacity).toBe("0");
    expect(discount?.style.transform).toBe("");
    expect(discount?.style.filter).toBe("");
  });
});

describe("<Scene> playback", () => {
  it("starts hidden and plays every step through to the rest state", () => {
    preferReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(<Scene scene={checkoutScene} />);
    const cart = windowNode(container, "shop.example.com/cart");
    expect(cart.style.opacity).toBe("0");
    expect(cart.style.transform).toBe("scale(0.96)");
    expect(container.textContent).toContain("$150");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(cart.style.opacity).toBe("1");
    expect(cart.style.transition).toContain(
      "opacity 240ms cubic-bezier(0.23, 1, 0.32, 1)"
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(container.textContent).toContain("$135");
    expect(container.textContent).toContain("Paid");
    expect(container.querySelectorAll("animateMotion")).toHaveLength(3);
    const connector = container.querySelector<SVGGElement>("[data-connector]");
    expect(connector?.style.opacity).toBe("1");
    expect(connector?.style.transition).toContain("opacity 900ms linear");
  });

  it("glides the cursor to a click aimed at a new target", () => {
    preferReducedMotion(false);
    vi.useFakeTimers();
    const { container } = render(
      <Scene
        scene={{
          ...checkoutScene,
          steps: [
            {
              _key: "c",
              action: "click",
              target: "target-pay",
              role: "press",
              delayMs: 0,
            },
          ],
        }}
      />
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const cursor = container.querySelector<HTMLElement>("[data-cursor]");
    expect(cursor?.style.transition).toBe(
      "transform 140ms cubic-bezier(0.23, 1, 0.32, 1)"
    );
  });

  it("takes every colour from the tokens", () => {
    const { container } = render(
      <Scene reducedMotion scene={{ ...checkoutScene, theme: "dark" }} />
    );
    const apply = [
      ...container.querySelectorAll<HTMLElement>("[data-element]"),
    ].find((node) => node.textContent === "Apply discount");
    // jsdom serialises hex to rgb(): Tide #9FDCCF, Ink #0B0C0E.
    expect(apply?.style.background).toBe("rgb(159, 220, 207)");
    expect(apply?.style.color).toBe("rgb(11, 12, 14)");
    const total = [
      ...container.querySelectorAll<HTMLElement>("[data-element]"),
    ].find((node) => node.textContent?.startsWith("Total"));
    // Dark card #1A1B1D.
    expect(total?.style.background).toBe("rgb(26, 27, 29)");
  });
});
