import { MOTION_ROLES } from "@sanity-ui-animations/ui-animations";
import { Palette } from "lucide-react";
import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * Written only by `pnpm tokens:sync` (createOrReplace on `_id: "designTokens"`),
 * so every field is read-only in the Studio. Agent Actions read the whole
 * document through `instructionParams: { type: "document", documentId:
 * "designTokens" }`, which is why each field carries a description.
 */

const color = (name: string, title: string, description: string) =>
  defineField({ name, title, type: "string", description });

const px = (name: string, title: string, description: string) =>
  defineField({ name, title, type: "number", description });

const themeTokens = (name: "light" | "dark") =>
  defineField({
    name,
    title: name === "light" ? "Light" : "Dark",
    type: "object",
    description: `Scene colours in ${name} mode.`,
    fields: [
      defineField({
        name: "groundTones",
        title: "Ground tones",
        type: "array",
        description:
          "The five neutral hex colours of the background mesh gradient.",
        of: [defineArrayMember({ type: "string" })],
      }),
      color("glassFill", "Glass fill", "Window glass colour (hex)."),
      defineField({
        name: "glassOpacity",
        title: "Glass opacity",
        type: "number",
        description: "Opacity of the glass fill, 0 to 1.",
      }),
      color("card", "Card", "Solid card colour inside windows (hex)."),
      color("hairline", "Hairline", "1px divider colour (hex)."),
      color("text", "Text", "Primary text colour (hex)."),
      color("secondaryText", "Secondary text", "Muted text colour (hex)."),
      color("tide", "Tide", "The one accent colour (hex)."),
      color(
        "trafficLightActive",
        "Traffic lights (active)",
        "Neutral grey of the focused window's traffic lights (hex)."
      ),
      color(
        "trafficLightInactive",
        "Traffic lights (inactive)",
        "Lighter grey of an unfocused window's traffic lights (hex)."
      ),
    ],
  });

export const designTokens = defineType({
  name: "designTokens",
  title: "Design tokens",
  type: "document",
  icon: Palette,
  description:
    "Roboto Studio's design and motion rules, synced from robotostudio.com by `pnpm tokens:sync`. Generated animations are held to these.",
  readOnly: true,
  fields: [
    defineField({
      name: "designMdUrl",
      title: "design.md URL",
      type: "url",
      description: "Where the brand guidelines were fetched from.",
    }),
    defineField({
      name: "motionMdUrl",
      title: "motion.md URL",
      type: "url",
      description: "Where the motion guidelines were fetched from.",
    }),
    defineField({
      name: "syncedAt",
      title: "Synced at",
      type: "datetime",
      description: "When `pnpm tokens:sync` last wrote this document.",
    }),
    defineField({
      name: "roles",
      title: "Motion roles",
      type: "array",
      description:
        "Every animation names one of these roles; its curve and duration range come from here.",
      of: [
        defineArrayMember({
          name: "motionRole",
          title: "Motion role",
          type: "object",
          fields: [
            defineField({
              name: "role",
              title: "Role",
              type: "string",
              description: "Role name.",
              options: { list: [...MOTION_ROLES] },
            }),
            defineField({
              name: "use",
              title: "Use",
              type: "string",
              description: "What the role is for.",
            }),
            defineField({
              name: "curve",
              title: "Curve",
              type: "string",
              description:
                "CSS easing, e.g. `cubic-bezier(0.23, 1, 0.32, 1)` or `linear`.",
            }),
            px("minMs", "Min duration (ms)", "Shortest allowed duration."),
            px("maxMs", "Max duration (ms)", "Longest allowed duration."),
            px("staggerMs", "Stagger (ms)", "Gap between staggered items."),
            px("scaleFrom", "Scale from", "Starting scale, e.g. 0.96."),
            px("risePx", "Rise (px)", "Rise distance for reveals."),
            px("maxItems", "Max items", "Most items in one staggered run."),
          ],
          preview: { select: { title: "role", subtitle: "curve" } },
        }),
      ],
    }),
    defineField({
      name: "springs",
      title: "Springs",
      type: "array",
      description:
        "Springs, used only where something physical happens (a release, a layout change, following the pointer).",
      of: [
        defineArrayMember({
          name: "spring",
          title: "Spring",
          type: "object",
          fields: [
            defineField({
              name: "name",
              title: "Name",
              type: "string",
              description: "snap, pop or track.",
              options: { list: ["snap", "pop", "track"] },
            }),
            defineField({
              name: "use",
              title: "Use",
              type: "string",
              description: "What the spring is for.",
            }),
            px("duration", "Duration (s)", "Duration-based springs only."),
            px("bounce", "Bounce", "Duration-based springs only."),
            px("stiffness", "Stiffness", "Physics-based springs only."),
            px("damping", "Damping", "Physics-based springs only."),
            px("mass", "Mass", "Physics-based springs only."),
          ],
          preview: { select: { title: "name", subtitle: "use" } },
        }),
      ],
    }),
    defineField({
      name: "sceneTokens",
      title: "Scene tokens",
      type: "object",
      description: "Scene colours for light and dark mode.",
      fields: [themeTokens("light"), themeTokens("dark")],
    }),
    defineField({
      name: "badges",
      title: "Badges",
      type: "object",
      description: "Status pill geometry and colours.",
      fields: [
        px("heightPx", "Height (px)", "Pill height."),
        px("dotPx", "Dot (px)", "Status dot diameter."),
        defineField({
          name: "fillOpacity",
          title: "Fill opacity",
          type: "number",
          description: "Opacity of the status colour behind the label, 0 to 1.",
        }),
        color("success", "Success", "Success colour (hex)."),
        color("warning", "Warning", "Warning colour (hex)."),
        color("error", "Error", "Error colour (hex)."),
        color("info", "Info", "Info colour (hex)."),
        color("neutralFill", "Neutral fill", "Neutral badge fill (hex)."),
        color("neutralBorder", "Neutral border", "Neutral badge border (hex)."),
      ],
    }),
    defineField({
      name: "tide",
      title: "Tide",
      type: "object",
      description: "The one accent colour and how often it may appear.",
      fields: [
        color("color", "Colour", "Tide (hex)."),
        color("textColor", "Text colour", "Text drawn on Tide (hex)."),
        px("maxPerScene", "Max per scene", "How many elements may use Tide."),
      ],
    }),
    defineField({
      name: "windowChrome",
      title: "Window chrome",
      type: "object",
      description: "Glass window and macOS traffic light metrics.",
      fields: [
        px("cornerRadiusPx", "Corner radius (px)", "Window corner radius."),
        px("backdropBlurPx", "Backdrop blur (px)", "Glass blur radius."),
        px("topEdgePx", "Top edge (px)", "Bright top edge thickness."),
        px("trafficLightDiameterPx", "Traffic light size (px)", "Diameter."),
        px("trafficLightGapPx", "Traffic light gap (px)", "Space between."),
        px(
          "trafficLightInsetPx",
          "Traffic light inset (px)",
          "Inset from edge."
        ),
      ],
    }),
    defineField({
      name: "rawDesignMd",
      title: "design.md (raw)",
      type: "text",
      rows: 10,
      description: "The brand guidelines exactly as fetched.",
    }),
    defineField({
      name: "rawMotionMd",
      title: "motion.md (raw)",
      type: "text",
      rows: 10,
      description: "The motion guidelines exactly as fetched.",
    }),
  ],
  preview: {
    select: { syncedAt: "syncedAt" },
    prepare: ({ syncedAt }) => ({
      title: "Design tokens",
      subtitle: syncedAt ? `Synced ${syncedAt}` : "Not synced yet",
    }),
  },
});
