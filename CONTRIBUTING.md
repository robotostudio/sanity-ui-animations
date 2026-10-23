# Contributing to sanity-ui-animations

This guide covers local setup, the checks a pull request must pass, and the
rules for changes to the animation pipeline.

## Local setup

Follow the [quickstart](README.md#quickstart) first. You need your own Sanity
project and tokens before the apps will run. In short:

```sh
corepack enable
pnpm install
cp apps/studio/.env.example apps/studio/.env
cp apps/web/.env.example apps/web/.env
cp .env.example .env.local
# fill in the values, then:
pnpm dev
```

Node `>=24` and the pnpm version pinned in `packageManager` are required.

You do not need AI credits to work on most of the code. The pipeline tests use
recorded Agent Actions replies, and `pnpm seed:checkout` gives you a scene to
render without any AI calls.

## How to submit a change

1. Fork the repository and clone your fork.
2. Create a branch, for example `git checkout -b fix/short-description`.
3. Make your changes and commit them.
4. Push the branch to your fork.
5. Open a pull request against `main` and fill in the template.

## Before you open a pull request

Run the checks CI runs:

```sh
pnpm lint
pnpm format:check   # or `pnpm format` to fix
pnpm check-types
pnpm test
pnpm build:studio   # CI builds only the Studio; Vercel builds apps/web
```

`pnpm build` also builds `apps/web`, which prerenders from your Sanity dataset,
so it fails against an empty or unconfigured dataset even when the code is fine.

If you changed a Sanity schema, run `pnpm --filter studio extract` and then
`pnpm type`, and commit the regenerated `apps/studio/schema.json` and
`packages/sanity/src/sanity.types.ts`.

## Rules for the animation pipeline

- Agent Actions write only scene data. Do not add a path where model output is
  evaluated, injected as HTML, or used as a URL or style value.
- Never `eval`, `new Function` or dynamically import `reactCode`. Any preview
  of compiled code must stay in an iframe sandboxed with `allow-scripts` only.
- A change to the `SceneSpec` shape needs matching changes to the `animation`
  schema, `normalizeScene`, `validateScene`, `compileSceneToReact`, the
  primitives and the fixtures. Keep [docs/spec.md](docs/spec.md) in step.
- Tests must not call Agent Actions. Use the recorded replies in
  `packages/ui-animations/src/fixtures/agent-actions`. Live runs go through
  `pnpm agent:live` only, which needs explicit flags and is capped.
- Generation runs only on an explicit Generate action, never on keystroke or
  autosave, because every request spends credits.

## Conventions

- Formatting and linting use Biome and Ultracite, not ESLint or Prettier. Do
  not add either.
- File names are kebab-case. Use `.tsx` for React components and `.ts` for
  everything else.
- Use the `Logger` class from `@sanity-ui-animations/logger` instead of
  `console.*`.
- Never commit `.env`, `.env.local` or any token. Add new variables to the
  matching `.env.example` with an empty or placeholder value, and to the
  README table.

## Code of conduct

This project follows the [code of conduct](CODE_OF_CONDUCT.md).

## Questions

Open an issue with one of the templates in `.github/ISSUE_TEMPLATE`. For
security issues, follow [SECURITY.md](SECURITY.md) instead of filing a public
issue.
