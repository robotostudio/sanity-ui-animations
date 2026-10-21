import {
  type GenerationMode,
  runGeneration,
} from "@sanity-ui-animations/ui-animations";
import { SparklesIcon } from "@sanity/icons/Sparkles";
import { Button, Card, Flex, Spinner, Stack, Text } from "@sanity/ui";
import { useState } from "react";
import type { SanityClient } from "sanity";

/** Deployed schema id; unset falls back to the pipeline's default. */
const schemaId = process.env.SANITY_STUDIO_SCHEMA_ID || undefined;

export type AnimationGeneratorProps = {
  /** A `useClient({ apiVersion: "vX" })` client: Agent Actions need `vX`. */
  client: SanityClient;
  /** The animation's form `_id`; the run writes its draft. */
  documentId: string;
  mode: GenerationMode;
  prompt: string | undefined;
  /** The form is read-only, e.g. the user cannot edit this document. */
  readOnly?: boolean;
  /** Told when a run starts and ends, so the form can lock its fields. */
  onRunningChange?: (running: boolean) => void;
};

type RunState =
  | { status: "idle" }
  | { status: "running"; message: string }
  | { status: "error"; message: string };

/**
 * The Generate button and its run state. Generation happens only on an
 * explicit press, and the button stays disabled while a run is in flight.
 * See docs/spec.md, "User flow" and "Cost controls".
 */
export function AnimationGenerator({
  client,
  documentId,
  mode,
  prompt,
  readOnly = false,
  onRunningChange,
}: AnimationGeneratorProps) {
  const [state, setState] = useState<RunState>({ status: "idle" });
  const running = state.status === "running";
  const hasPrompt = Boolean(prompt?.trim());

  const generate = async () => {
    setState({ status: "running", message: "Generating…" });
    onRunningChange?.(true);
    try {
      const result = await runGeneration({
        client,
        documentId,
        mode,
        schemaId,
        onProgress: ({ message }) => setState({ status: "running", message }),
      });
      setState(
        result.status === "error"
          ? { status: "error", message: result.error }
          : { status: "idle" }
      );
    } catch (error) {
      // The pipeline resolves its own failures; this is a bug or a lost tab.
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Generation failed",
      });
    } finally {
      onRunningChange?.(false);
    }
  };

  return (
    <Stack gap={3}>
      <Flex align="center" gap={3}>
        <Button
          disabled={readOnly || running || !hasPrompt}
          icon={SparklesIcon}
          mode="default"
          onClick={generate}
          text="Generate"
          tone="primary"
        />
        {state.status === "running" ? (
          <Flex align="center" gap={2} role="status">
            <Spinner muted />
            <Text muted size={1}>
              {state.message}
            </Text>
          </Flex>
        ) : null}
      </Flex>
      {state.status === "error" ? (
        <Card padding={3} radius={2} role="alert" tone="critical">
          <Text size={1}>{state.message}</Text>
        </Card>
      ) : null}
    </Stack>
  );
}
