import {
  GENERATION_CALLS,
  type GenerationMode,
  runGeneration,
} from "@sanity-ui-animations/ui-animations";
import { useCallback, useRef, useState } from "react";
import type { SanityClient } from "sanity";

/** Deployed schema id; unset falls back to the pipeline's default. */
const schemaId = process.env.SANITY_STUDIO_SCHEMA_ID || undefined;

export type GenerationRequest = {
  mode: GenerationMode;
  /** The prompt as the editor sees it, sent with the request. */
  prompt: string;
};

export type GenerationState =
  | { status: "idle" }
  | {
      status: "running";
      request: GenerationRequest;
      /** 1-based number of the call in flight. */
      call: number;
      totalCalls: number;
      startedAt: number;
      /** Cancel was pressed; waiting for the run to stop. */
      cancelling: boolean;
    }
  | {
      status: "success";
      request: GenerationRequest;
      calls: number;
      durationMs: number;
    }
  | {
      status: "error";
      request: GenerationRequest;
      message: string;
      budgetExhausted: boolean;
    }
  | { status: "cancelled"; request: GenerationRequest };

export type UseGenerationOptions = {
  /** A `useClient({ apiVersion: "vX" })` client: Agent Actions need `vX`. */
  client: SanityClient;
  /** The animation's id; the run writes its draft. */
  documentId: string;
  /** Told when a run starts and ends, so the form can lock its fields. */
  onRunningChange?: (running: boolean) => void;
};

export type Generation = {
  state: GenerationState;
  running: boolean;
  /** Starts a run unless one is in flight. Never called on keystrokes. */
  generate: (request: GenerationRequest) => Promise<void>;
  /** Runs the last request again, e.g. after an error. */
  retry: () => void;
  cancel: () => void;
};

/**
 * One generation run at a time, with progress, errors and cancel. Each run
 * is one `runGeneration` call, so its usage and budget handling are the
 * pipeline's. See docs/spec.md, "User flow" and "Cost controls".
 */
export function useGeneration({
  client,
  documentId,
  onRunningChange,
}: UseGenerationOptions): Generation {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (request: GenerationRequest) => {
      if (controller.current) {
        return;
      }
      const current = new AbortController();
      controller.current = current;
      const startedAt = Date.now();
      setState({
        status: "running",
        request,
        call: 1,
        totalCalls: GENERATION_CALLS[request.mode],
        startedAt,
        cancelling: false,
      });
      onRunningChange?.(true);
      try {
        const result = await runGeneration({
          client,
          documentId,
          mode: request.mode,
          prompt: request.prompt,
          schemaId,
          signal: current.signal,
          onProgress: ({ call, totalCalls }) =>
            setState((previous) =>
              previous.status === "running"
                ? { ...previous, call, totalCalls }
                : previous
            ),
        });
        if (result.status === "success") {
          setState({
            status: "success",
            request,
            calls: result.calls,
            durationMs: Date.now() - startedAt,
          });
        } else if (result.cancelled) {
          setState({ status: "cancelled", request });
        } else {
          setState({
            status: "error",
            request,
            message: result.error,
            budgetExhausted: result.budgetExhausted,
          });
        }
      } catch (error) {
        // The pipeline resolves its own failures; this is a bug or a lost tab.
        setState({
          status: "error",
          request,
          message: error instanceof Error ? error.message : "Generation failed",
          budgetExhausted: false,
        });
      } finally {
        controller.current = null;
        onRunningChange?.(false);
      }
    },
    [client, documentId, onRunningChange]
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    setState((previous) =>
      previous.status === "running"
        ? { ...previous, cancelling: true }
        : previous
    );
  }, []);

  const retry = useCallback(() => {
    if (state.status === "error" || state.status === "cancelled") {
      generate(state.request);
    }
  }, [generate, state]);

  return {
    state,
    running: state.status === "running",
    generate,
    retry,
    cancel,
  };
}

export type RunningState = Extract<GenerationState, { status: "running" }>;

/** What each Agent Actions call of a run does, in order. */
export const CALL_TITLES = [
  "Generating the scene",
  "Refining against the design rules",
];

/** What the run is doing now, e.g. "Refining against the design rules… (call 2 of 2)". */
export function progressLabel(state: RunningState): string {
  if (state.cancelling) {
    return "Cancelling…";
  }
  const title = CALL_TITLES[state.call - 1] ?? "Generating";
  return `${title}… (call ${state.call} of ${state.totalCalls})`;
}
