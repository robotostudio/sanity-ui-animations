import type { SceneBadge } from "../../scene-spec";
import { useScene, usePxToCqw, withOpacity } from "../context";

/** A fully round status pill: a dot in the status colour, then the label. */
export function Badge({ badge }: { badge: SceneBadge }) {
  const { tokens, theme } = useScene();
  const unit = usePxToCqw();
  const { badges } = tokens;
  const color =
    badge.status === "neutral" ? undefined : badges.colors[badge.status];

  return (
    <span
      data-badge={badge.status}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: unit(6),
        height: unit(badges.heightPx),
        paddingInline: unit(10),
        borderRadius: unit(badges.heightPx / 2),
        border: `1px solid ${color ? withOpacity(color, 24) : badges.neutral.border}`,
        background: color
          ? withOpacity(color, badges.fillOpacity * 100)
          : badges.neutral.fill,
        color: theme.text,
        fontSize: unit(12),
        whiteSpace: "nowrap",
      }}
    >
      {color ? (
        <span
          style={{
            width: unit(badges.dotPx),
            height: unit(badges.dotPx),
            borderRadius: "50%",
            background: color,
          }}
        />
      ) : null}
      {badge.label}
    </span>
  );
}
