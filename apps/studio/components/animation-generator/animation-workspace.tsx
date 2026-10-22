import type { GenerationMode } from "@sanity-ui-animations/ui-animations";
import { SparklesIcon } from "@sanity/icons/Sparkles";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Stack,
  Text,
  useElementSize,
} from "@sanity/ui";
import { useToast } from "@sanity/ui/toast";
import { useEffect, useRef, useState } from "react";
import type { SanityClient } from "sanity";

import { formatDuration, GenerateControls } from "./generate-controls";
import { LastRun } from "./last-run";
import { ModeControl } from "./mode-control";
import { EXAMPLE_PROMPTS, MODE_TITLES } from "./mode-options";
import { PromptComposer } from "./prompt-composer";
import { ScenePreview } from "./scene-preview";
import { useGeneration } from "./use-generation";

/** From this pane width the actions sit on one row with the shortcut hint. */
const INLINE_ACTIONS_FROM = 640;

export type AnimationWorkspaceProps = {
  /** A `useClient({ apiVersion: "vX" })` client: Agent Actions need `vX`. */
  client: SanityClient;
  /** The animation's published id; the run writes its draft. */
  documentId: string;
  prompt: string | undefined;
  mode: GenerationMode;
  scene: unknown;
  reactCode: string | undefined;
  generationLog: unknown;
  onPromptChange: (prompt: string) => void;
  onModeChange: (mode: GenerationMode) => void;
  /** The editor cannot edit this document. */
  readOnly?: boolean;
};

/**
 * The animation's Generate view: a control card across the top (Fast / Good,
 * then the prompt and its actions) and the preview stage across the full
 * width of the pane under it. Generation runs only on Generate or
 * Cmd/Ctrl+Enter.
 */
export function AnimationWorkspace({
  client,
  documentId,
  prompt = "",
  mode,
  scene,
  reactCode,
  generationLog,
  onPromptChange,
  onModeChange,
  readOnly = false,
}: AnimationWorkspaceProps) {
  const toast = useToast();
  const generation = useGeneration({ client, documentId });
  const { state, running } = generation;
  const textArea = useRef<HTMLTextAreaElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const width = useElementSize(root)?.border.width ?? 0;
  const wide = width >= INLINE_ACTIONS_FROM;

  const hasPrompt = prompt.trim().length > 0;
  const canGenerate = hasPrompt && !readOnly;

  const generate = () => {
    if (canGenerate && !running) {
      generation.generate({ mode, prompt });
    }
  };

  const focusPrompt = () => {
    const element = textArea.current;
    element?.focus();
    element?.setSelectionRange(element.value.length, element.value.length);
  };

  const fillExample = (example: string) => {
    onPromptChange(example);
    // After the composer has taken the new value.
    requestAnimationFrame(focusPrompt);
  };

  useEffect(() => {
    if (state.status === "success") {
      toast.push({
        status: "success",
        title: "Animation generated",
        description: `${MODE_TITLES[state.request.mode]} · ${formatDuration(state.durationMs)}`,
      });
    }
  }, [state, toast]);

  return (
    <Box padding={[3, 4]} ref={setRoot}>
      <Stack gap={4}>
        <Card border padding={[3, 4]} radius={3}>
          <Stack gap={4}>
            {/* Each option names and explains itself; "Mode" is its
                accessible name. */}
            <ModeControl
              disabled={readOnly || running}
              onChange={onModeChange}
              showLabel={false}
              value={mode}
            />
            <PromptComposer
              footer={(hint) => (
                <GenerateControls
                  canGenerate={canGenerate}
                  generation={generation}
                  hasScene={Boolean(scene)}
                  inline={wide}
                  leading={hint}
                  onGenerate={generate}
                  onRefine={focusPrompt}
                />
              )}
              onChange={onPromptChange}
              onSubmit={generate}
              readOnly={readOnly || running}
              rows={wide ? 2 : 4}
              textAreaRef={textArea}
              value={prompt}
            />
          </Stack>
        </Card>
        <ScenePreview
          emptyState={
            <EmptyStage
              disabled={readOnly}
              failed={state.status === "error"}
              hasPrompt={hasPrompt}
              onExample={fillExample}
            />
          }
          run={state.status === "running" ? state : undefined}
          reactCode={reactCode}
          scene={scene}
        />
        <Box paddingX={1}>
          <LastRun log={generationLog} />
        </Box>
      </Stack>
    </Box>
  );
}

function EmptyStage({
  hasPrompt,
  onExample,
  disabled,
  failed,
}: {
  hasPrompt: boolean;
  failed: boolean;
  onExample: (example: string) => void;
  disabled: boolean;
}) {
  return (
    <Stack gap={5} style={{ maxWidth: 440, width: "100%" }}>
      <Stack gap={4} style={{ textAlign: "center" }}>
        <Flex justify="center">
          <Card padding={3} radius={6} tone="primary">
            <Text size={3}>
              <SparklesIcon />
            </Text>
          </Card>
        </Flex>
        <Heading as="h2" size={1}>
          {failed
            ? "No scene yet"
            : hasPrompt
              ? "Ready to generate"
              : "Describe an animation"}
        </Heading>
        <Text muted size={1}>
          {failed
            ? "The last run failed. Retry, or change the prompt first."
            : hasPrompt
              ? "Press Generate and your scene plays here."
              : "Write the product flow to animate in plain words, or start from an example."}
        </Text>
      </Stack>
      {hasPrompt ? null : (
        <Stack aria-label="Example prompts" as="ul" gap={2}>
          {EXAMPLE_PROMPTS.map((example) => (
            <Box as="li" key={example}>
              <Button
                disabled={disabled}
                justify="flex-start"
                mode="ghost"
                onClick={() => onExample(example)}
                padding={3}
                style={{ width: "100%" }}
                text={example}
                textAlign="left"
              />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
