import type { GenerationMode } from "@sanity-ui-animations/ui-animations";
import { useCallback } from "react";
import { getPublishedId, useClient, useDocumentOperation } from "sanity";
import type { UserViewComponent } from "sanity/structure";

import { AnimationWorkspace } from "./animation-workspace";

type AnimationValues = {
  prompt?: string;
  generationMode?: string;
  scene?: unknown;
  reactCode?: string;
  generationLog?: unknown;
};

/**
 * The `animation` document's default view (see `defaultDocumentNode` in
 * structure.ts): the generator across the whole pane, outside the form's
 * 640px column. Edits go through the document store like the form's do,
 * so the Fields view, presence and history stay in step.
 */
export const AnimationView: UserViewComponent = ({ document, documentId }) => {
  // Agent Actions are only on the experimental API version.
  const client = useClient({ apiVersion: "vX" });
  const id = getPublishedId(documentId);
  const { patch } = useDocumentOperation(id, "animation");
  const values = (document.displayed ?? {}) as AnimationValues;
  const mode: GenerationMode =
    values.generationMode === "good" ? "good" : "fast";

  const onPromptChange = useCallback(
    (prompt: string) =>
      patch.execute(prompt ? [{ set: { prompt } }] : [{ unset: ["prompt"] }]),
    [patch]
  );
  const onModeChange = useCallback(
    (generationMode: GenerationMode) =>
      patch.execute([{ set: { generationMode } }]),
    [patch]
  );

  return (
    <AnimationWorkspace
      client={client}
      documentId={id}
      generationLog={values.generationLog}
      mode={mode}
      onModeChange={onModeChange}
      onPromptChange={onPromptChange}
      prompt={values.prompt}
      reactCode={values.reactCode}
      readOnly={Boolean(patch.disabled)}
      scene={values.scene}
    />
  );
};
