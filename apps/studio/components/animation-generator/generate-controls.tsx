import { CloseIcon } from "@sanity/icons/Close";
import { EditIcon } from "@sanity/icons/Edit";
import { RefreshIcon } from "@sanity/icons/Refresh";
import { SparklesIcon } from "@sanity/icons/Sparkles";
import { Box, Button, Card, Flex, Grid, Stack, Text } from "@sanity/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  type Generation,
  type GenerationState,
  progressLabel,
} from "./use-generation";

export type GenerateControlsProps = {
  generation: Generation;
  /** There is a prompt and the editor may edit this document. */
  canGenerate: boolean;
  /** A scene already exists, so the action replaces it. */
  hasScene: boolean;
  onGenerate: () => void;
  /** Puts the editor back in the prompt to change it before the next run. */
  onRefine?: () => void;
};

/**
 * Generate (or Regenerate and Refine prompt), Cancel while a run is in
 * flight, its progress, and errors with Retry. The status line is a live
 * region that stays mounted, so screen readers hear every stage.
 */
export function GenerateControls({
  generation,
  canGenerate,
  hasScene,
  onGenerate,
  onRefine,
}: GenerateControlsProps) {
  const { state, running, retry, cancel } = generation;
  const generateButton = useRef<HTMLButtonElement>(null);
  const wasRunning = useRef(running);

  // Cancel unmounts with the run; put focus back on the main action.
  useEffect(() => {
    if (
      wasRunning.current &&
      !running &&
      document.activeElement === document.body
    ) {
      generateButton.current?.focus();
    }
    wasRunning.current = running;
  }, [running]);

  return (
    <Stack gap={3}>
      <Grid
        gap={2}
        style={{
          gridTemplateColumns:
            running || (hasScene && onRefine) ? "1fr auto" : "1fr",
        }}
      >
        <Button
          disabled={!canGenerate || running}
          icon={hasScene ? RefreshIcon : SparklesIcon}
          onClick={onGenerate}
          padding={3}
          ref={generateButton}
          text={actionText(running, hasScene)}
          tone="primary"
        />
        {running ? (
          <Button
            disabled={state.status === "running" && state.cancelling}
            icon={CloseIcon}
            mode="ghost"
            onClick={cancel}
            padding={3}
            text="Cancel"
          />
        ) : null}
        {!running && hasScene && onRefine ? (
          <Button
            disabled={!canGenerate}
            icon={EditIcon}
            mode="ghost"
            onClick={onRefine}
            padding={3}
            text="Refine prompt"
          />
        ) : null}
      </Grid>
      <RunStatus state={state} />
      {state.status === "error" ? (
        <RunError disabled={!canGenerate} onRetry={retry} state={state} />
      ) : null}
    </Stack>
  );
}

const actionText = (running: boolean, hasScene: boolean) => {
  if (running) {
    return "Generating…";
  }
  return hasScene ? "Regenerate" : "Generate";
};

/** The live region: stays mounted so each change is announced. */
function RunStatus({ state }: { state: GenerationState }) {
  let message: ReactNode = null;
  if (state.status === "running") {
    message = (
      <Flex align="center" gap={2}>
        <Box flex={1}>
          <Text muted size={1}>
            {progressLabel(state)}
          </Text>
        </Box>
        <Elapsed since={state.startedAt} />
      </Flex>
    );
  } else if (state.status === "cancelled") {
    message = (
      <Text muted size={1}>
        Cancelled. A request already sent still uses its credit.
      </Text>
    );
  } else if (state.status === "success") {
    message = (
      <Text muted size={1}>
        Scene ready in {formatDuration(state.durationMs)}.
      </Text>
    );
  }
  return (
    <Box aria-live="polite" role="status">
      {message}
    </Box>
  );
}

function RunError({
  state,
  onRetry,
  disabled,
}: {
  state: Extract<GenerationState, { status: "error" }>;
  onRetry: () => void;
  disabled: boolean;
}) {
  return (
    <Card border padding={3} radius={2} role="alert" tone="critical">
      <Stack gap={3}>
        <Text size={1} weight="medium">
          {state.budgetExhausted
            ? "Out of AI credits"
            : "The animation could not be generated"}
        </Text>
        <Text size={1}>{state.message}</Text>
        <Flex>
          <Button
            disabled={disabled}
            fontSize={1}
            icon={RefreshIcon}
            mode="ghost"
            onClick={onRetry}
            padding={2}
            text="Retry"
            tone="critical"
          />
        </Flex>
      </Stack>
    </Card>
  );
}

/** Seconds since `since`, ticking. Hidden from the live region's announcements. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text
      aria-hidden
      muted
      size={1}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {formatElapsed(now - since)}
    </Text>
  );
}

/** Whole seconds, so the ticking counter does not flicker: "0s", "1m 5s". */
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** `850` → "0.9s", `41200` → "41s", `95000` → "1m 35s". */
export function formatDuration(ms: number): string {
  if (ms < 10_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
