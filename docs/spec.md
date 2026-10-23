# sanity-ui-animations: spec

An editor types a prompt in Sanity Studio, for example "Show our checkout
flow, and adding discounts to cart", and gets back a live preview of a UI
animation (a "Scene") drawn to Roboto Studio's design and motion standards.
Generation runs only through Sanity Agent Actions: no external LLM provider,
no AI Gateway.

Sources for the rules: [design.md](https://robotostudio.com/design.md) and
[motion.md](https://robotostudio.com/design/motion.md), mirrored in the
`designTokens` document and in `DEFAULT_TOKENS`.

## Status

The **foundation** is in place: this spec, the scene contract
(`packages/ui-animations`), the Studio schema, and the env and script
placeholders. The generator UI, normaliser, validator, codegen, renderer, web
route and `tokens:sync` come in follow-up tickets. Each one builds on the
contracts named here.

| Piece | Where | State |
|---|---|---|
| `SceneSpec` types, enums | `packages/ui-animations/src/scene-spec.ts` | done |
| `DesignTokens`, `DEFAULT_TOKENS` | `packages/ui-animations/src/tokens.ts` | done |
| Reference scene | `packages/ui-animations/src/fixtures/checkout.ts` | done |
| `normalizeScene` | `packages/ui-animations/src/normalize.ts` | done |
| `validateScene`, `scene` `Rule.custom` | `packages/ui-animations/src/validate.ts`, `sanity.ts` | done |
| `compileSceneToReact` | `packages/ui-animations/src/compile.ts` | done |
| `runGeneration` (Agent Actions pipeline) | `packages/ui-animations/src/pipeline.ts` | done (recorded fixtures only) |
| `pnpm agent:live` | `scripts/agent-actions-live.ts` | done, not yet run (needs schema deploy) |
| `animation`, `designTokens` schema | `apps/studio/schemaTypes/documents/` | done |
| Generator input + preview | `apps/studio/components/animation-generator/` | done |
| Primitive library (React) | `packages/ui-animations/src/react` (`./react` export) | done |
| `/animations/[slug]`, `/animations` | `apps/web/src/app/animations` | done |
| `pnpm tokens:sync` | `scripts/tokens-sync.ts` | placeholder |
| Checkout fixtures, pipeline e2e, web e2e, `pnpm seed:checkout` | `packages/ui-animations/src/pipeline.e2e.test.tsx`, `apps/web/tests/e2e/animation-checkout.spec.ts`, `scripts/seed-checkout-animation.ts` | done |

## User flow

1. **Prompt.** The editor creates an Animation and fills in a title, a slug and
   a prompt, then picks **Fast** or **Good**. Nothing else is visible: the
   scene, code and log fields stay hidden until **Show advanced fields** is
   ticked.
2. **Loading.** **Generate** (or Cmd/Ctrl+Enter in the prompt) locks the
   controls and names each call: "Generating the scene… (call 1 of 2)", then
   "Refining against the design rules… (call 2 of 2)" for Good. **Cancel**
   stops the run: no further call is made and the answer of the call in
   flight is dropped, but that call is still billed.
3. **Preview.** The normalised scene renders live under the prompt, through
   the same primitive library the website uses. Validation issues are listed
   beside it.
4. **Refine.** The editor edits the prompt and generates again, which replaces
   the scene. Advanced users can also edit the scene fields directly, and the
   preview follows.
5. **Publish.** Publishing is blocked while `validateScene` returns errors. A
   published animation is served at `/animations/<slug>`.

## Modes

| Mode | Calls | What happens | Temperature |
|---|---|---|---|
| Fast | 1 | Generate writes the scene | 0.3 (the default) |
| Good | 2 | Generate writes the scene, then a second Generate reviews and corrects it against the rules | 0.3, then 0 |

The UI shows the number of calls each mode makes. Every run appends a
`generationLog` entry `{ mode, calls, status, error?, durationMs, at }`, where
`calls` counts the requests actually made (a Good run that fails on call 1
logs `calls: 1`).

The refine pass uses **Generate** rather than Transform because Transform caps
`instruction` at 2,000 characters after `instructionParams` are interpolated,
and the rules and scene together exceed that.

## Content model

### `animation` (document)

| Field | Type | Visible | Written by |
|---|---|---|---|
| `title` | string | always | editor |
| `slug` | slug (from title) | always | editor |
| `prompt` | text | always | editor |
| `generationMode` | `fast` \| `good` | always | editor |
| `showAdvanced` | boolean | always | editor |
| `scene` | object mirroring `SceneSpec` | advanced | Agent Actions, then normaliser |
| `reactCode` | text, read-only | advanced | codegen (`client.patch`) |
| `generationLog[]` | `{mode, calls, status, error, durationMs, at}`, read-only | advanced | Studio (`client.patch`) |

`scene` holds `sceneMode` (`ambient` \| `intro` \| `interactive`, default
`intro`), `theme`, `canvas.size`, `label` (the aria-label), `windows[]`
(each with `elements[]` of row, card or button, with optional `badge` and
`accent`), `connectors[]` (`from` and `to` anchors, `dots`), `cursor` (`start`,
`targets[]`), `steps[]` (`action`, `target`, `role`, `delayMs`, `durationMs?`,
`value?`, `badge?`) and `stillStepKey`. Every array item is an object with a
`_key`. Ids share one namespace and steps refer to them by id. The full rules
are in the JSDoc of `scene-spec.ts`, and the Studio field descriptions repeat
them, because Agent Actions read those descriptions as instructions.

`sceneMode` lives inside `scene` and not at the document root, so `scene` is
exactly one `SceneSpec`.

Every field except title, slug, prompt, mode and the advanced toggle uses
`hidden: ({document}) => document?.showAdvanced !== true`, a **callback**
rather than `hidden: true`. That is what lets Agent Actions write to them (see
below).

### `designTokens` (singleton, `_id: "designTokens"`)

`designMdUrl`, `motionMdUrl`, `syncedAt`, `rawDesignMd`, `rawMotionMd`, plus
structured `roles[]`, `springs[]`, `sceneTokens.{light,dark}`, `badges`,
`tide` and `windowChrome`. The document is read-only in the Studio and is
written only by `tokens:sync`. Code reads it as `DesignTokens`, falling back to
`DEFAULT_TOKENS` for anything missing.

## Agent Actions flow

The Studio calls Agent Actions with `useClient({ apiVersion: "vX" })`, which
needs `@sanity/client` 7.4 or later (the catalog pins `^7.27.0`). The schema
id comes from `SANITY_STUDIO_SCHEMA_ID` (default `_.schemas.default`) and has to
be deployed with `sanity schema deploy` before the first call.

Each call uses `noWrite: true`: the action returns the document it would have
written, and the Studio normalises the result before writing it with one
`client.patch`. Editors never see raw output, and every write goes through
`normalizeScene`. `conditionalPaths` is still required with `noWrite`, because
it decides which paths the action is allowed to produce at all.

The draft is created first if it does not exist, so `documentId` always
resolves. Agent Actions never write to published documents.

```ts
const common = {
  schemaId: process.env.SANITY_STUDIO_SCHEMA_ID ?? "_.schemas.default",
  documentId: draftId, // edit operation on drafts.<id>
  target: { path: ["scene"], operation: "set", maxPathDepth: 8 },
  conditionalPaths: { defaultHidden: false },
  noWrite: true,
} as const;

const rules = {
  type: "groq",
  query: `*[_id == "designTokens"][0]{
    roles[]{role, use, curve, minMs, maxMs, staggerMs, maxItems},
    badges, tide, windowChrome, sceneTokens
  }`,
} as const;

// Call 1 (Fast and Good)
const generated = await client.agent.action.generate({
  ...common,
  temperature: 0.3,
  instruction: `Design one square UI animation scene for: $prompt.
Follow these design tokens exactly: $designTokens.
Show realistic product UI in one to three macOS windows and tell one story
in 6 to 14 steps. Use Tide on at most one element.
Use this as a worked example of the format: $example.`,
  instructionParams: {
    prompt: { type: "field", path: "prompt" },
    designTokens: rules,
    example: { type: "constant", value: JSON.stringify(checkoutScene) },
  },
});
await patchScene(normalizeScene(generated.scene, tokens));

// Call 2 (Good only), against the scene just written
const refined = await client.agent.action.generate({
  ...common,
  temperature: 0,
  instruction: `Review $scene against $designTokens and the story in $prompt.
Fix anything that breaks the rules: overlapping text, windows outside the
canvas, more than one Tide accent, wrong motion roles, dangling ids, steps
that do not tell the story. Keep everything that already works.`,
  instructionParams: {
    scene: { type: "field", path: "scene" },
    prompt: { type: "field", path: "prompt" },
    designTokens: rules,
  },
});
const scene = normalizeScene(refined.scene, tokens);
```

The tokens are passed through a `groq` param with a projection, not the whole
document, so the raw Markdown never reaches the prompt. `maxPathDepth: 8`
covers the deepest path, `scene.windows[k].elements[k].badge.label` (7
segments). The default of 4 would silently stop at `windows[k].elements`.

**Errors.** A 429 means the plan or the Agent Actions budget is exhausted. The
UI shows "AI budget reached for this organisation. Ask an admin to raise the
spending limit in Manage." and logs the run as `status: "error"`. Any other
failure shows the message and leaves the previous scene in place.

## Auto-correct, then hard validation

1. **`normalizeScene(draft, tokens)`** runs in the Studio after every call.
   It is pure and deterministic, and it never rejects. It fills defaults and
   `_key`s, clamps `canvas.size` and window boxes, maps unknown enum members to
   the nearest valid one, snaps `durationMs` into its role's range (cursor
   glides follow the distance rule), keeps `accent` on the first element only,
   and drops dangling references. Colours are not in the spec at all: theme
   and status are enums, and the renderer takes every colour, radius and
   traffic-light grey from the tokens, so off-brand values cannot be expressed.
2. **`validateScene(scene, tokens)`** returns `ValidationIssue[]`. It checks
   unique ids, that every reference resolves, that windows sit inside the
   canvas, the Tide limit, role duration ranges, that each action suits its
   target, reveal run length, and that there is at least one window and one
   step. The `scene` field's `Rule.custom` maps each `error` to a Sanity
   validation error, which blocks publishing. Warnings are shown but do not
   block. The web route also refuses to render a scene that has errors.

## Safety

The AI never writes code that runs.

- **The spec is data.** Agent Actions write only `scene`: ids, short strings,
  numbers and enum members, checked against the schema.
- **Trusted renderer.** A fixed primitive library in
  `@sanity-ui-animations/ui-animations` (Window, Element, Badge, Connector,
  Cursor, Ground) renders the spec in the Studio preview and on the website.
  Strings render as React text children, never as HTML, URLs or style values.
- **Code is compiled, not generated.** `compileSceneToReact(scene)` is a
  deterministic template over the spec. It emits every string as an escaped
  literal and stores the result in `reactCode` for developers to copy. Neither
  the Studio nor the site ever runs it through `eval`, `new Function` or a
  dynamic import.
- **Sandboxed code preview (optional).** If the compiled code is ever
  previewed live, it runs only inside `<iframe sandbox="allow-scripts"
  srcdoc="…">` without `allow-same-origin`, so it gets an opaque origin with no
  cookies, storage, Studio token or parent DOM.

## Tokens sync

`pnpm tokens:sync` (`scripts/tokens-sync.ts`) reads
`SANITY_UI_ANIMATIONS_PROJECT_ID`, `_DATASET` and `_WRITE_TOKEN` from the root
`.env.local` (template: `.env.example`), and then:

1. fetches design.md and motion.md,
2. parses the Markdown tables by their header text, not their position (Roles:
   Role / Use / Curve / Duration; Springs: Spring / Use / Motion config; Scene
   tokens: Token / Light / Dark), and the badge colours from the "Badges"
   bullet, falling back to `DEFAULT_TOKENS` per value and warning on each
   fallback,
3. writes the document with `createOrReplace({ _id: "designTokens", … })`,
   including both raw files and `syncedAt`. Reruns are idempotent.

## Website

`apps/web/src/app/animations/[slug]/page.tsx` fetches the published
`animation` by slug, runs `normalizeScene`, skips the scene if
`validateScene` returns errors, and renders it with the primitive library.
It sits on the square canvas, scaled to fit, as `role="img"` with
`aria-label={scene.label}` and its inner UI `aria-hidden`.
`prefers-reduced-motion` keeps opacity and colour changes and drops movement
and blur. Under reduced motion, Intro scenes show their rest state and Ambient
scenes show `stillStepKey`. An `/animations` index lists published
animations.

## Cost controls

- Each Agent Actions request costs **1 AI credit ($0.05)**. Fast costs one
  credit and Good costs two. The button labels say so.
- There is no model selection. `temperature` is the only setting.
- Spend is capped by the **organisation spending limit in Sanity Manage**.
  Past the cap, requests return 429 and the UI says so.
- Generation runs only on an explicit button press, never on keystroke or
  autosave. The button stays disabled while a run is in flight.
- `noWrite` with a single patch per call means a failed or abandoned run
  writes nothing.
- Animations open on a full-width **Generate** view (`AnimationView`, the
  default view from `defaultDocumentNode` in `apps/studio/structure.ts`);
  the **Fields** view is the form, with the same controls under the prompt.

## Open questions for Jono

1. **Canvas size.** 640px is a project choice (`DEFAULT_TOKENS.canvas`). What
   size are the scenes on the service pages?
2. **Traffic-light greys.** motion.md says only "neutral grey". The values in
   `DEFAULT_TOKENS` are picked from the ground tones. Are there exact values?
3. **Ground.** The brief allows a CSS mesh gradient instead of Paper Shaders.
   Is that acceptable on the website too, or only in the Studio preview?
4. **Who can generate.** Should generation be limited to a role, given
   that it spends credits?
5. **Interactive mode.** v1 renders interactive scenes like intro scenes. Do
   real reader-driven controls belong in v1?
6. **Generate size limit.** Transform's 2,000-character cap is documented, but
   Generate's limit is not. If the worked example plus the tokens hit it, drop
   the example or shorten the token projection.
7. **Publishing reactCode.** Should the compiled code be exposed on the website
   (copy button), or kept Studio-only?

- **Assumption (confirm with Jono):** Primitives lay out a window's elements
  themselves (44px title bar, 16px padding, 8px gaps; rows and buttons 40px,
  cards 64px), so the spec only places windows. Content past the window's
  height is clipped.
- **Assumption (confirm with Jono):** A step without `durationMs` takes its
  role's longest duration; `sweep` takes 1000ms; a cursor `move` between the
  hop and full-glide distances scales linearly from `hopMs` to the glide max.
- **Assumption (confirm with Jono):** Intro scenes play once on mount (not on
  scroll into view). Ambient scenes hold their final state 2s, fade out over
  400ms and loop.
- **Assumption (confirm with Jono):** Only `click` steps click. The renderer
  ignores `CursorTarget.click`, which would click a second time in scenes
  like the checkout fixture that carry both. The release eases on the press
  curve, because CSS and WAAPI cannot run the `pop` spring.
- **Assumption (confirm with Jono):** a cursor glide between 60px and 240px
  rises linearly from 400ms to the glide's 1200ms floor. `normalizeScene`
  measures travel from the window centre or an even split of its content
  area, since layout belongs to the renderer; `validateScene` accepts any
  glide from 400ms to 1750ms.
- **Assumption (confirm with Jono):** the Studio validates the stored `scene`
  as it is, not a normalised copy, so a mistyped id shows as an error instead
  of the step being silently dropped. Studio validation uses `DEFAULT_TOKENS`
  until the tokens ticket merges the `designTokens` document over them.
- **Assumption (confirm with Jono):** duplicate ids are left for validation to
  report rather than renamed, and an animation with no scene can't be
  published. Step and window counts outside the brief (6 to 14 steps, one to
  three windows) are warnings, not errors.
- **Assumption (confirm with Jono):** a Good run that fails on call 2 keeps
  call 1's normalised scene. Call 1 has to be written so the refine call can
  read `$scene`, and it is a better scene than the old one. "Leaves the
  previous scene in place" is read as "the last scene written".
- **Assumption (confirm with Jono):** each call writes `scene` and `reactCode`
  in one patch, and the `generationLog` entry goes in its own patch at the end
  of every run. A failed run therefore still writes its log entry.
- **Assumption (confirm with Jono):** when there is no draft, the run copies
  the published animation into `drafts.<id>` with `createIfNotExists`, as the
  Studio does on first edit.
- **Assumption (confirm with Jono):** `compileSceneToReact` bakes the theme
  colours and its own layout metrics (52px title bar, 44/64/40px rows, cards
  and buttons) into the output. The emitted component needs only React, until
  the primitive library can be published for it to import.
- **Assumption (confirm with Jono):** `reactCode` stays Studio-only. The web
  queries never select it and the site renders no code, so question 7 is
  answered "Studio-only" until Jono says otherwise.
- **Assumption (confirm with Jono):** `/animations` serves published documents
  only, even in draft mode or Presentation; the Studio preview covers drafts.
  A published scene that now fails `validateScene` keeps its page and title
  but shows a neutral "isn't available" line in place of the scene, and logs
  the issues server-side. Only documents with a slug and a scene are routed
  (anything else 404s), and the index lists them by title. The site uses `DEFAULT_TOKENS` until the
  tokens ticket supplies the `designTokens` merge.
- **Assumption (confirm with Jono):** `pnpm seed:checkout` publishes the
  reference checkout scene as `animation-checkout` at
  `/animations/checkout-flow`, with `reactCode` compiled from it, so the web
  e2e can prove compiled code never reaches the page. It writes only to the
  `development` dataset, and refuses if another published animation already
  owns the slug. The web spec skips,
  rather than fails, against a dataset that was never seeded.
- **Assumption (confirm with Jono):** anyone who can edit an animation can
  generate. The Studio already makes the form read-only for users without
  update access, and that disables Generate; there is no extra role check.
- **Assumption (confirm with Jono):** Generate sits under the Mode radio
  (directly below the prompt) and stays disabled until the prompt has text.
  A run makes every field read-only, not only the generator's own controls.
- **Assumption (confirm with Jono):** the Studio preview renders a normalised
  copy of the stored scene, so a half-edited scene still draws, while the
  issues beside it come from `validateScene` on the stored value, matching
  the field's validation.
- **Assumption (confirm with Jono):** the optional Code preview tab loads
  Babel standalone (unpkg) and React 19.2 (esm.sh) into its sandboxed frame,
  so it needs network access to those CDNs. The frame mounts only while the
  tab is open.
