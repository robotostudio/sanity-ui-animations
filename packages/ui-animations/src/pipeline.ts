import type { GenerateInstruction } from "@sanity/client";

import { compileSceneToReact } from "./compile";
import { checkoutScene } from "./fixtures/checkout";
import { normalizeScene } from "./normalize";
import type { SceneSpec, SceneSpecDraft } from "./scene-spec";
import { DEFAULT_TOKENS, type DesignTokens } from "./tokens";

/**
 * The Agent Actions generation run behind the Studio's Generate button. See
 * docs/spec.md, "Agent Actions flow", "Modes" and "Cost controls".
 *
 * Framework-agnostic: it takes a client (the Studio passes
 * `useClient({ apiVersion: "vX" })`) and reports progress through a callback,
 * so the Studio UI and `pnpm agent:live` share it.
 */

export type GenerationMode = "fast" | "good";

/** The schema `sanity schema deploy` stores when no id is configured. */
export const DEFAULT_SCHEMA_ID = "_.schemas.default";

/** Shown, and logged, when Agent Actions answers 429. */
export const BUDGET_EXHAUSTED_MESSAGE =
  "AI budget reached for this organisation. Ask an admin to raise the spending limit in Manage.";

export type GenerationProgress = {
  /** 1-based number of the call about to be made. */
  call: number;
  totalCalls: number;
  /** Ready to show, e.g. "Generating… (call 1 of 2)". */
  message: string;
};

/** One `animation.generationLog[]` item. */
export type GenerationLogEntry = {
  _key: string;
  _type: "generationLogEntry";
  mode: GenerationMode;
  /** Requests actually made, including one that failed. */
  calls: number;
  status: "success" | "error";
  error?: string;
  durationMs: number;
  /** ISO time the run started. */
  at: string;
};

export type GenerationResult =
  | {
      status: "success";
      scene: SceneSpec;
      reactCode: string;
      calls: number;
      log: GenerationLogEntry;
    }
  | {
      status: "error";
      /** Ready to show to the editor. */
      error: string;
      /** True when the organisation's AI budget is spent (HTTP 429). */
      budgetExhausted: boolean;
      calls: number;
      log: GenerationLogEntry;
    };

/** The patch calls the run makes; `SanityClient["patch"]` satisfies it. */
export type GenerationPatch = {
  set(attrs: Record<string, unknown>): GenerationPatch;
  setIfMissing(attrs: Record<string, unknown>): GenerationPatch;
  append(selector: string, items: unknown[]): GenerationPatch;
  commit(): Promise<unknown>;
};

/**
 * The slice of `SanityClient` the run needs. A real client configured with
 * `apiVersion: "vX"` satisfies it; tests pass a recorded fake.
 */
export type GenerationClient = {
  agent: {
    action: {
      generate(request: GenerateInstruction): Promise<Record<string, unknown>>;
    };
  };
  getDocument(id: string): Promise<Record<string, unknown> | undefined>;
  createIfNotExists(
    document: { _id: string; _type: string } & Record<string, unknown>
  ): Promise<unknown>;
  patch(id: string): GenerationPatch;
};

export type RunGenerationOptions = {
  client: GenerationClient;
  /** The animation's id, published or `drafts.`; the run writes the draft. */
  documentId: string;
  mode: GenerationMode;
  /** Tokens for `normalizeScene` and codegen; the prompt reads the dataset's. */
  tokens?: DesignTokens;
  /** Called before each request, e.g. to show "Generating… (call 1 of 2)". */
  onProgress?: (progress: GenerationProgress) => void;
  /** Deployed schema id, e.g. `process.env.SANITY_STUDIO_SCHEMA_ID`. */
  schemaId?: string;
  /** Seams for tests; default to the real normaliser and compiler. */
  normalize?: (draft: SceneSpecDraft, tokens: DesignTokens) => SceneSpec;
  compile?: (scene: SceneSpec, tokens: DesignTokens) => string;
  now?: () => number;
  createKey?: () => string;
};

/**
 * The design rules handed to every call: a projection of the `designTokens`
 * singleton, so the raw Markdown never reaches the prompt.
 */
const DESIGN_TOKENS_PARAM = {
  type: "groq",
  query: `*[_id == "designTokens"][0]{
    roles[]{role, use, curve, minMs, maxMs, staggerMs, maxItems},
    badges, tide, windowChrome, sceneTokens
  }`,
} as const;

const GENERATE_INSTRUCTION = `Design one square UI animation scene for: $prompt.
Follow these design tokens exactly: $designTokens.
Show realistic product UI in one to three macOS windows and tell one story
in 6 to 14 steps. Use Tide on at most one element.
Use this as a worked example of the format: $example.`;

function commonRequest(draftId: string, schemaId: string) {
  return {
    schemaId,
    documentId: draftId,
    // Deep enough for scene.windows[k].elements[k].badge.label (7 segments).
    target: { path: ["scene"], operation: "set" as const, maxPathDepth: 8 },
    // `scene` is hidden by a callback; this lets the action produce it.
    conditionalPaths: { defaultHidden: false },
    noWrite: true as const,
  };
}

/** Call 1 (Fast and Good): generate the scene from the prompt. */
function generateRequest(
  draftId: string,
  schemaId: string
): GenerateInstruction {
  return {
    ...commonRequest(draftId, schemaId),
    temperature: 0.3,
    instruction: GENERATE_INSTRUCTION,
    instructionParams: {
      prompt: { type: "field", path: ["prompt"] },
      designTokens: DESIGN_TOKENS_PARAM,
      example: { type: "constant", value: JSON.stringify(checkoutScene) },
    },
  };
}

const REFINE_INSTRUCTION = `Review $scene against $designTokens and the story in $prompt.
Fix anything that breaks the rules: overlapping text, windows outside the
canvas, more than one Tide accent, wrong motion roles, dangling ids, steps
that do not tell the story. Keep everything that already works.`;

/**
 * Call 2 (Good only): review and correct the scene call 1 wrote. Generate,
 * not Transform, because Transform caps the interpolated instruction at
 * 2,000 characters and the rules plus the scene exceed it.
 */
function refineRequest(draftId: string, schemaId: string): GenerateInstruction {
  return {
    ...commonRequest(draftId, schemaId),
    temperature: 0,
    instruction: REFINE_INSTRUCTION,
    instructionParams: {
      scene: { type: "field", path: ["scene"] },
      prompt: { type: "field", path: ["prompt"] },
      designTokens: DESIGN_TOKENS_PARAM,
    },
  };
}

const REQUESTS: Record<
  GenerationMode,
  ((draftId: string, schemaId: string) => GenerateInstruction)[]
> = {
  fast: [generateRequest],
  good: [generateRequest, refineRequest],
};

/** Agent Actions requests (AI credits) each mode makes. */
export const GENERATION_CALLS: Record<GenerationMode, number> = {
  fast: REQUESTS.fast.length,
  good: REQUESTS.good.length,
};

const progressMessage = (call: number, totalCalls: number) =>
  `Generating… (call ${call} of ${totalCalls})`;

const toDraftId = (id: string) =>
  id.startsWith("drafts.") ? id : `drafts.${id}`;

const randomKey = () =>
  globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12);

/**
 * Run one Fast or Good generation against an animation draft.
 *
 * Each call uses `noWrite`, so Agent Actions only returns the scene; the run
 * normalises it and writes `scene` and `reactCode` in one patch per call.
 * Every run, successful or not, appends one `generationLog` entry. Failures
 * resolve to `status: "error"` rather than throwing.
 */
export async function runGeneration({
  client,
  documentId,
  mode,
  tokens = DEFAULT_TOKENS,
  onProgress,
  schemaId = DEFAULT_SCHEMA_ID,
  normalize = normalizeScene,
  compile = compileSceneToReact,
  now = Date.now,
  createKey = randomKey,
}: RunGenerationOptions): Promise<GenerationResult> {
  const draftId = toDraftId(documentId);
  const requests = REQUESTS[mode];
  const startedAt = now();
  let calls = 0;
  let outcome:
    | { status: "success"; scene: SceneSpec; reactCode: string }
    | { status: "error"; error: string; budgetExhausted: boolean };

  try {
    await ensureDraft(client, draftId);
    let written: { scene: SceneSpec; reactCode: string } | undefined;
    for (const buildRequest of requests) {
      calls += 1;
      onProgress?.({
        call: calls,
        totalCalls: requests.length,
        message: progressMessage(calls, requests.length),
      });
      const generated = await client.agent.action.generate(
        buildRequest(draftId, schemaId)
      );
      const scene = normalize(generated.scene as SceneSpecDraft, tokens);
      const reactCode = compile(scene, tokens);
      // One write per call: the refine call reads `scene` back from the draft.
      await client.patch(draftId).set({ scene, reactCode }).commit();
      written = { scene, reactCode };
    }
    if (!written) {
      throw new Error(`No requests configured for mode "${mode}"`);
    }
    outcome = { status: "success", ...written };
  } catch (error) {
    const budgetExhausted = isBudgetExhausted(error);
    outcome = {
      status: "error",
      error: budgetExhausted ? BUDGET_EXHAUSTED_MESSAGE : errorMessage(error),
      budgetExhausted,
    };
  }

  const log: GenerationLogEntry = {
    _key: createKey(),
    _type: "generationLogEntry",
    mode,
    calls,
    status: outcome.status,
    ...(outcome.status === "error" && { error: outcome.error }),
    durationMs: now() - startedAt,
    at: new Date(startedAt).toISOString(),
  };
  await client
    .patch(draftId)
    .setIfMissing({ generationLog: [] })
    .append("generationLog", [log])
    .commit();
  return { ...outcome, calls, log };
}

/**
 * Agent Actions edit `documentId`, and the run patches it, so the draft must
 * exist. Without one, copy the published animation into it, as the Studio
 * does on first edit; without either, start an empty draft.
 */
async function ensureDraft(client: GenerationClient, draftId: string) {
  if (await client.getDocument(draftId)) {
    return;
  }
  const published = await client.getDocument(draftId.slice("drafts.".length));
  if (published) {
    const { _id, _rev, _createdAt, _updatedAt, ...content } = published;
    await client.createIfNotExists({
      _type: "animation",
      ...content,
      _id: draftId,
    });
    return;
  }
  await client.createIfNotExists({ _id: draftId, _type: "animation" });
}

/** Agent Actions answer 429 when the plan or the AI credit budget is spent. */
function isBudgetExhausted(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 429
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Generation failed";
}
