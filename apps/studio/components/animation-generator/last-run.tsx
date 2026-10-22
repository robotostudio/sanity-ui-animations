import type { GenerationLogEntry } from "@sanity-ui-animations/ui-animations";
import { Badge, Flex, Stack, Text } from "@sanity/ui";

import { formatDuration } from "./generate-controls";
import { credits, MODE_TITLES } from "./mode-options";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
] as const;

/** "4 minutes ago", "yesterday"; "just now" under a minute. */
export function timeAgo(iso: string, now = Date.now()): string {
  const elapsed = Date.parse(iso) - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return RELATIVE.format(Math.round(elapsed / ms), unit);
    }
  }
  return "just now";
}

const isEntry = (entry: unknown): entry is GenerationLogEntry =>
  typeof entry === "object" &&
  entry !== null &&
  "at" in entry &&
  typeof entry.at === "string";

/**
 * The newest `generationLog` entry: when, which mode, how long and how many
 * requests, plus the credits every run on this animation has used.
 */
export function LastRun({ log }: { log: unknown }) {
  const entries = Array.isArray(log) ? log.filter(isEntry) : [];
  const last = entries.at(-1);
  if (!last) {
    return null;
  }
  const spent = entries.reduce((sum, entry) => sum + (entry.calls ?? 0), 0);
  const failed = last.status === "error";

  return (
    <Stack aria-label="Last generation" as="section" gap={3}>
      <Flex align="center" gap={2}>
        <Text size={1} weight="medium">
          Last generation
        </Text>
        <Badge fontSize={0} tone={failed ? "critical" : "positive"}>
          {failed ? "Failed" : "Done"}
        </Badge>
      </Flex>
      <Text muted size={1}>
        <time dateTime={last.at} title={new Date(last.at).toLocaleString()}>
          {timeAgo(last.at)}
        </time>
        {` · ${MODE_TITLES[last.mode] ?? last.mode} · ${last.calls} request${last.calls === 1 ? "" : "s"} · ${formatDuration(last.durationMs)}`}
      </Text>
      {failed && last.error ? (
        <Text muted size={1}>
          {last.error}
        </Text>
      ) : null}
      <Text muted size={1}>
        {entries.length} run{entries.length === 1 ? "" : "s"} on this animation,{" "}
        {credits(spent)} used.
      </Text>
    </Stack>
  );
}
