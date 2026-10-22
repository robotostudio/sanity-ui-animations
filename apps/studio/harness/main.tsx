import {
  compileSceneToReact,
  DEFAULT_TOKENS,
  type GenerationLogEntry,
} from "@sanity-ui-animations/ui-animations";
import { checkoutScene } from "@sanity-ui-animations/ui-animations/fixtures/checkout";
import "@sanity/ui/styles.css";

import { Card, studioTheme, ThemeProvider } from "@sanity/ui";
import { ToastProvider } from "@sanity/ui/toast";
import { type ReactNode, StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { fakeClient } from "./fake-client";
import { HarnessView } from "./harness-view";
import { type HarnessDocument, HarnessDocumentContext } from "./sanity-mock";

/**
 * `?state=empty|loading|regenerating|success|error&scheme=light|dark`.
 * `loading`, `regenerating` and `error` start with a prompt; press Generate
 * (screenshot.mjs does) to see the run hang on call 1 of 2, or fail.
 */
const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "empty";
const scheme = params.get("scheme") === "dark" ? "dark" : "light";

const PROMPT = "Show our checkout flow, and adding a discount to the cart";

const lastRun: GenerationLogEntry = {
  _key: "log1",
  _type: "generationLogEntry",
  mode: "good",
  calls: 2,
  status: "success",
  durationMs: 41_200,
  at: new Date(Date.now() - 4 * 60_000).toISOString(),
};

function initialDocument(): HarnessDocument {
  const base = {
    _id: "drafts.harness",
    _type: "animation",
    title: "Checkout flow",
    slug: { _type: "slug", current: "checkout-flow" },
  };
  switch (state) {
    case "success":
    case "regenerating":
      return {
        ...base,
        prompt: PROMPT,
        generationMode: "good",
        scene: checkoutScene,
        reactCode: compileSceneToReact(checkoutScene, DEFAULT_TOKENS),
        generationLog: [lastRun],
      };
    case "loading":
      return { ...base, prompt: PROMPT, generationMode: "good" };
    case "error":
      return { ...base, prompt: PROMPT, generationMode: "fast" };
    default:
      return { ...base, title: undefined, slug: undefined, prompt: "" };
  }
}

function Harness({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState(initialDocument);
  const client = useMemo(
    () => fakeClient(state === "error" ? "error" : "pending"),
    []
  );
  const value = useMemo(
    () => ({
      document,
      client,
      patch: (attrs: Record<string, unknown>) =>
        setDocument((current) => ({ ...current, ...attrs })),
    }),
    [document, client]
  );
  return (
    <HarnessDocumentContext.Provider value={value}>
      {children}
    </HarnessDocumentContext.Provider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider scheme={scheme} theme={studioTheme}>
        <ToastProvider>
          <Card height="fill" overflow="auto">
            <Harness>
              <HarnessView />
            </Harness>
          </Card>
        </ToastProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
