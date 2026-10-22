import {
  BADGE_STATUSES,
  ELEMENT_KINDS,
  MOTION_ROLES,
  SCENE_MODES,
  SCENE_THEMES,
  STEP_ACTIONS,
  sceneValidation,
  WINDOW_KINDS,
} from "@sanity-ui-animations/ui-animations";
import { Clapperboard } from "lucide-react";
import {
  defineArrayMember,
  defineField,
  defineType,
  type ConditionalPropertyCallback,
} from "sanity";

import { AnimationDocumentInput } from "@/components/animation-generator/animation-document-input";
import { GenerationModeInput } from "@/components/animation-generator/generation-mode-input";
import { generationModeOptions } from "@/components/animation-generator/mode-options";

/**
 * Everything except the prompt is hidden until the editor ticks "Show
 * advanced fields". The callback (not a literal `hidden: true`) is what lets
 * Agent Actions write these fields: they skip hidden fields unless the call
 * passes `conditionalPaths: { defaultHidden: false }`, and that override only
 * applies to conditional ones. See docs/spec.md, "Agent Actions flow".
 */
const hiddenUnlessAdvanced: ConditionalPropertyCallback = ({ document }) =>
  document?.showAdvanced !== true;

const ID_DESCRIPTION =
  "Short unique id, lowercase with dashes (e.g. `cart`, `btn-apply`). Must be unique across the whole scene: steps, connectors and the cursor refer to things by this id.";

const badge = (description: string) =>
  defineField({
    name: "badge",
    title: "Badge",
    type: "object",
    description,
    fields: [
      defineField({
        name: "status",
        title: "Status",
        type: "string",
        description:
          "Colour of the pill: success (green), warning (amber), error (red), info (blue), or neutral (grey, no dot).",
        options: { list: [...BADGE_STATUSES] },
        validation: (Rule) => Rule.required(),
      }),
      defineField({
        name: "label",
        title: "Label",
        type: "string",
        description:
          "One to three words, sentence case, e.g. `Paid`, `10% off`.",
        validation: (Rule) => Rule.required().max(24),
      }),
    ],
  });

const anchor = (name: "from" | "to", description: string) =>
  defineField({
    name,
    title: name === "from" ? "From" : "To",
    type: "object",
    description,
    fields: [
      defineField({
        name: "windowId",
        title: "Window id",
        type: "string",
        description: "The `id` of a window in this scene.",
        validation: (Rule) => Rule.required(),
      }),
      defineField({
        name: "elementId",
        title: "Element id",
        type: "string",
        description:
          "Optional `id` of an element inside that window, to attach the line to that row instead of the window edge.",
      }),
    ],
    validation: (Rule) => Rule.required(),
  });

const sceneElement = defineArrayMember({
  name: "sceneElement",
  title: "Element",
  type: "object",
  description: "A solid row, card or button inside a window.",
  fields: [
    defineField({
      name: "id",
      title: "Id",
      type: "string",
      description: ID_DESCRIPTION,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      description:
        "`row` is a line item (label left, value right), `card` is a larger solid block for something important like a total, `button` is a pressable action the cursor can click.",
      options: { list: [...ELEMENT_KINDS] },
      initialValue: "row",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      description:
        "Main text, sentence case, short and realistic (e.g. `Wireless headphones`, `Apply discount`).",
      validation: (Rule) => Rule.required().max(48),
    }),
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      description:
        "Optional trailing text such as a price, count or date (e.g. `$120`).",
    }),
    badge(
      "Optional status pill shown on this element. Leave empty for no badge."
    ),
    defineField({
      name: "accent",
      title: "Accent",
      type: "boolean",
      description:
        "Highlight in the Tide accent colour. Use on exactly one element per scene: the single action that matters most in the story.",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "kind", value: "value" },
    prepare: ({ title, subtitle, value }) => ({
      title,
      subtitle: [subtitle, value].filter(Boolean).join(" · "),
    }),
  },
});

const sceneWindow = defineArrayMember({
  name: "sceneWindow",
  title: "Window",
  type: "object",
  description:
    "A rounded glass macOS-style window. Windows may overlap; later windows draw on top.",
  fields: [
    defineField({
      name: "id",
      title: "Id",
      type: "string",
      description: ID_DESCRIPTION,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description:
        "Title bar text. For a browser window, the address shown in the centred address field (e.g. `shop.example.com/cart`).",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "kind",
      title: "Kind",
      type: "string",
      description:
        "`browser` draws Safari chrome with an address field; `app` draws a plain macOS app window.",
      options: { list: [...WINDOW_KINDS] },
      initialValue: "app",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "x",
      title: "X",
      type: "number",
      description:
        "Left edge in pixels from the canvas's left side. The window must fit inside the canvas.",
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: "y",
      title: "Y",
      type: "number",
      description: "Top edge in pixels from the canvas's top.",
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: "w",
      title: "Width",
      type: "number",
      description: "Width in pixels. Typically 240 to 420.",
      validation: (Rule) => Rule.required().min(120),
    }),
    defineField({
      name: "h",
      title: "Height",
      type: "number",
      description:
        "Height in pixels. Leave room for the title bar (about 52px) plus each element.",
      validation: (Rule) => Rule.required().min(80),
    }),
    defineField({
      name: "active",
      title: "Active",
      type: "boolean",
      description:
        "Whether this is the focused window. Usually only one window is active.",
      initialValue: true,
    }),
    defineField({
      name: "elements",
      title: "Elements",
      type: "array",
      description: "Rows, cards and buttons inside the window, top to bottom.",
      of: [sceneElement],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "kind" },
  },
});

const sceneConnector = defineArrayMember({
  name: "sceneConnector",
  title: "Connector",
  type: "object",
  description:
    "A line between two windows showing data moving from one to the other.",
  fields: [
    defineField({
      name: "id",
      title: "Id",
      type: "string",
      description: ID_DESCRIPTION,
      validation: (Rule) => Rule.required(),
    }),
    anchor("from", "Where the line starts."),
    anchor("to", "Where the line ends."),
    defineField({
      name: "dots",
      title: "Travelling dots",
      type: "boolean",
      description:
        "Animate small dots travelling along the line from start to end.",
      initialValue: true,
    }),
  ],
  preview: {
    select: { from: "from.windowId", to: "to.windowId" },
    prepare: ({ from, to }) => ({ title: `${from ?? "?"} → ${to ?? "?"}` }),
  },
});

const cursorTarget = defineArrayMember({
  name: "cursorTarget",
  title: "Cursor target",
  type: "object",
  description: "A place the cursor travels to, in visit order.",
  fields: [
    defineField({
      name: "id",
      title: "Id",
      type: "string",
      description: ID_DESCRIPTION,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "windowId",
      title: "Window id",
      type: "string",
      description: "The `id` of the window the cursor moves to.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "elementId",
      title: "Element id",
      type: "string",
      description:
        "The `id` of the element to aim at, usually a button. Leave empty to aim at the window.",
    }),
    defineField({
      name: "click",
      title: "Click",
      type: "boolean",
      description: "Whether the cursor clicks when it arrives.",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "elementId", subtitle: "windowId" },
  },
});

const sceneStep = defineArrayMember({
  name: "sceneStep",
  title: "Step",
  type: "object",
  description:
    "One beat of the animation. Steps play in order; each waits for the previous one to finish, plus its delay.",
  fields: [
    defineField({
      name: "action",
      title: "Action",
      type: "string",
      description:
        "`enter` brings a window, element or connector in; `reveal` brings an element in with a gentle rise; `update` changes an element's value or badge in place; `exit` removes something; `move` glides the cursor to a cursor target; `click` clicks the cursor target it is on. Anything that enters or is revealed starts hidden.",
      options: { list: [...STEP_ACTIONS] },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "target",
      title: "Target id",
      type: "string",
      description:
        "The `id` of what this step acts on: a window, element or connector for enter, reveal, update and exit; a cursor target for move and click.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "role",
      title: "Motion role",
      type: "string",
      description:
        "Which motion role sets the timing: `enter` for windows and elements appearing, `reveal` for rows rising in, `exit` for removals, `glide` for cursor travel, `press` for clicks, `move` for repositions, `sweep` for connectors and progress, `drawer` for sheets.",
      options: { list: [...MOTION_ROLES] },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "delayMs",
      title: "Delay (ms)",
      type: "number",
      description:
        "Pause before this step starts, in milliseconds. 0 to 400 is typical.",
      initialValue: 0,
      validation: (Rule) => Rule.required().min(0).max(5000),
    }),
    defineField({
      name: "durationMs",
      title: "Duration (ms)",
      type: "number",
      description:
        "Optional. Leave empty to use the motion role's standard duration.",
      validation: (Rule) => Rule.min(0).max(5000),
    }),
    defineField({
      name: "value",
      title: "New value",
      type: "string",
      description:
        "Optional. For `update` steps: the text the target's value changes to (e.g. a new total `$135`).",
    }),
    badge("Optional. For `update` steps: the badge the target changes to."),
  ],
  preview: {
    select: { action: "action", target: "target", role: "role" },
    prepare: ({ action, target, role }) => ({
      title: `${action ?? "?"} ${target ?? ""}`,
      subtitle: role,
    }),
  },
});

const scene = defineField({
  name: "scene",
  title: "Scene",
  type: "object",
  description:
    "The structured animation: square canvas, macOS windows with rows and cards, connectors, a cursor path and an ordered list of steps. Generated from the prompt; mirrors SceneSpec in @sanity-ui-animations/ui-animations.",
  hidden: hiddenUnlessAdvanced,
  // validateScene's errors block publishing; its warnings are shown only.
  // See docs/spec.md, "Auto-correct, then hard validation".
  validation: (Rule) => [
    Rule.custom((value) => sceneValidation(value, "error")),
    Rule.custom((value) => sceneValidation(value, "warning")).warning(),
  ],
  fields: [
    defineField({
      name: "sceneMode",
      title: "Scene mode",
      type: "string",
      description:
        "`intro` plays once when scrolled into view then rests (the usual choice); `ambient` loops seamlessly; `interactive` is driven by the reader.",
      options: { list: [...SCENE_MODES], layout: "radio" },
      initialValue: "intro",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      description: "Light or dark colour scheme for the whole scene.",
      options: { list: [...SCENE_THEMES], layout: "radio" },
      initialValue: "light",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "canvas",
      title: "Canvas",
      type: "object",
      description: "The square stage every window sits on.",
      fields: [
        defineField({
          name: "size",
          title: "Size (px)",
          type: "number",
          description:
            "Width and height of the square canvas in pixels. 640 unless there is a reason to change it.",
          initialValue: 640,
          validation: (Rule) => Rule.required().min(320).max(1200),
        }),
      ],
    }),
    defineField({
      name: "label",
      title: "Accessible description",
      type: "string",
      description:
        "One sentence describing what happens in the animation, read aloud by screen readers.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "windows",
      title: "Windows",
      type: "array",
      description: "One to three windows. Each tells part of the story.",
      of: [sceneWindow],
    }),
    defineField({
      name: "connectors",
      title: "Connectors",
      type: "array",
      description: "Optional lines linking windows. Often none.",
      of: [sceneConnector],
    }),
    defineField({
      name: "cursor",
      title: "Cursor",
      type: "object",
      description: "The pointer that moves between targets and clicks.",
      fields: [
        defineField({
          name: "start",
          title: "Start position",
          type: "object",
          description:
            "Where the cursor starts, in canvas pixels. Leave empty to enter from off-canvas.",
          fields: [
            defineField({
              name: "x",
              title: "X",
              type: "number",
              description: "Pixels from the canvas's left side.",
            }),
            defineField({
              name: "y",
              title: "Y",
              type: "number",
              description: "Pixels from the canvas's top.",
            }),
          ],
        }),
        defineField({
          name: "targets",
          title: "Targets",
          type: "array",
          description: "Places the cursor visits, in order.",
          of: [cursorTarget],
        }),
      ],
    }),
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      description:
        "The timeline, in order. Usually 6 to 14 steps telling one clear story.",
      of: [sceneStep],
    }),
    defineField({
      name: "stillStepKey",
      title: "Reduced-motion still",
      type: "string",
      description:
        "Ambient scenes only: the key of the step whose end state is shown as a still to people who prefer reduced motion.",
    }),
  ],
});

export const animation = defineType({
  name: "animation",
  title: "Animation",
  type: "document",
  icon: Clapperboard,
  description:
    "A UI animation generated from a prompt and drawn in Roboto Studio's Scene style.",
  components: { input: AnimationDocumentInput },
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: "Internal name for this animation, e.g. `Checkout flow`.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL",
      type: "slug",
      description: "Web address for this animation under /animations/.",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "prompt",
      title: "Prompt",
      type: "text",
      rows: 4,
      description:
        "Describe the product flow to animate in plain words, e.g. “Show our checkout flow, and adding discounts to cart”.",
      validation: (Rule) => Rule.required().min(8),
    }),
    defineField({
      name: "generationMode",
      title: "Mode",
      type: "string",
      description:
        "Fast makes one AI request. Good makes two: it generates, then refines against the design rules. Each request costs one AI credit.",
      components: { input: GenerationModeInput },
      options: {
        list: generationModeOptions,
        layout: "radio",
        direction: "horizontal",
      },
      initialValue: "fast",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "showAdvanced",
      title: "Show advanced fields",
      type: "boolean",
      description:
        "Reveal the generated scene data, React code and generation history.",
      initialValue: false,
    }),
    scene,
    defineField({
      name: "reactCode",
      title: "React code",
      type: "text",
      rows: 12,
      description:
        "React source compiled from the scene, for developers to copy. Regenerated automatically and never edited by hand. The website never runs it; the Studio's Code preview runs it only in a sandboxed frame.",
      readOnly: true,
      hidden: hiddenUnlessAdvanced,
    }),
    defineField({
      name: "generationLog",
      title: "Generation log",
      type: "array",
      description: "Every generation run on this animation, newest last.",
      readOnly: true,
      hidden: hiddenUnlessAdvanced,
      of: [
        defineArrayMember({
          name: "generationLogEntry",
          title: "Generation",
          type: "object",
          fields: [
            defineField({
              name: "mode",
              title: "Mode",
              type: "string",
              description: "Fast or Good.",
              options: { list: ["fast", "good"] },
            }),
            defineField({
              name: "calls",
              title: "AI requests",
              type: "number",
              description:
                "Agent Actions requests made (each is one AI credit).",
            }),
            defineField({
              name: "status",
              title: "Status",
              type: "string",
              description: "Whether the run finished.",
              options: { list: ["success", "error"] },
            }),
            defineField({
              name: "error",
              title: "Error",
              type: "string",
              description: "Error message, if the run failed.",
            }),
            defineField({
              name: "durationMs",
              title: "Duration (ms)",
              type: "number",
              description: "Wall-clock time of the run.",
            }),
            defineField({
              name: "at",
              title: "Time",
              type: "datetime",
              description: "When the run started.",
            }),
          ],
          preview: {
            select: {
              mode: "mode",
              calls: "calls",
              status: "status",
              at: "at",
            },
            prepare: ({ mode, calls, status, at }) => ({
              title: `${mode ?? "?"} · ${calls ?? 0} call(s) · ${status ?? ""}`,
              subtitle: at,
            }),
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "prompt" },
  },
});
