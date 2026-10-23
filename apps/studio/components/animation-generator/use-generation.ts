import {
  GENERATION_CALLS,
  type GenerationMode,
  runGeneration,
} from "@sanity-ui-animations/ui-animations";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
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
 * A document's run, shared by every view of it: the Generate view and the
 * Fields view each call `useGeneration`, and a run started in one must lock
 * the other and survive switching between them.
 */
type DocumentRun = {
  state: GenerationState;
  controller: AbortController | null;
  listeners: Set<() => void>;
};

const IDLE: GenerationState = { status: "idle" };
const runs = new Map<string, DocumentRun>();

function documentRun(documentId: string): DocumentRun {
  let entry = runs.get(documentId);
  if (!entry) {
    entry = { state: IDLE, controller: null, listeners: new Set() };
    runs.set(documentId, entry);
  }
  return entry;
}

function setRunState(
  documentId: string,
  next: GenerationState | ((previous: GenerationState) => GenerationState)
) {
  const entry = documentRun(documentId);
  entry.state = typeof next === "function" ? next(entry.state) : next;
  for (const listener of entry.listeners) {
    listener();
  }
}

/** Forget a document once no view shows it and no run is in flight. */
function release(documentId: string) {
  const entry = runs.get(documentId);
  if (entry && entry.listeners.size === 0 && !entry.controller) {
    runs.delete(documentId);
  }
}

/**
 * One generation run at a time per document, across all its views, with
 * progress, errors and cancel. Each run is one `runGeneration` call, so its
 * usage and budget handling are the pipeline's. See docs/spec.md, "User
 * flow" and "Cost controls".
 */
export function useGeneration({
  client,
  documentId,
  onRunningChange,
}: UseGenerationOptions): Generation {
  const subscribe = useCallback(
    (listener: () => void) => {
      const entry = documentRun(documentId);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        release(documentId);
      };
    },
    [documentId]
  );
  const state = useSyncExternalStore(
    subscribe,
    () => runs.get(documentId)?.state ?? IDLE,
    () => IDLE
  );
  const running = state.status === "running";

  // Lock this view's form for a run any view of the document started.
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  const reported = useRef(false);
  useEffect(() => {
    if (running !== reported.current) {
      reported.current = running;
      onRunningChangeRef.current?.(running);
    }
  }, [running]);
  useEffect(
    () => () => {
      if (reported.current) {
        reported.current = false;
        onRunningChangeRef.current?.(false);
      }
    },
    []
  );

  const generate = useCallback(
    async (request: GenerationRequest) => {
      const entry = documentRun(documentId);
      if (entry.controller) {
        return;
      }
      const current = new AbortController();
      entry.controller = current;
      const startedAt = Date.now();
      setRunState(documentId, {
        status: "running",
        request,
        call: 1,
        totalCalls: GENERATION_CALLS[request.mode],
        startedAt,
        cancelling: false,
      });
      try {
        const result = await runGeneration({
          client,
          documentId,
          mode: request.mode,
          prompt: request.prompt,
          schemaId,
          signal: current.signal,
          onProgress: ({ call, totalCalls }) =>
            setRunState(documentId, (previous) =>
              previous.status === "running"
                ? { ...previous, call, totalCalls }
                : previous
            ),
        });
        if (result.status === "success") {
          setRunState(documentId, {
            status: "success",
            request,
            calls: result.calls,
            durationMs: Date.now() - startedAt,
          });
        } else if (result.cancelled) {
          setRunState(documentId, { status: "cancelled", request });
        } else {
          setRunState(documentId, {
            status: "error",
            request,
            message: result.error,
            budgetExhausted: result.budgetExhausted,
          });
        }
      } catch (error) {
        // The pipeline resolves its own failures; this is a bug or a lost tab.
        setRunState(documentId, {
          status: "error",
          request,
          message: error instanceof Error ? error.message : "Generation failed",
          budgetExhausted: false,
        });
      } finally {
        entry.controller = null;
        release(documentId);
      }
    },
    [client, documentId]
  );

  const cancel = useCallback(() => {
    runs.get(documentId)?.controller?.abort();
    setRunState(documentId, (previous) =>
      previous.status === "running"
        ? { ...previous, cancelling: true }
        : previous
    );
  }, [documentId]);

  const retry = useCallback(() => {
    if (state.status === "error" || state.status === "cancelled") {
      generate(state.request);
    }
  }, [generate, state]);

  return { state, running, generate, retry, cancel };
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
