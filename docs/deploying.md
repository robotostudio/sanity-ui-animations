# Deploying

## Sanity project

1. Create a project and dataset at [sanity.io/manage](https://www.sanity.io/manage).
   Agent Actions and AI credits must be available on the plan.
2. Create a Viewer token (web app reads) and an Editor token (web app env
   validation, and the scripts in `scripts/`).
3. Set an organisation spending limit for AI credits in Manage. Requests past
   the limit return 429.

## Schema

Agent Actions resolve the `animation` type against a deployed schema. Deploy
it before the first generation and after every schema change:

```sh
cd apps/studio
npx sanity schema deploy
```

The default workspace id is `_.schemas.default`. If yours differs, set
`SANITY_STUDIO_SCHEMA_ID` in `apps/studio/.env` (and in the root `.env.local`
for `pnpm agent:live`).

## Studio

```sh
cd apps/studio
pnpm run deploy
```

Use `pnpm run deploy`, not `pnpm deploy`, which is a built-in pnpm command.
The first deploy creates the hosted Studio and returns an app id. Save it as
`SANITY_STUDIO_APP_ID`.

The repository also has a manual workflow,
`.github/workflows/deploy-sanity.yml`, started with `workflow_dispatch`. It
needs these repository secrets:

- `SANITY_DEPLOY_TOKEN`
- `SANITY_STUDIO_PROJECT_ID`
- `SANITY_STUDIO_DATASET`
- `SANITY_STUDIO_TITLE`
- `SANITY_STUDIO_PRESENTATION_URL`
- `SANITY_STUDIO_APP_ID`

## Web app

Deploy `apps/web`. On Vercel, create a project from the repository, set the
root directory to `apps/web`, and add the variables from
`apps/web/.env.example` to every environment you deploy (preview and
production are separate on Vercel).

Vercel deployment protection applies to preview URLs by default. A public demo
needs either a production deployment on a public domain or protection turned
off for the URL you share.

## CORS origins

In sanity.io/manage, under **API > CORS origins**, add each origin that talks
to the Sanity API from a browser, with **Allow credentials** enabled:

- `http://localhost:3000` and `http://localhost:3333` for local development
- the deployed web app URL (needed for live preview, Visual Editing and
  Presentation)
- the deployed Studio URL, if it is not on `*.sanity.studio`

A missing origin shows up as a blank or blocked Presentation preview, or as
403 errors from the Sanity API in the browser console.

## Demo content

`pnpm seed:checkout` publishes the reference checkout animation at
`/animations/checkout-flow` with no AI calls. It writes only to a dataset
named `development`. `pnpm tokens:sync` fills the `designTokens` document.
