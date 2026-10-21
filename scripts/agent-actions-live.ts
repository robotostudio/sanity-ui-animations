/**
 * `pnpm agent:live -- --id <animation-id> --mode fast|good --schema-deployed --confirm`
 *
 * Runs ONE real Agent Actions generation (the same `runGeneration` the Studio
 * uses) against an animation draft, to check the pipeline end to end once
 * the schema is deployed. Every request spends one AI credit ($0.05), so it
 * refuses to run unless:
 *
 * - `--schema-deployed` says `sanity schema deploy` has stored the schema
 *   named by `SANITY_STUDIO_SCHEMA_ID` (default `_.schemas.default`),
 * - `--confirm` says you mean to spend the credits,
 * - `normalizeScene` is implemented, so the credits are not spent on a run
 *   that cannot write its result, and
 * - the run fits under a hard cap of 10 requests in total, counted in
 *   `.agent-actions-calls.json` at the repo root (gitignored). The count goes
 *   up before each request, so a crash never under-counts. Delete the file
 *   only on purpose.
 *
 * Reads SANITY_UI_ANIMATIONS_PROJECT_ID, _DATASET and _WRITE_TOKEN from the
 * root `.env.local` (see `.env.example`). Never prints the token.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClient } from "@sanity/client";

import { checkoutScene } from "../packages/ui-animations/src/fixtures/checkout";
import {
  DEFAULT_SCHEMA_ID,
  DEFAULT_TOKENS,
  GENERATION_CALLS,
  type GenerationMode,
  normalizeScene,
  runGeneration,
} from "../packages/ui-animations/src/index";

/** Most Agent Actions requests this script may ever make, across runs. */
export const MAX_LIVE_CALLS = 10;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COUNTER_FILE = path.join(ROOT, ".agent-actions-calls.json");

export type CallCounter = {
  calls: number;
  runs: { at: string; documentId: string; mode: GenerationMode }[];
};

export type LivePlan =
  | { ok: true; documentId: string; mode: GenerationMode }
  | { ok: false; reason: string };

/** Decide from the arguments and the counter whether a run may start. */
export function planLiveRun(argv: string[], counter: CallCounter): LivePlan {
  const flag = (name: string) => argv.includes(name);
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };

  const documentId = value("--id");
  const mode = value("--mode");
  if (!documentId || documentId.startsWith("--")) {
    return { ok: false, reason: "Pass the animation id: --id <id>." };
  }
  if (mode !== "fast" && mode !== "good") {
    return { ok: false, reason: "Pass --mode fast or --mode good." };
  }
  if (!flag("--schema-deployed")) {
    return {
      ok: false,
      reason:
        "Agent Actions need the deployed schema. Run `sanity schema deploy` in apps/studio, then pass --schema-deployed.",
    };
  }
  const cost = GENERATION_CALLS[mode];
  if (!flag("--confirm")) {
    return {
      ok: false,
      reason: `A ${mode} run makes ${cost} Agent Actions request(s), ${cost} AI credit(s). Pass --confirm to spend them.`,
    };
  }
  if (counter.calls + cost > MAX_LIVE_CALLS) {
    return {
      ok: false,
      reason: `Live call cap reached: ${counter.calls} of ${MAX_LIVE_CALLS} used, a ${mode} run needs ${cost}.`,
    };
  }
  return { ok: true, documentId, mode };
}

export function readCounter(file = COUNTER_FILE): CallCounter {
  if (!existsSync(file)) {
    return { calls: 0, runs: [] };
  }
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<CallCounter>;
  return {
    calls: typeof parsed.calls === "number" ? parsed.calls : MAX_LIVE_CALLS,
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
  };
}

function writeCounter(counter: CallCounter, file = COUNTER_FILE) {
  writeFileSync(file, `${JSON.stringify(counter, null, 2)}\n`);
}

function normalizeIsImplemented(): boolean {
  try {
    normalizeScene(checkoutScene, DEFAULT_TOKENS);
    return true;
  } catch {
    return false;
  }
}

function fail(reason: string): never {
  process.stderr.write(`agent:live: ${reason}\n`);
  process.exit(1);
}

async function main() {
  const counter = readCounter();
  const plan = planLiveRun(process.argv.slice(2), counter);
  if (!plan.ok) {
    fail(plan.reason);
  }
  if (!normalizeIsImplemented()) {
    fail("normalizeScene is still a stub; nothing would be written.");
  }

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

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: "vX",
    useCdn: false,
  });

  counter.runs.push({
    at: new Date().toISOString(),
    documentId: plan.documentId,
    mode: plan.mode,
  });
  const result = await runGeneration({
    client,
    documentId: plan.documentId,
    mode: plan.mode,
    schemaId: process.env.SANITY_STUDIO_SCHEMA_ID || DEFAULT_SCHEMA_ID,
    onProgress: (progress) => {
      counter.calls += 1;
      writeCounter(counter);
      process.stdout.write(`${progress.message}\n`);
    },
  });

  process.stdout.write(
    `${result.status} after ${result.calls} call(s) in ${result.log.durationMs}ms; ${counter.calls} of ${MAX_LIVE_CALLS} live calls used.\n`
  );
  if (result.status === "error") {
    fail(result.error);
  }
  process.stdout.write(`Scene: ${result.scene.label}\n`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    fail(error instanceof Error ? error.message : String(error));
  });
}
