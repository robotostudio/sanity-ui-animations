import {
  DEFAULT_TOKENS,
  normalizeScene,
  type SceneSpec,
  type SceneSpecDraft,
  type ValidationIssue,
  validateScene,
} from "@sanity-ui-animations/ui-animations";
import { Scene } from "@sanity-ui-animations/ui-animations/react";
import {
  Badge,
  Box,
  Card,
  Flex,
  Grid,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
} from "@sanity/ui";
import { Component, type ReactNode, useId, useMemo, useState } from "react";

import { CodePreview } from "./code-preview";

export type ScenePreviewProps = {
  /** The stored `scene` field, as the form holds it (possibly hand-edited). */
  scene: unknown;
  /** The stored `reactCode`, compiled from the scene. */
  reactCode?: string;
};

type PreviewTab = "scene" | "code";

/**
 * The live preview under the prompt: the scene through the same trusted
 * primitive library the website uses, with `validateScene`'s issues beside
 * it. It renders data, never code. See docs/spec.md, "User flow" step 3.
 */
export function ScenePreview({ scene, reactCode }: ScenePreviewProps) {
  const [selectedTab, setTab] = useState<PreviewTab>("scene");
  // Falls back to the scene if the code goes away while its tab is open.
  const tab: PreviewTab =
    selectedTab === "code" && reactCode ? "code" : "scene";
  const ids = useId();
  // Validate the stored value as it is (like the field's `Rule.custom`), but
  // render a normalised copy so a half-edited scene still draws.
  const preview = useMemo(
    () =>
      scene
        ? {
            normalized: normalizeScene(scene as SceneSpecDraft, DEFAULT_TOKENS),
            issues: validateScene(scene as SceneSpec, DEFAULT_TOKENS),
          }
        : undefined,
    [scene]
  );

  if (!preview) {
    return (
      <Card border padding={4} radius={2} tone="transparent">
        <Text muted size={1}>
          No scene yet. Write a prompt and press Generate.
        </Text>
      </Card>
    );
  }

  return (
    <Grid gridTemplateColumns={[1, 1, 2]} gap={3}>
      <Stack gap={2}>
        <TabList gap={1}>
          <Tab
            aria-controls={`${ids}-scene`}
            id={`${ids}-scene-tab`}
            label="Preview"
            onClick={() => setTab("scene")}
            selected={tab === "scene"}
          />
          <Tab
            aria-controls={`${ids}-code`}
            disabled={!reactCode}
            id={`${ids}-code-tab`}
            label="Code preview"
            onClick={() => setTab("code")}
            selected={tab === "code"}
          />
        </TabList>
        <Card border overflow="hidden" radius={2}>
          {tab === "code" && reactCode ? (
            // Mounted only while the tab is open: the frame runs code.
            <TabPanel aria-labelledby={`${ids}-code-tab`} id={`${ids}-code`}>
              <CodePreview reactCode={reactCode} />
              <Box padding={2}>
                <Text muted size={1}>
                  Compiled at the last Generate. Hand edits to the scene show
                  here after the next run.
                </Text>
              </Box>
            </TabPanel>
          ) : (
            <TabPanel aria-labelledby={`${ids}-scene-tab`} id={`${ids}-scene`}>
              <PreviewBoundary scene={preview.normalized}>
                <Scene scene={preview.normalized} tokens={DEFAULT_TOKENS} />
              </PreviewBoundary>
            </TabPanel>
          )}
        </Card>
      </Stack>
      <ValidationIssues issues={preview.issues} />
    </Grid>
  );
}

const SEVERITY_TONE = {
  error: "critical",
  warning: "caution",
} as const satisfies Record<ValidationIssue["severity"], string>;

function ValidationIssues({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return (
      <Box padding={2}>
        <Text muted size={1}>
          No validation issues.
        </Text>
      </Box>
    );
  }
  return (
    <Stack aria-label="Validation issues" as="ul" gap={2}>
      {issues.map((issue, index) => (
        <Card
          as="li"
          // Issues have no id; the same code can repeat on different paths.
          key={`${issue.code}-${index}`}
          padding={2}
          radius={2}
          tone={SEVERITY_TONE[issue.severity]}
        >
          <Flex align="flex-start" gap={2}>
            <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
            <Text size={1}>{issue.message}</Text>
          </Flex>
        </Card>
      ))}
    </Stack>
  );
}

/**
 * Keeps a scene the renderer cannot draw from taking the form down with it,
 * and tries again once the scene changes.
 */
class PreviewBoundary extends Component<
  { children: ReactNode; scene: SceneSpec },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { scene: SceneSpec }) {
    if (this.state.failed && previous.scene !== this.props.scene) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <Box padding={4}>
          <Text muted size={1}>
            This scene cannot be previewed. Check the validation issues.
          </Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
