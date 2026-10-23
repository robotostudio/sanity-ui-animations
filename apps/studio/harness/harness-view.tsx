import { SlidersHorizontal, Sparkles } from "lucide-react";
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@sanity/ui";
import { type ComponentProps, type ReactNode, useContext } from "react";
import type { StringInputProps } from "sanity";

import { AnimationView } from "@/components/animation-generator/animation-view";
import { GenerationModeInput } from "@/components/animation-generator/generation-mode-input";

import { HarnessDocumentContext } from "./sanity-mock";

const view = new URLSearchParams(window.location.search).get("view");

/**
 * Approximates the Studio at 1280px: the Animations list pane, then the
 * document pane with its Generate / Fields view tabs. `?view=form` shows the
 * Fields view, the form in its 640px container (`FormView` uses
 * `Container width={1}`) with the real `generationMode` input.
 */
export function HarnessView() {
  const { document } = useContext(HarnessDocumentContext);
  const title = (document.title as string | undefined) ?? "Untitled";

  return (
    <Flex height="fill">
      {/* Stand-in Studio chrome: hidden from the a11y tree, so its "Generate"
          tab never matches the screenshot script's button lookup. */}
      <Card aria-hidden borderRight style={{ width: 300, flex: "none" }}>
        <Card borderBottom padding={3}>
          <Text weight="semibold">Animations</Text>
        </Card>
        <Box padding={2}>
          <Button
            justify="flex-start"
            mode="bleed"
            selected
            style={{ width: "100%" }}
            text={title}
          />
        </Box>
      </Card>
      <Flex direction="column" flex={1} style={{ minWidth: 0 }}>
        <Card aria-hidden borderBottom paddingX={3} paddingY={2}>
          <Flex align="center" gap={4}>
            <Text weight="semibold">{title}</Text>
            <Flex gap={1}>
              <ViewTab icon={<Sparkles size={14} />} selected={view !== "form"}>
                Generate
              </ViewTab>
              <ViewTab
                icon={<SlidersHorizontal size={14} />}
                selected={view === "form"}
              >
                Fields
              </ViewTab>
            </Flex>
          </Flex>
        </Card>
        <Box flex={1} overflow="auto">
          {view === "form" ? <FormView /> : <GenerateView />}
        </Box>
      </Flex>
    </Flex>
  );
}

function GenerateView() {
  const { document } = useContext(HarnessDocumentContext);
  const props = {
    document: {
      draft: document,
      displayed: document,
      historical: null,
      published: null,
    },
    documentId: document._id.replace(/^drafts\./, ""),
    options: {},
    schemaType: { name: "animation" },
  } as unknown as ComponentProps<typeof AnimationView>;
  return <AnimationView {...props} />;
}

function FormView() {
  const { document, patch } = useContext(HarnessDocumentContext);
  const modeProps = {
    value: document.generationMode === "good" ? "good" : "fast",
    readOnly: false,
    onChange: (event: { value: string }) =>
      patch({ generationMode: event.value }),
  } as unknown as StringInputProps;

  return (
    <Container paddingTop={5} paddingX={4} paddingBottom={6} width={1}>
      <Stack gap={5}>
        <Field label="Title">
          <TextInput readOnly value={(document.title as string) ?? ""} />
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
  );
}

function ViewTab({
  icon,
  selected,
  children,
}: {
  icon: ReactNode;
  selected: boolean;
  children: string;
}) {
  return (
    <Button
      fontSize={1}
      icon={icon}
      mode="bleed"
      padding={2}
      selected={selected}
      text={children}
    />
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
