import {
  DEFAULT_TOKENS,
  normalizeScene,
  type SceneSpec,
  type SceneSpecDraft,
  type ValidationIssue,
  validateScene,
} from "@sanity-ui-animations/ui-animations";
import { Scene } from "@sanity-ui-animations/ui-animations/react";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";
import { CircleIcon } from "@sanity/icons/Circle";
import { ResetIcon } from "@sanity/icons/Reset";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
} from "@sanity/ui";
import { Component, type ReactNode, useId, useMemo, useState } from "react";

import { CodePreview } from "./code-preview";
import { CALL_TITLES, type RunningState } from "./use-generation";

export type ScenePreviewProps = {
  /** The stored `scene` field, as the form holds it (possibly hand-edited). */
  scene: unknown;
  /** The stored `reactCode`, compiled from the scene. */
  reactCode?: string;
  /** The run in flight, shown on the stage call by call. */
  run?: RunningState;
  /** Shown in the stage when there is no scene yet. */
  emptyState?: ReactNode;
};

type PreviewTab = "scene" | "code";

/**
 * The stage spans its container, with this height: 16:9 on a wide pane,
 * square on a narrow one (the scene itself is square), and never taller
 * than the window leaves room for under the Generate view's controls.
 * `cqw` is the stage card's width.
 */
const STAGE_HEIGHT =
  "max(240px, min(100cqw, max(56.25cqw, 520px), calc(100vh - 400px)))";
/** The square scene, as tall as the stage less its padding. */
const SCENE_SIZE = `min(100%, calc(${STAGE_HEIGHT} - 48px))`;

/**
 * The live preview: the scene through the same trusted primitive library the
 * website uses, with `validateScene`'s issues under it. It renders data,
 * never code; the Code tab's frame is sandboxed. See docs/spec.md, "User
 * flow" step 3.
 */
export function ScenePreview({
  scene,
  reactCode,
  run,
  emptyState,
}: ScenePreviewProps) {
  const [selectedTab, setTab] = useState<PreviewTab>("scene");
  // Bumped by Replay: remounting the scene (or frame) plays it from the top.
  const [replays, setReplays] = useState(0);
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
      <Card
        border
        radius={3}
        style={{ containerType: "inline-size" }}
        tone="transparent"
      >
        <Flex
          align="center"
          justify="center"
          padding={[4, 5]}
          style={{ minHeight: STAGE_HEIGHT }}
        >
          {run ? (
            <RunSteps run={run} />
          ) : (
            (emptyState ?? (
              <Text muted size={1}>
                No scene yet. Write a prompt and press Generate.
              </Text>
            ))
          )}
        </Flex>
      </Card>
    );
  }

  const errors = preview.issues.filter(
    (issue) => issue.severity === "error"
  ).length;

  return (
    <Stack gap={3}>
      <Card border overflow="hidden" radius={3}>
        <Card borderBottom paddingX={2} paddingY={2}>
          <Flex align="center" gap={2} wrap="wrap">
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
            <Box flex={1} />
            <IssueSummary count={preview.issues.length} errors={errors} />
            <Button
              fontSize={1}
              icon={ResetIcon}
              mode="bleed"
              onClick={() => setReplays((count) => count + 1)}
              padding={2}
              text="Replay"
            />
          </Flex>
        </Card>
        <Card
          style={{ position: "relative", containerType: "inline-size" }}
          tone="transparent"
        >
          <Flex
            align="center"
            justify="center"
            padding={4}
            style={{ height: STAGE_HEIGHT }}
          >
            <Box style={{ width: SCENE_SIZE }}>
              {tab === "code" && reactCode ? (
                // Mounted only while the tab is open: the frame runs code.
                <TabPanel
                  aria-labelledby={`${ids}-code-tab`}
                  id={`${ids}-code`}
                >
                  <Card overflow="hidden" radius={3} shadow={1}>
                    <CodePreview key={replays} reactCode={reactCode} />
                  </Card>
                </TabPanel>
              ) : (
                <TabPanel
                  aria-labelledby={`${ids}-scene-tab`}
                  id={`${ids}-scene`}
                >
                  <Card overflow="hidden" radius={3} shadow={1}>
                    <PreviewBoundary scene={preview.normalized}>
                      <Scene
                        key={replays}
                        scene={preview.normalized}
                        tokens={DEFAULT_TOKENS}
                      />
                    </PreviewBoundary>
                  </Card>
                </TabPanel>
              )}
            </Box>
          </Flex>
          {run ? <ProgressOverlay run={run} /> : null}
        </Card>
        {tab === "code" ? (
          <Card borderTop paddingX={3} paddingY={2}>
            <Text muted size={1}>
              Compiled at the last Generate, and run in a sandboxed frame. Hand
              edits to the scene show here after the next run.
            </Text>
          </Card>
        ) : null}
      </Card>
      <ValidationIssues issues={preview.issues} />
    </Stack>
  );
}

function IssueSummary({ count, errors }: { count: number; errors: number }) {
  if (count === 0) {
    return (
      <Badge fontSize={1} tone="positive">
        No issues
      </Badge>
    );
  }
  return (
    <Badge fontSize={1} tone={errors > 0 ? "critical" : "caution"}>
      {count} issue{count === 1 ? "" : "s"}
    </Badge>
  );
}

/** Dims the previous scene while the next one is generated. */
function ProgressOverlay({ run }: { run: RunningState }) {
  return (
    <Card
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "color-mix(in srgb, var(--card-bg-color) 72%, transparent)",
        backdropFilter: "blur(2px)",
      }}
      tone="transparent"
    >
      <Card padding={4} radius={3} shadow={2}>
        <RunSteps run={run} />
      </Card>
    </Card>
  );
}

/**
 * The run's calls as a checklist: done, in flight, still to come. Status is
 * announced by the composer's live region; this is the visual version.
 */
function RunSteps({ run }: { run: RunningState }) {
  const steps = CALL_TITLES.slice(0, run.totalCalls);
  return (
    <Stack aria-hidden as="ol" gap={3} style={{ margin: 0, padding: 0 }}>
      {steps.map((title, index) => {
        const call = index + 1;
        const done = call < run.call;
        const current = call === run.call;
        return (
          <Flex align="center" as="li" gap={3} key={title}>
            <Flex
              align="center"
              justify="center"
              style={{ width: 21, height: 21, flex: "none" }}
            >
              {current ? (
                <Spinner />
              ) : (
                <Text muted={!done} size={2}>
                  {done ? <CheckmarkCircleIcon /> : <CircleIcon />}
                </Text>
              )}
            </Flex>
            <Text
              muted={!current}
              size={1}
              weight={current ? "medium" : "regular"}
            >
              {current && run.cancelling ? "Cancelling…" : title}
            </Text>
          </Flex>
        );
      })}
    </Stack>
  );
}

const SEVERITY_TONE = {
  error: "critical",
  warning: "caution",
} as const satisfies Record<ValidationIssue["severity"], string>;

function ValidationIssues({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <Stack aria-label="Validation issues" as="ul" gap={2}>
      {issues.map((issue, index) => (
        <Card
          as="li"
          // Issues have no id; the same code can repeat on different paths.
          key={`${issue.code}-${index}`}
          padding={3}
          radius={2}
          tone={SEVERITY_TONE[issue.severity]}
        >
          <Flex align="flex-start" gap={3}>
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
