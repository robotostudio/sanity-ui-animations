# sanity-ui-animations

Prompt-to-UI-animation for Sanity Studio. An editor types a prompt, for example
"Show our checkout flow, and adding discounts to cart", picks **Fast** or
**Good**, and gets a live preview of an animated product UI scene. Generation
runs on [Sanity Agent Actions](https://www.sanity.io/docs/agent-actions). The
model writes structured scene data, a trusted primitive library renders it in
the Studio and on a Next.js site, and a deterministic compiler turns the same
scene into a standalone React component.

<!-- TODO(demo): replace this comment with a GIF of a prompt turning into a
preview in the Studio, saved as assets/demo.gif. Not recorded yet. -->

> [!NOTE]
> Live demo: [sanity-ui-animations-dev.vercel.app/animations/checkout-flow](https://sanity-ui-animations-dev.vercel.app/animations/checkout-flow),
> the reference checkout scene published with `pnpm seed:checkout`. Demo GIF:
> TODO.

The repo is built on
[Turbo Start Sanity](https://github.com/robotostudio/turbo-start-sanity), so
it also contains that template's page builder, blog and Markdown features.
This README covers the animation features and the setup they need. The full
design is in [docs/spec.md](docs/spec.md).

## Contents

- [How it works](#how-it-works)
- [Fast and Good modes](#fast-and-good-modes)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Deploying](#deploying)
- [Costs](#costs)
- [Contributing](#contributing)
- [License](#license)

## How it works

1. In the Studio, an editor creates an **Animation** document with a title,
   a slug and a prompt, and picks Fast or Good.
2. **Generate** calls Agent Actions with the prompt, the design tokens and a
   worked example scene. The action runs with `noWrite: true` and returns a
   `scene` object, which is plain data: ids, short strings, numbers and enum
   members.
3. `normalizeScene` auto-corrects the result (defaults, clamped sizes, nearest
   valid enum values, durations snapped to the motion rules, dangling
   references dropped), and the Studio writes it to the draft in one patch.
4. `compileSceneToReact` turns the scene into a self-contained React component
   and stores it in the read-only `reactCode` field for developers to copy.
5. The preview renders the scene with the primitive library. `validateScene`
   lists issues beside it, and errors block publishing.
6. A published animation is served at `/animations/<slug>` on the web app,
   rendered by the same primitives.

The model never writes code that runs. Strings render as React text, never as
HTML, URLs or style values. `reactCode` is never evaluated by the Studio or
the site. The optional code preview runs it only inside a sandboxed iframe
without `allow-same-origin`.

Design tokens (roles, springs, scene colours, badges, window chrome) come from
[robotostudio.com/design.md](https://robotostudio.com/design.md) and
[robotostudio.com/design/motion.md](https://robotostudio.com/design/motion.md).
`pnpm tokens:sync` mirrors them into a read-only `designTokens` document,
which generation hands to the model as `$designTokens`. Normalising,
validating and rendering use `DEFAULT_TOKENS` in
`packages/ui-animations/src/tokens.ts`. To use your own design system, edit
`DEFAULT_TOKENS` (what renders) and point the sync at your own Markdown files
(what the model is told).

## Fast and Good modes

| Mode | Agent Actions calls | What happens | Temperature |
| --- | --- | --- | --- |
| Fast | 1 | Generate writes the scene | 0.3 |
| Good | 2 | Generate writes the scene, then a second Generate reviews it against the design tokens and the prompt and fixes what breaks the rules | 0.3, then 0 |

Both modes use Agent Actions only. There is no model selection and no
external LLM provider. Each run appends an entry to the `generationLog` field
with the mode, the number of calls made, the status, any error and the
duration. Generation runs only when the editor presses Generate (or
Cmd/Ctrl+Enter in the prompt), never on keystroke or autosave. Cancel stops
further calls, but a call already in flight is still billed.

The refine pass uses Generate rather than Transform because Transform limits
the interpolated instruction to 2,000 characters, and the rules plus the
scene exceed that.

## Architecture

```txt
apps/
  studio/                 Sanity Studio 6
    schemaTypes/documents/animation.ts       animation document schema
    schemaTypes/documents/design-tokens.ts   designTokens singleton schema
    components/animation-generator/          prompt, mode switch, Generate, preview
  web/                    Next.js 16 site
    src/app/animations/   /animations index and /animations/[slug]
packages/
  ui-animations/          scene contract and runtime
    src/scene-spec.ts     SceneSpec types and enums
    src/tokens.ts         DesignTokens and DEFAULT_TOKENS
    src/normalize.ts      normalizeScene (auto-correct, never rejects)
    src/validate.ts       validateScene (publish gate)
    src/pipeline.ts       runGeneration (Agent Actions, Fast and Good)
    src/compile.ts        compileSceneToReact
    src/react/            Scene, Window, Element, Badge, Connector, Cursor, Ground
    src/fixtures/         reference checkout scene and recorded Agent Actions replies
  sanity-blocks/, sanity/, ui/, env/, logger/, tailwind-config/, typescript-config/
                          shared packages from Turbo Start Sanity
scripts/
  tokens-sync.ts          pnpm tokens:sync
  agent-actions-live.ts   pnpm agent:live (one real, capped generation run)
  seed-checkout-animation.ts  pnpm seed:checkout
docs/
  spec.md                 full design and content model
  architecture.md         data flow and package boundaries
  deploying.md            Studio, schema, web app, CORS and demo setup
```

More detail is in [docs/architecture.md](docs/architecture.md).

## Requirements

- Node.js `>=24`
- pnpm, the version pinned in `packageManager` (run `corepack enable`)
- A [Sanity](https://www.sanity.io/) project on a plan with Agent Actions and
  AI credits

## Quickstart

1. Clone and install:

   ```sh
   git clone https://github.com/robotostudio/sanity-ui-animations.git
   cd sanity-ui-animations
   corepack enable
   pnpm install
   ```

2. Create a Sanity project and dataset at
   [sanity.io/manage](https://www.sanity.io/manage). Under **API > Tokens**,
   create a Viewer token and an Editor token. Under **API > CORS origins**,
   add `http://localhost:3000` and `http://localhost:3333` with
   **Allow credentials** enabled.

3. Copy the env templates and fill them in (see
   [Environment variables](#environment-variables)):

   ```sh
   cp apps/studio/.env.example apps/studio/.env
   cp apps/web/.env.example apps/web/.env
   cp .env.example .env.local
   ```

4. Deploy the schema so Agent Actions can resolve the `animation` type:

   ```sh
   cd apps/studio
   npx sanity schema deploy
   cd ../..
   ```

   If the printed schema id is not `_.schemas.default`, set
   `SANITY_STUDIO_SCHEMA_ID` to it.

5. Optional: sync the design tokens into the dataset. Generation passes the
   synced `designTokens` document to the model as `$designTokens`; without
   it the model gets no design tokens. Rendering (the Studio preview and the
   site) always uses `DEFAULT_TOKENS`.

   ```sh
   pnpm tokens:sync
   ```

6. Optional: load the template's sample content, so the page builder's home
   page and blog are not empty. Without a published `homePage` document the
   site's `/` returns 404; `/animations` does not need it.

   ```sh
   cd apps/studio
   npx sanity dataset import seed-data.tar.gz <dataset> --replace
   cd ../..
   ```

   `--replace` overwrites documents that already have the same `_id`.

7. Start both apps:

   ```sh
   pnpm dev
   ```

   Studio: `http://localhost:3333`. Web: `http://localhost:3000`.

8. In the Studio, create an Animation, enter a prompt, pick Fast and press
   Generate. Publish it and open `http://localhost:3000/animations/<slug>`.

To see a scene without spending AI credits, run `pnpm seed:checkout`. It
publishes the reference checkout scene to the `development` dataset at
`/animations/checkout-flow`.

## Environment variables

Every variable is listed in an `.env.example` file. None of them contain real
values. Never commit a filled-in `.env`, `.env.local` or token.

Root `.env.local` (template: [.env.example](.env.example)), read by the
scripts in `scripts/`:

| Variable | Required | Notes |
| --- | --- | --- |
| `SANITY_UI_ANIMATIONS_PROJECT_ID` | for scripts | Sanity project id |
| `SANITY_UI_ANIMATIONS_DATASET` | for scripts | `development` by default. `pnpm seed:checkout` refuses any other dataset |
| `SANITY_UI_ANIMATIONS_WRITE_TOKEN` | for scripts | Editor token used by `tokens:sync`, `seed:checkout` and `agent:live` |
| `SANITY_STUDIO_SCHEMA_ID` | no | Schema id for `pnpm agent:live`. Defaults to `_.schemas.default` |

`apps/studio/.env` (template:
[apps/studio/.env.example](apps/studio/.env.example)):

| Variable | Required | Notes |
| --- | --- | --- |
| `SANITY_STUDIO_PROJECT_ID` | yes | Sanity project id |
| `SANITY_STUDIO_DATASET` | yes | Dataset name |
| `SANITY_STUDIO_SCHEMA_ID` | no | Deployed schema id Agent Actions use. Defaults to `_.schemas.default` |
| `SANITY_STUDIO_TITLE` | no | Studio display name |
| `SANITY_STUDIO_API_VERSION` | no | Defaults to the current UTC date |
| `SANITY_STUDIO_PRESENTATION_URL` | outside development | URL of the web app for the Presentation tool. Defaults to `http://localhost:3000` only when `NODE_ENV=development` |
| `SANITY_STUDIO_APP_ID` | no | Returned by the first `sanity deploy` |
| `NEXT_PUBLIC_SITE_URL` | no | Read by the `invalidate-tags` Sanity Function only |
| `SANITY_REVALIDATE_SECRET` | no | Read by the `invalidate-tags` Sanity Function only. Must match the web app |

`apps/web/.env` (template: [apps/web/.env.example](apps/web/.env.example)),
validated at startup by `@sanity-ui-animations/env`:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | yes | Sanity project id |
| `NEXT_PUBLIC_SANITY_DATASET` | yes | Dataset name |
| `NEXT_PUBLIC_SANITY_API_VERSION` | no | Defaults to the current UTC date |
| `NEXT_PUBLIC_SANITY_STUDIO_URL` | yes | `http://localhost:3333` locally |
| `SANITY_API_READ_TOKEN` | yes | Viewer token for drafts, live preview and Visual Editing |
| `SANITY_API_WRITE_TOKEN` | yes | Editor token. Env validation requires it even though no runtime code reads it |
| `SANITY_REVALIDATE_SECRET` | no | Secret for `/api/revalidate-sync-tags`. The route rejects requests while unset |
| `AI_GATEWAY_API_KEY` | no | Only for the inherited FAQ ask box. Not used by animations |
| `SANITY_CONTEXT_ENDPOINT`, `SANITY_CONTEXT_TOKEN` | no | Only for the inherited FAQ ask box |
| `SANITY_E2E_SESSION_TOKEN`, `SANITY_E2E_DATASET`, `SANITY_E2E_FUNCTIONS_DEPLOYED` | no | Only for the Presentation e2e suite |

The `.env.example` files under `packages/*` exist for Sanity template
validation. Only the root, `apps/studio` and `apps/web` need env files.

## Commands

```sh
pnpm dev              # Studio and web app
pnpm dev:studio       # Studio only, port 3333
pnpm dev:web          # Web app only, port 3000

pnpm build            # Build everything
pnpm lint             # Biome lint
pnpm format           # Biome format (writes)
pnpm format:check     # Biome format check
pnpm check-types      # TypeScript
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright smoke tests (needs a running or deployed site)

pnpm --filter studio extract && pnpm type   # Regenerate Sanity types after schema changes

pnpm tokens:sync      # Mirror design.md and motion.md into the designTokens document
pnpm seed:checkout    # Publish the reference checkout animation (no AI calls)
pnpm agent:live -- --id <animation-id> --mode fast|good --schema-deployed --confirm
                      # One real Agent Actions run. Spends credits, capped at 10 calls in total
```

The unit and pipeline tests run against recorded Agent Actions replies in
`packages/ui-animations/src/fixtures/agent-actions`, so they make no network
calls and cost nothing.

## Deploying

See [docs/deploying.md](docs/deploying.md). In short:

- **Studio**: `cd apps/studio && pnpm run deploy`, or the manual
  `Deploy Sanity Studio` GitHub Actions workflow.
- **Schema**: `npx sanity schema deploy` from `apps/studio` whenever the
  `animation` schema changes, or Agent Actions will use the old one.
- **Web app**: deploy `apps/web` (for example on Vercel with the root
  directory set to `apps/web`) with the variables from `apps/web/.env.example`.
- **CORS**: add every web app and Studio origin under **API > CORS origins**
  in sanity.io/manage, with credentials allowed.

## Costs

Each Agent Actions request costs one AI credit. Fast spends one credit per
run and Good spends two, and the mode labels in the Studio say so. Spend is
capped by the organisation spending limit in Sanity Manage. Past the cap,
requests return 429 and the Studio shows a budget message.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
and the [code of conduct](CODE_OF_CONDUCT.md). Report security issues
privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
