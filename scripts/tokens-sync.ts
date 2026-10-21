/**
 * `pnpm tokens:sync` — placeholder.
 *
 * The real implementation (separate ticket) will:
 * 1. fetch https://robotostudio.com/design.md and
 *    https://robotostudio.com/design/motion.md,
 * 2. parse the roles, springs, scene token and badge tables into the
 *    `DesignTokens` shape from `@sanity-ui-animations/ui-animations`,
 * 3. `createOrReplace` the `designTokens` singleton (fixed `_id: "designTokens"`)
 *    with the structured fields plus the raw Markdown, so reruns are idempotent.
 *
 * Reads SANITY_UI_ANIMATIONS_PROJECT_ID / _DATASET / _WRITE_TOKEN from the
 * root `.env.local` (see `.env.example`). See docs/spec.md, "Tokens sync".
 */
process.stdout.write("tokens:sync: not implemented yet\n");
