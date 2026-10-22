import {
  Box,
  Card,
  Container,
  Flex,
  Radio,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@sanity/ui";
import { type ReactNode, useContext } from "react";
import type { StringInputProps } from "sanity";

import { GenerationModeInput } from "@/components/animation-generator/generation-mode-input";
import { generationModeOptions } from "@/components/animation-generator/mode-options";

import { HarnessDocumentContext } from "./sanity-mock";

/**
 * Approximates the Studio's document pane: a header, then the form in its
 * 640px container (`FormView` uses `Container width={1}`), with the real
 * `generationMode` input under the stand-in title, slug and prompt fields.
 */
export function HarnessView() {
  const { document, patch } = useContext(HarnessDocumentContext);
  const mode = document.generationMode === "good" ? "good" : "fast";

  const modeProps = {
    value: mode,
    readOnly: false,
    renderDefault: () => (
      <Flex gap={4}>
        {generationModeOptions.map((option) => (
          <Flex align="center" as="label" gap={2} key={option.value}>
            <Radio
              checked={mode === option.value}
              onChange={() => patch({ generationMode: option.value })}
            />
            <Text size={1}>{option.title}</Text>
          </Flex>
        ))}
      </Flex>
    ),
  } as unknown as StringInputProps;

  return (
    <Stack>
      <Card borderBottom padding={3}>
        <Text weight="semibold">
          {(document.title as string | undefined) ?? "Untitled"}
        </Text>
      </Card>
      <Container paddingTop={5} paddingX={4} width={1}>
        <Stack gap={5}>
          <Field label="Title">
            <TextInput value={(document.title as string) ?? ""} readOnly />
          </Field>
          <Field label="URL">
            <TextInput
              value={
                (document.slug as { current?: string } | undefined)?.current ??
                ""
              }
              readOnly
            />
          </Field>
          <Field label="Prompt">
            <TextArea
              onChange={(event) => patch({ prompt: event.currentTarget.value })}
              rows={4}
              value={(document.prompt as string) ?? ""}
            />
          </Field>
          <Field label="Mode">
            <GenerationModeInput {...modeProps} />
          </Field>
        </Stack>
      </Container>
    </Stack>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={3}>
      <Text size={1} weight="medium">
        {label}
      </Text>
      <Box>{children}</Box>
    </Stack>
  );
}
