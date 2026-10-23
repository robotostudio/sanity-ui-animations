/**
 * `pnpm tokens:sync` — mirror robotostudio.com's design and motion guidelines
 * into the `designTokens` singleton. See docs/spec.md, "Tokens sync".
 *
 * 1. fetches design.md and motion.md,
 * 2. parses them with `parseDesignTokens`, falling back to `DEFAULT_TOKENS`
 *    per value and printing one warning per fallback,
 * 3. `createOrReplace`s `_id: "designTokens"` with the structured fields, both
 *    raw files and `syncedAt`. The id and array keys are fixed, so reruns
 *    replace the same document.
 *
 * `--dry-run` prints the parsed document (raw Markdown shown by length only)
 * and writes nothing, so it needs no env. A real run reads
 * SANITY_UI_ANIMATIONS_PROJECT_ID / _DATASET / _WRITE_TOKEN from the root
 * `.env.local` (template: `.env.example`).
 *
 * Imports name the package's `.ts` subpaths, not its index, because
 * `--experimental-strip-types` does not resolve the index's extensionless
 * specifiers.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@sanity/client";
import { Logger } from "@sanity-ui-animations/logger";
import { DEFAULT_TOKENS } from "@sanity-ui-animations/ui-animations/tokens";
import {
  parseDesignTokens,
  toDesignTokensDocument,
} from "@sanity-ui-animations/ui-animations/tokens-parse";

const API_VERSION = "2025-10-01";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const { values: flags } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: { "dry-run": { type: "boolean", default: false } },
});

const logger = new Logger("tokens:sync");

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "text/markdown" } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  return response.text();
}

/** Names the missing variables, never their values. */
function readEnv() {
  const envFile = join(repoRoot, ".env.local");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  // Not a turbo task, so these stay out of turbo.json's env lists.
  const names = {
    projectId: "SANITY_UI_ANIMATIONS_PROJECT_ID",
    dataset: "SANITY_UI_ANIMATIONS_DATASET",
    token: "SANITY_UI_ANIMATIONS_WRITE_TOKEN",
  } as const;
  const missing = Object.values(names).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing in .env.local: ${missing.join(", ")}`);
  }
  const read = (name: string) => process.env[name] ?? "";
  return {
    projectId: read(names.projectId),
    dataset: read(names.dataset),
    token: read(names.token),
  };
}

async function main() {
  const { designMdUrl, motionMdUrl } = DEFAULT_TOKENS.source;
  // A failed fetch stops the sync: writing defaults over a good document
  // with empty raw files would be worse than leaving it alone.
  const [designMd, motionMd] = await Promise.all([
    fetchText(designMdUrl),
    fetchText(motionMdUrl),
  ]);

  const { tokens, warnings } = parseDesignTokens(
    { designMd, motionMd },
    DEFAULT_TOKENS
  );
  for (const warning of warnings) {
    logger.warn(warning);
  }

  const document = toDesignTokensDocument(tokens, {
    rawDesignMd: designMd,
    rawMotionMd: motionMd,
    syncedAt: new Date().toISOString(),
  });

  if (flags["dry-run"]) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ...document,
          rawDesignMd: `<${designMd.length} chars>`,
          rawMotionMd: `<${motionMd.length} chars>`,
        },
        null,
        2
      )}\n`
    );
    logger.info(`dry run, ${warnings.length} warning(s), nothing written`);
    return;
  }

  const env = readEnv();
  const client = createClient({
    ...env,
    apiVersion: API_VERSION,
    useCdn: false,
  });
  const written = await client.createOrReplace(document);
  logger.info(
    `wrote ${written._id} (rev ${written._rev}) to ${env.dataset}, ${warnings.length} warning(s)`
  );
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
