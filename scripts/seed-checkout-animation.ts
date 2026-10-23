/**
 * `pnpm seed:checkout`
 *
 * Writes, to the `development` dataset only, the published checkout `animation` (`_id: "animation-checkout"`,
 * served at `/animations/checkout-flow`) with `createOrReplace`, so the
 * website e2e spec has a scene to render. Reruns are idempotent. It makes no
 * Agent Actions calls and does not need the schema deployed: the document is
 * the hand-written reference scene from
 * `packages/ui-animations/src/fixtures/checkout-animation.ts`.
 *
 * Reads SANITY_UI_ANIMATIONS_PROJECT_ID, _DATASET and _WRITE_TOKEN from the
 * root `.env.local` (see `.env.example`). Never prints the token.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@sanity/client";

import { checkoutAnimation } from "../packages/ui-animations/src/fixtures/checkout-animation";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(reason: string): never {
  process.stderr.write(`seed:checkout: ${reason}\n`);
  process.exit(1);
}

async function main() {
  const envFile = path.join(ROOT, ".env.local");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  // biome-ignore-start lint/suspicious/noUndeclaredEnvVars: a root script, not a turbo task
  const projectId = process.env.SANITY_UI_ANIMATIONS_PROJECT_ID;
  const dataset = process.env.SANITY_UI_ANIMATIONS_DATASET;
  const token = process.env.SANITY_UI_ANIMATIONS_WRITE_TOKEN;
  // biome-ignore-end lint/suspicious/noUndeclaredEnvVars: a root script, not a turbo task
  if (!(projectId && dataset && token)) {
    fail(
      "Set SANITY_UI_ANIMATIONS_PROJECT_ID, _DATASET and _WRITE_TOKEN in the root .env.local."
    );
  }

  // The e2e fixture belongs in the development dataset only.
  if (dataset !== "development") {
    fail(
      `Refusing to seed dataset "${dataset}"; set SANITY_UI_ANIMATIONS_DATASET=development.`
    );
  }

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "2025-02-19",
    useCdn: false,
  });

  // Another published animation on the same slug would make the route
  // ambiguous; refuse rather than guess which one the spec reads.
  const clash = await client.fetch<string[]>(
    `*[_type == "animation" && slug.current == $slug && _id != $id && !(_id in path("drafts.**"))]._id`,
    { slug: checkoutAnimation.slug.current, id: checkoutAnimation._id }
  );
  if (clash.length > 0) {
    fail(
      `Slug "${checkoutAnimation.slug.current}" is already used by ${clash.join(", ")}.`
    );
  }

  await client.createOrReplace(checkoutAnimation);
  process.stdout.write(
    `Seeded ${checkoutAnimation._id} in ${projectId}/${dataset}: /animations/${checkoutAnimation.slug.current}\n`
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
