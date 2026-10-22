import {
  BUDGET_EXHAUSTED_MESSAGE,
  CANCELLED_MESSAGE,
  type GenerationLogEntry,
  type GenerationMode,
  type GenerationResult,
  type RunGenerationOptions,
  runGeneration,
} from "@sanity-ui-animations/ui-animations";
import { checkoutScene } from "@sanity-ui-animations/ui-animations/fixtures/checkout";
import { studioTheme, ThemeProvider } from "@sanity/ui";
import { ToastProvider } from "@sanity/ui/toast";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import type { SanityClient } from "sanity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimationWorkspace } from "./animation-workspace";
import { EXAMPLE_PROMPTS } from "./mode-options";
import { useGeneration } from "./use-generation";

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
          });
        }),
      finish: async (result) => {
        await act(async () => {
          resolve({ status: "success", calls: 1, ...result } as never);
        });
      },
    };
  };
}

type Props = Partial<ComponentProps<typeof AnimationWorkspace>>;

/** The workspace with its prompt and mode held like the document holds them. */
function Controlled(props: Props) {
  const [prompt, setPrompt] = useState(props.prompt);
  const [mode, setMode] = useState<GenerationMode>(props.mode ?? "fast");
  return (
    <AnimationWorkspace
      client={client}
      documentId="anim-1"
      generationLog={undefined}
      reactCode={undefined}
      scene={undefined}
      {...props}
      mode={mode}
      onModeChange={(next) => {
        setMode(next);
        props.onModeChange?.(next);
      }}
      onPromptChange={(next) => {
        setPrompt(next);
        props.onPromptChange?.(next);
      }}
      prompt={prompt}
    />
  );
}

function renderWorkspace(props: Props = {}) {
  return render(
    <ThemeProvider theme={studioTheme}>
      <ToastProvider>
        <Controlled prompt="Show our checkout flow" {...props} />
      </ToastProvider>
    </ThemeProvider>
  );
}

const button = (name: string | RegExp) =>
  screen.getByRole<HTMLButtonElement>("button", { name });
const generateButton = () => button(/^(re)?generate$|^generating/i);
const promptBox = () => screen.getByLabelText<HTMLTextAreaElement>("Prompt");
const status = () => screen.getByRole("status").textContent;

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
  run.mockReset();
  vi.unstubAllGlobals();
});

describe("AnimationWorkspace: generating", () => {
  it("runs a Fast generation only when Generate is pressed", async () => {
    const next = pendingRun();
    renderWorkspace();
    fireEvent.change(promptBox(), { target: { value: "Show the cart" } });
    expect(run).not.toHaveBeenCalled();

    fireEvent.click(generateButton());

    const { options, progress, finish } = next();
    expect(options).toMatchObject({
      client,
      documentId: "anim-1",
      mode: "fast",
      prompt: "Show the cart",
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    progress(1, 1);
    expect(status()).toBe("Generating the scene… (call 1 of 1)0s");
    expect(generateButton().disabled).toBe(true);
    expect(promptBox().readOnly).toBe(true);

    await finish({ status: "success" });
    expect(status()).toMatch(/^Scene ready in /);
    expect(generateButton().disabled).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("names each of a Good run's two calls", async () => {
    const next = pendingRun();
    renderWorkspace({ mode: "good" });

    fireEvent.click(generateButton());
    const { options, progress, finish } = next();
    expect(options.mode).toBe("good");

    progress(1, 2);
    expect(status()).toContain("Generating the scene… (call 1 of 2)");
    progress(2, 2);
    expect(status()).toContain(
      "Refining against the design rules… (call 2 of 2)"
    );
    await finish({ status: "success", calls: 2 });
  });

  it("generates on Cmd+Enter and Ctrl+Enter, but not on Enter", async () => {
    const first = pendingRun();
    renderWorkspace();

    fireEvent.keyDown(promptBox(), { key: "Enter" });
    expect(run).not.toHaveBeenCalled();

    fireEvent.keyDown(promptBox(), { key: "Enter", metaKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    // A second shortcut while the run is in flight does nothing.
    fireEvent.keyDown(promptBox(), { key: "Enter", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    await first().finish({ status: "success" });

    const second = pendingRun();
    fireEvent.keyDown(promptBox(), { key: "Enter", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(2);
    await second().finish({ status: "success" });
  });

  it("shows the budget message when Agent Actions answer 429", async () => {
    const next = pendingRun();
    renderWorkspace();

    fireEvent.click(generateButton());
    await next().finish({
      status: "error",
      error: BUDGET_EXHAUSTED_MESSAGE,
      budgetExhausted: true,
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Out of AI credits");
    expect(alert.textContent).toContain(BUDGET_EXHAUSTED_MESSAGE);
    expect(generateButton().disabled).toBe(false);
  });

  it("retries a failed run with the same prompt and mode", async () => {
    const first = pendingRun();
    renderWorkspace({ mode: "good" });
    fireEvent.click(generateButton());
    await first().finish({ status: "error", error: "Schema not found" });
    expect(screen.getByRole("alert").textContent).toContain("Schema not found");

    const second = pendingRun();
    fireEvent.click(button("Retry"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(second().options).toMatchObject({
      mode: "good",
      prompt: "Show our checkout flow",
    });
    await second().finish({ status: "success" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reports a run that throws instead of resolving", async () => {
    run.mockRejectedValueOnce(new Error("Network down"));
    renderWorkspace();

    await act(async () => {
      fireEvent.click(generateButton());
    });

    expect(screen.getByRole("alert").textContent).toContain("Network down");
  });

  it("cancels through the run's signal and says so", async () => {
    const next = pendingRun();
    renderWorkspace();
    fireEvent.click(generateButton());
    const { options, finish } = next();

    fireEvent.click(button("Cancel"));
    expect(options.signal?.aborted).toBe(true);
    expect(button("Cancel").disabled).toBe(true);

    await finish({
      status: "error",
      error: CANCELLED_MESSAGE,
      budgetExhausted: false,
      cancelled: true,
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(status()).toContain("Cancelled.");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(generateButton().disabled).toBe(false);
  });

  it("cannot generate without edit access or a prompt", () => {
    renderWorkspace({ readOnly: true });
    expect(generateButton().disabled).toBe(true);
    cleanup();

    renderWorkspace({ prompt: "   " });
    expect(generateButton().disabled).toBe(true);
    fireEvent.keyDown(promptBox(), { key: "Enter", metaKey: true });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("AnimationWorkspace: prompt and mode", () => {
  it("fills the prompt from an example and focuses it", async () => {
    const onPromptChange = vi.fn();
    renderWorkspace({ prompt: "", onPromptChange });
    const example = EXAMPLE_PROMPTS[1];

    await act(async () => {
      fireEvent.click(button(example));
      await new Promise((done) => requestAnimationFrame(done));
    });

    expect(onPromptChange).toHaveBeenCalledWith(example);
    expect(promptBox().value).toBe(example);
    expect(document.activeElement).toBe(promptBox());
    // With a prompt in place, the examples give way to "Ready to generate".
    expect(screen.queryByRole("list", { name: "Example prompts" })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("switches mode by click and by arrow key, and runs the chosen one", async () => {
    const onModeChange = vi.fn();
    renderWorkspace({ onModeChange });
    const radio = (name: RegExp) => screen.getByRole("radio", { name });

    expect(radio(/^Fast/).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("One pass, quicker · 1 credit")).toBeTruthy();

    fireEvent.click(radio(/^Good/));
    expect(onModeChange).toHaveBeenLastCalledWith("good");
    expect(radio(/^Good/).getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText("Generates then refines · slower, better · 2 credits")
    ).toBeTruthy();

    fireEvent.keyDown(radio(/^Good/), { key: "ArrowLeft" });
    expect(onModeChange).toHaveBeenLastCalledWith("fast");
    expect(document.activeElement).toBe(radio(/^Fast/));

    fireEvent.keyDown(radio(/^Fast/), { key: "ArrowRight" });
    const next = pendingRun();
    fireEvent.click(generateButton());
    expect(next().options.mode).toBe("good");

    // Locked while the run is in flight.
    onModeChange.mockClear();
    fireEvent.click(radio(/^Fast/));
    expect(onModeChange).not.toHaveBeenCalled();
    expect(radio(/^Fast/).getAttribute("aria-disabled")).toBe("true");
    await next().finish({ status: "success" });
  });

  it("offers Regenerate and Refine prompt once there is a scene", () => {
    renderWorkspace({ scene: checkoutScene });

    expect(generateButton().textContent).toBe("Regenerate");
    fireEvent.click(button("Refine prompt"));
    expect(document.activeElement).toBe(promptBox());
    expect(run).not.toHaveBeenCalled();
  });

  it("summarises the newest generation log entry", () => {
    const entry = (
      key: string,
      fields: Partial<GenerationLogEntry>
    ): GenerationLogEntry => ({
      _key: key,
      _type: "generationLogEntry",
      mode: "fast",
      calls: 1,
      status: "success",
      durationMs: 12_000,
      at: new Date(Date.now() - 2 * 60_000).toISOString(),
      ...fields,
    });
    renderWorkspace({
      generationLog: [
        entry("a", {}),
        entry("b", { mode: "good", calls: 2, durationMs: 41_200 }),
      ],
    });

    const section = screen.getByRole("region", { name: "Last generation" });
    expect(section.textContent).toContain(
      "2 minutes ago · Good · 2 requests · 41s"
    );
    expect(section.textContent).toContain(
      "2 runs on this animation, 3 credits used."
    );
  });
});

describe("useGeneration", () => {
  it("tells the form when a run starts and ends, even when it throws", async () => {
    run.mockRejectedValueOnce(new Error("Network down"));
    const onRunningChange = vi.fn();
    const { result } = renderHook(() =>
      useGeneration({ client, documentId: "anim-1", onRunningChange })
    );

    await act(() => result.current.generate({ mode: "fast", prompt: "x" }));

    expect(onRunningChange.mock.calls).toEqual([[true], [false]]);
    expect(result.current.state).toMatchObject({
      status: "error",
      message: "Network down",
    });
  });
});
