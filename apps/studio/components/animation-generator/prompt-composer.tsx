import { Flex, KBD, SrOnly, Stack, Text, TextArea } from "@sanity/ui";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type PromptComposerProps = {
  value: string;
  onChange: (value: string) => void;
  /** Cmd/Ctrl+Enter. */
  onSubmit: () => void;
  readOnly?: boolean;
  rows?: number;
  textAreaRef?: Ref<HTMLTextAreaElement>;
  /**
   * Lays out the row under the box: gets the shortcut hint, to place beside
   * the actions. Without it the hint sits there alone.
   */
  footer?: (hint: ReactNode) => ReactNode;
};

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * The prompt box. It keeps its own copy of the text so typing never waits
 * on the document store, and takes the stored value again whenever the
 * editor is not typing in it (another tab, an example prompt, undo).
 */
export function PromptComposer({
  value,
  onChange,
  onSubmit,
  readOnly = false,
  rows = 5,
  textAreaRef,
  footer,
}: PromptComposerProps) {
  const ids = useId();
  const [text, setText] = useState(value);
  const focused = useRef(false);
  const [mac, setMac] = useState(false);

  useEffect(() => setMac(isMac()), []);

  useEffect(() => {
    if (!focused.current) {
      setText(value);
    }
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  };

  const hint = (
    <Flex align="center" gap={1} id={`${ids}-hint`}>
      <SrOnly>
        Press {mac ? "Command" : "Control"} and Enter to generate.
      </SrOnly>
      <KBD aria-hidden>{mac ? "⌘" : "Ctrl"}</KBD>
      <KBD aria-hidden>Enter</KBD>
      <Text aria-hidden muted size={1}>
        to generate
      </Text>
    </Flex>
  );

  return (
    <Stack gap={3}>
      <Text as="label" htmlFor={`${ids}-prompt`} size={1} weight="medium">
        Prompt
      </Text>
      <TextArea
        aria-describedby={`${ids}-hint`}
        fontSize={2}
        id={`${ids}-prompt`}
        onBlur={() => {
          focused.current = false;
        }}
        onChange={(event) => {
          setText(event.currentTarget.value);
          onChange(event.currentTarget.value);
        }}
        onFocus={() => {
          focused.current = true;
        }}
        onKeyDown={onKeyDown}
        padding={3}
        placeholder="Describe the product flow to animate, e.g. “Show our checkout flow, and adding a discount to the cart”"
        radius={2}
        readOnly={readOnly}
        ref={textAreaRef}
        rows={rows}
        style={{ resize: "vertical" }}
        value={text}
      />
      {footer ? footer(hint) : hint}
    </Stack>
  );
}
