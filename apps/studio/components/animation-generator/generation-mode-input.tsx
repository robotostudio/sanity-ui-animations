import type { GenerationMode } from "@sanity-ui-animations/ui-animations";
import { Stack } from "@sanity/ui";
import {
  getPublishedId,
  set,
  type StringInputProps,
  useClient,
  useFormValue,
} from "sanity";

import { useGenerationLock } from "./animation-document-input";
import { GenerateControls } from "./generate-controls";
import { LastRun } from "./last-run";
import { ModeControl } from "./mode-control";
import { ScenePreview } from "./scene-preview";
import { useGeneration } from "./use-generation";

/**
 * The `generationMode` field in the Fields view: Fast / Good, then Generate
 * and the preview, under the prompt. The Generate view (`AnimationView`) is
 * the roomier home for the same controls. A read-only form disables them.
 */
export function GenerationModeInput(props: StringInputProps) {
  // Agent Actions are only on the experimental API version.
  const client = useClient({ apiVersion: "vX" });
  const onRunningChange = useGenerationLock();
  const id = useFormValue(["_id"]) as string | undefined;
  const prompt = useFormValue(["prompt"]) as string | undefined;
  const scene = useFormValue(["scene"]);
  const reactCode = useFormValue(["reactCode"]) as string | undefined;
  const generationLog = useFormValue(["generationLog"]);
  const mode: GenerationMode = props.value === "good" ? "good" : "fast";
  const generation = useGeneration({
    client,
    documentId: id ? getPublishedId(id) : "",
    onRunningChange,
  });
  const { state } = generation;
  const canGenerate = Boolean(id && prompt?.trim()) && !props.readOnly;

  return (
    <Stack gap={4}>
      <ModeControl
        disabled={props.readOnly || generation.running}
        onChange={(value) => props.onChange(set(value))}
        showLabel={false}
        value={mode}
      />
      <GenerateControls
        canGenerate={canGenerate}
        generation={generation}
        hasScene={Boolean(scene)}
        onGenerate={() =>
          canGenerate && generation.generate({ mode, prompt: prompt ?? "" })
        }
      />
      <ScenePreview
        run={state.status === "running" ? state : undefined}
        reactCode={reactCode}
        scene={scene}
      />
      <LastRun log={generationLog} />
    </Stack>
  );
}
