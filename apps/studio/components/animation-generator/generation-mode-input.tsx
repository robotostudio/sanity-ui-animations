import type { GenerationMode } from "@sanity-ui-animations/ui-animations";
import { Stack } from "@sanity/ui";
import {
  type StringInputProps,
  useClient,
  useFormValue,
  getPublishedId,
} from "sanity";

import { AnimationGenerator } from "./animation-generator";
import { useGenerationLock } from "./animation-document-input";
import { ScenePreview } from "./scene-preview";

/**
 * The `generationMode` field: the Fast / Good radio, then Generate and the
 * live preview, so they sit under the prompt. Anyone who can edit the
 * document can generate: a read-only form disables the button.
 */
export function GenerationModeInput(props: StringInputProps) {
  // Agent Actions are only on the experimental API version.
  const client = useClient({ apiVersion: "vX" });
  const onRunningChange = useGenerationLock();
  const id = useFormValue(["_id"]) as string | undefined;
  const prompt = useFormValue(["prompt"]) as string | undefined;
  const scene = useFormValue(["scene"]);
  const reactCode = useFormValue(["reactCode"]) as string | undefined;
  const mode: GenerationMode = props.value === "good" ? "good" : "fast";

  return (
    <Stack gap={4}>
      {props.renderDefault(props)}
      {id ? (
        <AnimationGenerator
          client={client}
          documentId={getPublishedId(id)}
          mode={mode}
          onRunningChange={onRunningChange}
          prompt={prompt}
          readOnly={props.readOnly}
        />
      ) : null}
      <ScenePreview reactCode={reactCode} scene={scene} />
    </Stack>
  );
}
