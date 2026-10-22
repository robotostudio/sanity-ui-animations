import { createContext, useCallback, useContext, useState } from "react";
import type { InputProps, ObjectInputProps, RenderInputCallback } from "sanity";

/** Lets the Generate button lock the whole form while a run is in flight. */
const GenerationLockContext = createContext<(running: boolean) => void>(
  () => undefined
);

export const useGenerationLock = () => useContext(GenerationLockContext);

type RenderedInputProps = Omit<InputProps, "renderDefault">;

/** `props` with the input, and its DOM element if it has one, read-only. */
export function lockInput(props: RenderedInputProps): RenderedInputProps {
  if ("elementProps" in props && props.elementProps) {
    return {
      ...props,
      readOnly: true,
      elementProps: { ...props.elementProps, readOnly: true },
    } as RenderedInputProps;
  }
  return { ...props, readOnly: true };
}

/**
 * The `animation` document's form. Generate disables the form controls while
 * it runs (docs/spec.md, "User flow" step 2). An object input does not pass
 * its own `readOnly` down to its fields, so the lock wraps `renderInput`.
 */
export function AnimationDocumentInput(props: ObjectInputProps) {
  const [running, setRunning] = useState(false);
  const { renderInput } = props;
  const lockedRenderInput = useCallback<RenderInputCallback>(
    (inputProps) => renderInput(running ? lockInput(inputProps) : inputProps),
    [renderInput, running]
  );

  return (
    <GenerationLockContext.Provider value={setRunning}>
      {props.renderDefault({ ...props, renderInput: lockedRenderInput })}
    </GenerationLockContext.Provider>
  );
}
