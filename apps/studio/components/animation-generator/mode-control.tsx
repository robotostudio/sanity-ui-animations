import type { GenerationMode } from "@sanity-ui-animations/ui-animations";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";
import { CircleIcon } from "@sanity/icons/Circle";
import { Card, Flex, Grid, Stack, Text } from "@sanity/ui";
import { type KeyboardEvent, useId, useRef } from "react";

import { GENERATION_MODES, MODE_DETAILS, MODE_TITLES } from "./mode-options";

export type ModeControlProps = {
  value: GenerationMode;
  /** Off where the field already titles it, e.g. in the form. */
  showLabel?: boolean;
  onChange: (mode: GenerationMode) => void;
  disabled?: boolean;
};

/**
 * Fast / Good as a two-option segmented switch. It is a radio group, so
 * arrow keys move the choice and Tab leaves it. Each option says what it
 * does and costs; the selected one is filled and carries a check, so it
 * does not rely on colour alone.
 */
export function ModeControl({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: ModeControlProps) {
  const ids = useId();
  const buttons = useRef<Partial<Record<GenerationMode, HTMLElement | null>>>(
    {}
  );

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step || disabled) {
      return;
    }
    event.preventDefault();
    const count = GENERATION_MODES.length;
    const next =
      GENERATION_MODES[
        (GENERATION_MODES.indexOf(value) + step + count) % count
      ] ?? value;
    onChange(next);
    buttons.current[next]?.focus();
  };

  return (
    <Stack gap={3}>
      {showLabel ? (
        <Text as="span" id={`${ids}-label`} size={1} weight="medium">
          Mode
        </Text>
      ) : null}
      {/* `aria-disabled` rather than `disabled`, so a locked control still
          shows which mode the run is using. */}
      <Card
        border
        padding={1}
        radius={3}
        style={disabled ? { opacity: 0.6 } : undefined}
        tone="transparent"
      >
        <Grid
          aria-label={showLabel ? undefined : "Mode"}
          aria-labelledby={showLabel ? `${ids}-label` : undefined}
          gap={1}
          gridTemplateColumns={2}
          onKeyDown={onKeyDown}
          role="radiogroup"
        >
          {GENERATION_MODES.map((mode) => {
            const checked = mode === value;
            return (
              <Card
                __unstable_focusRing
                aria-checked={checked}
                aria-describedby={`${ids}-${mode}-detail`}
                aria-disabled={disabled || undefined}
                aria-labelledby={`${ids}-${mode}-title`}
                as="button"
                key={mode}
                onClick={() => {
                  if (!disabled) {
                    onChange(mode);
                  }
                }}
                padding={3}
                radius={2}
                ref={(element: HTMLButtonElement | null) => {
                  buttons.current[mode] = element;
                }}
                role="radio"
                selected={checked}
                shadow={checked ? 1 : undefined}
                style={{
                  cursor: disabled ? "default" : "pointer",
                  textAlign: "left",
                }}
                tabIndex={checked ? 0 : -1}
                type="button"
              >
                {/* A button centres its content; fill it so the two
                    options line up at the top when one wraps. */}
                <Flex align="flex-start" gap={3} style={{ height: "100%" }}>
                  <Text size={2}>
                    {checked ? <CheckmarkCircleIcon /> : <CircleIcon />}
                  </Text>
                  <Stack flex={1} gap={2}>
                    <Text
                      id={`${ids}-${mode}-title`}
                      size={1}
                      weight="semibold"
                    >
                      {MODE_TITLES[mode]}
                    </Text>
                    <Text
                      id={`${ids}-${mode}-detail`}
                      muted={!checked}
                      size={1}
                    >
                      {MODE_DETAILS[mode]}
                    </Text>
                  </Stack>
                </Flex>
              </Card>
            );
          })}
        </Grid>
      </Card>
    </Stack>
  );
}
