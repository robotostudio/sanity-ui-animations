import {
  BUDGET_EXHAUSTED_MESSAGE,
  type GenerationProgress,
  type GenerationResult,
  type RunGenerationOptions,
  runGeneration,
} from "@sanity-ui-animations/ui-animations";
import { studioTheme, ThemeProvider } from "@sanity/ui";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import type { SanityClient } from "sanity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimationGenerator } from "./animation-generator";

vi.mock("@sanity-ui-animations/ui-animations", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@sanity-ui-animations/ui-animations")
  >()),
  runGeneration: vi.fn(),
}));

const run = vi.mocked(runGeneration);
const client = { name: "client" } as unknown as SanityClient;

type Pending = {
  options: RunGenerationOptions;
  progress: (call: number, totalCalls: number) => void;
  finish: (result: Partial<GenerationResult>) => Promise<void>;
};

/** Start a run the test drives call by call. */
function pendingRun(): () => Pending {
  let resolve: (result: GenerationResult) => void = () => undefined;
  run.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  return () => {
    const options = run.mock.calls.at(-1)?.[0] as RunGenerationOptions;
    return {
      options,
      progress: (call, totalCalls) =>
        act(() => {
          options.onProgress?.({
            call,
            totalCalls,
            message: `Generating… (call ${call} of ${totalCalls})`,
          } satisfies GenerationProgress);
        }),
      finish: async (result) => {
        await act(async () => {
          resolve({ status: "success", calls: 1, ...result } as never);
        });
      },
    };
  };
}

function renderGenerator(
  props: Partial<ComponentProps<typeof AnimationGenerator>> = {}
) {
  return render(
    <ThemeProvider theme={studioTheme}>
      <AnimationGenerator
        client={client}
        documentId="drafts.anim-1"
        mode="fast"
        prompt="Show our checkout flow"
        {...props}
      />
    </ThemeProvider>
  );
}

const generateButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: /generate/i });

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
  run.mockReset();
  vi.unstubAllGlobals();
});

describe("AnimationGenerator: generating", () => {
  it("runs a Fast generation only when Generate is pressed", async () => {
    const next = pendingRun();
    renderGenerator();
    expect(run).not.toHaveBeenCalled();

    fireEvent.click(generateButton());

    const { options, progress, finish } = next();
    expect(options).toMatchObject({
      client,
      documentId: "drafts.anim-1",
      mode: "fast",
    });
    progress(1, 1);
    expect(screen.getByRole("status").textContent).toBe(
      "Generating… (call 1 of 1)"
    );
    expect(generateButton().disabled).toBe(true);

    await finish({ status: "success" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(generateButton().disabled).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("counts a Good run's two calls", async () => {
    const next = pendingRun();
    renderGenerator({ mode: "good" });

    fireEvent.click(generateButton());
    const { options, progress, finish } = next();
    expect(options.mode).toBe("good");

    progress(1, 2);
    expect(screen.getByRole("status").textContent).toBe(
      "Generating… (call 1 of 2)"
    );
    progress(2, 2);
    expect(screen.getByRole("status").textContent).toBe(
      "Generating… (call 2 of 2)"
    );
    await finish({ status: "success", calls: 2 });
  });

  it("shows the budget message when Agent Actions answer 429", async () => {
    const next = pendingRun();
    renderGenerator();

    fireEvent.click(generateButton());
    await next().finish({
      status: "error",
      error: BUDGET_EXHAUSTED_MESSAGE,
      budgetExhausted: true,
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "AI budget reached for this organisation. Ask an admin to raise the spending limit in Manage."
    );
    expect(generateButton().disabled).toBe(false);
  });

  it("shows any other failure and clears it on the next run", async () => {
    const first = pendingRun();
    renderGenerator();
    fireEvent.click(generateButton());
    await first().finish({ status: "error", error: "Schema not found" });
    expect(screen.getByRole("alert").textContent).toBe("Schema not found");

    const second = pendingRun();
    fireEvent.click(generateButton());
    expect(screen.queryByRole("alert")).toBeNull();
    await second().finish({ status: "success" });
  });

  it("reports a run that throws instead of resolving", async () => {
    run.mockRejectedValueOnce(new Error("Network down"));
    const onRunningChange = vi.fn();
    renderGenerator({ onRunningChange });

    await act(async () => {
      fireEvent.click(generateButton());
    });

    expect(screen.getByRole("alert").textContent).toBe("Network down");
    expect(onRunningChange.mock.calls).toEqual([[true], [false]]);
  });

  it("tells the form when a run starts and ends", async () => {
    const next = pendingRun();
    const onRunningChange = vi.fn();
    renderGenerator({ onRunningChange });

    fireEvent.click(generateButton());
    expect(onRunningChange.mock.calls).toEqual([[true]]);
    await next().finish({ status: "success" });
    expect(onRunningChange.mock.calls).toEqual([[true], [false]]);
  });

  it("cannot generate without edit access or a prompt", () => {
    const { rerender } = renderGenerator({ readOnly: true });
    expect(generateButton().disabled).toBe(true);

    rerender(
      <ThemeProvider theme={studioTheme}>
        <AnimationGenerator
          client={client}
          documentId="drafts.anim-1"
          mode="fast"
          prompt="   "
        />
      </ThemeProvider>
    );
    expect(generateButton().disabled).toBe(true);
  });
});
