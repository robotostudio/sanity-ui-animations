# Architecture

This page describes how a prompt becomes a rendered animation and which
package owns each step. The field-level contract is in [spec.md](spec.md).

## Data flow

```txt
Studio: animation document
  prompt + generationMode (fast | good)
    |
    v
runGeneration (packages/ui-animations/src/pipeline.ts)
  ensure drafts.<id> exists (copy of published, or empty)
  for each call in the mode (fast: 1, good: 2)
    client.agent.action.generate   noWrite: true, target: scene
      instructionParams: prompt, designTokens (GROQ projection), example scene
    normalizeScene(result.scene, tokens)
    compileSceneToReact(scene)
    patch drafts.<id>: { scene, reactCode }
  append generationLog entry
    |
    v
Studio preview: <Scene> from @sanity-ui-animations/ui-animations/react
  validateScene issues listed beside the preview
  errors block publish (scene field Rule.custom)
    |
    v
Web: /animations/[slug] (apps/web/src/app/animations)
  fetch published animation { title, scene }   reactCode is never queried
  normalizeScene -> validateScene -> <Scene>, or a neutral fallback on errors
```

## Packages

| Package | Role |
| --- | --- |
| `packages/ui-animations` | Scene contract (`SceneSpec`), design tokens, `normalizeScene`, `validateScene`, `compileSceneToReact`, `runGeneration`, the React primitive library under the `./react` export, and fixtures |
| `apps/studio` | `animation` and `designTokens` schemas, and the generator UI in `components/animation-generator/` |
| `apps/web` | `/animations` index and `/animations/[slug]` routes |
| `scripts/` | `tokens:sync`, `seed:checkout` and `agent:live` |
| Other `packages/*` | Shared packages from Turbo Start Sanity (env, logger, Sanity client and queries, page-builder blocks, UI, Tailwind and TypeScript config) |

## Trust boundaries

- Agent Actions write only the `scene` object. It is data checked against the
  schema, not code.
- Every scene passes through `normalizeScene` before it is written, and
  through `validateScene` before it is published or rendered on the site.
- The primitive library renders strings as React text children. Colours,
  radii and spacing come from the design tokens, not from the scene, so the
  scene cannot express arbitrary styles.
- `compileSceneToReact` is a deterministic template. Its output is stored in
  `reactCode` for copying and is never passed to `eval`, `new Function` or a
  dynamic import. The optional Studio code preview runs it in an
  `<iframe sandbox="allow-scripts">` without `allow-same-origin`, and loads
  Babel standalone and React from public CDNs (unpkg and esm.sh) inside that
  frame.

## Design tokens

`pnpm tokens:sync` fetches `design.md` and `motion.md`, parses their tables by
header text, and writes the `designTokens` singleton with `createOrReplace`.
Values it cannot read fall back to `DEFAULT_TOKENS`, with a warning for each
one. Agent Actions receive a GROQ projection of this document, so the raw
Markdown never reaches the prompt.

## Tests

- Unit tests (Vitest) cover normalisation, validation, compilation, the
  pipeline and the primitives.
- `packages/ui-animations/src/pipeline.e2e.test.tsx` runs the whole pipeline
  over recorded Agent Actions replies, with no network calls.
- `apps/web/tests/e2e/animation-checkout.spec.ts` checks the seeded checkout
  animation on a running site, and skips when the dataset was not seeded.
