import type { GenerateInstruction, SanityClient } from "@sanity/client";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { checkoutScene } from "./fixtures/checkout";
import {
  budgetExhaustedError,
  schemaNotFoundError,
} from "./fixtures/agent-actions/errors";
import { generateCheckoutResponse } from "./fixtures/agent-actions/generate-checkout";
import { refineCheckoutResponse } from "./fixtures/agent-actions/refine-checkout";
import {
  BUDGET_EXHAUSTED_MESSAGE,
  GENERATION_CALLS,
  type GenerationClient,
  type GenerationProgress,
  runGeneration,
} from "./pipeline";
import type { SceneSpec, SceneSpecDraft } from "./scene-spec";
import { DEFAULT_TOKENS } from "./tokens";

type Patch = {
  id: string;
  ops: [operation: string, ...args: unknown[]][];
};

/**
 * A stand-in for `SanityClient` that replays recorded Agent Actions
 * responses (or throws recorded errors) in order and records every request,
 * patch and create, so tests can assert on what would reach Sanity.
 */
function fakeClient(
  replies: (Record<string, unknown> | Error)[],
  documents: Record<string, Record<string, unknown>> = {
    "drafts.animation-checkout": { ...generateCheckoutResponse, scene: null },
  }
) {
  const requests: GenerateInstruction[] = [];
  const patches: Patch[] = [];
  const created: Record<string, unknown>[] = [];
  const queue = [...replies];

  const client: GenerationClient = {
    agent: {
      action: {
        generate: (request) => {
          requests.push(request);
          const reply = queue.shift();
          if (!reply) {
            return Promise.reject(new Error("unexpected generate call"));
          }
          return reply instanceof Error
            ? Promise.reject(reply)
            : Promise.resolve(reply);
        },
      },
    },
    getDocument: (id) => Promise.resolve(documents[id]),
    createIfNotExists: (document) => {
      created.push(document);
      return Promise.resolve(document);
    },
    patch: (id) => {
      const patch: Patch = { id, ops: [] };
      const builder = {
        set: (attrs: Record<string, unknown>) => {
          patch.ops.push(["set", attrs]);
          return builder;
        },
        setIfMissing: (attrs: Record<string, unknown>) => {
          patch.ops.push(["setIfMissing", attrs]);
          return builder;
        },
        append: (selector: string, items: unknown[]) => {
          patch.ops.push(["append", selector, items]);
          return builder;
        },
        commit: () => {
          patches.push(patch);
          return Promise.resolve({});
        },
      };
      return builder;
    },
  };

  return { client, requests, patches, created };
}

/** Normaliser stand-in: tags the draft so tests can see it was applied. */
const fakeNormalize = vi.fn(
  (draft: SceneSpecDraft) =>
    ({
      ...(draft as SceneSpec),
      label: `normalised: ${draft.label}`,
    }) as SceneSpec
);

/** A clock that advances 1.5s per reading, starting at a fixed instant. */
function fakeClock() {
  let ms = Date.parse("2026-10-21T09:14:00.000Z");
  return () => {
    const reading = ms;
    ms += 1500;
    return reading;
  };
}

const run = (
  client: GenerationClient,
  mode: "fast" | "good",
  onProgress?: (progress: GenerationProgress) => void
) =>
  runGeneration({
    client,
    documentId: "animation-checkout",
    mode,
    tokens: DEFAULT_TOKENS,
    onProgress,
    normalize: fakeNormalize,
    compile: (scene) => `// compiled: ${scene.label}`,
    now: fakeClock(),
    createKey: () => "log-key",
  });

describe("runGeneration", () => {
  it("accepts a real SanityClient", () => {
    expectTypeOf<SanityClient>().toExtend<GenerationClient>();
  });

  it("runs Fast as one Generate call, then writes the normalised scene", async () => {
    const { client, requests, patches } = fakeClient([
      generateCheckoutResponse,
    ]);
    const progress: GenerationProgress[] = [];

    const result = await run(client, "fast", (p) => progress.push(p));

    expect(progress).toEqual([
      { call: 1, totalCalls: 1, message: "Generating… (call 1 of 1)" },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      schemaId: "_.schemas.default",
      documentId: "drafts.animation-checkout",
      target: { path: ["scene"], operation: "set", maxPathDepth: 8 },
      conditionalPaths: { defaultHidden: false },
      noWrite: true,
      temperature: 0.3,
      instructionParams: {
        prompt: { type: "field", path: ["prompt"] },
        designTokens: {
          type: "groq",
          query: expect.stringContaining('*[_id == "designTokens"][0]{'),
        },
        example: { type: "constant", value: JSON.stringify(checkoutScene) },
      },
    });
    expect(requests[0]?.instruction).toContain("$prompt");
    expect(fakeNormalize).toHaveBeenCalledWith(
      generateCheckoutResponse.scene,
      DEFAULT_TOKENS
    );

    const scene = {
      ...generateCheckoutResponse.scene,
      label: `normalised: ${generateCheckoutResponse.scene.label}`,
    };
    expect(patches).toEqual([
      {
        id: "drafts.animation-checkout",
        ops: [["set", { scene, reactCode: `// compiled: ${scene.label}` }]],
      },
      {
        id: "drafts.animation-checkout",
        ops: [
          ["setIfMissing", { generationLog: [] }],
          [
            "append",
            "generationLog",
            [
              {
                _key: "log-key",
                _type: "generationLogEntry",
                mode: "fast",
                calls: 1,
                status: "success",
                durationMs: 1500,
                at: "2026-10-21T09:14:00.000Z",
              },
            ],
          ],
        ],
      },
    ]);
    expect(result).toMatchObject({ status: "success", scene, calls: 1 });
  });

  it("runs Good as Generate then a refine Generate, writing after each", async () => {
    const { client, requests, patches } = fakeClient([
      generateCheckoutResponse,
      refineCheckoutResponse,
    ]);
    const progress: string[] = [];

    const result = await run(client, "good", (p) => progress.push(p.message));

    expect(progress).toEqual([
      "Generating… (call 1 of 2)",
      "Generating… (call 2 of 2)",
    ]);
    expect(requests.map((request) => request.temperature)).toEqual([0.3, 0]);
    expect(requests[1]).toMatchObject({
      schemaId: "_.schemas.default",
      documentId: "drafts.animation-checkout",
      target: { path: ["scene"], operation: "set", maxPathDepth: 8 },
      conditionalPaths: { defaultHidden: false },
      noWrite: true,
      instructionParams: {
        scene: { type: "field", path: ["scene"] },
        prompt: { type: "field", path: ["prompt"] },
        designTokens: requests[0]?.instructionParams?.designTokens,
      },
    });
    expect(requests[1]?.instruction).toContain("Review $scene");

    const refined = {
      ...refineCheckoutResponse.scene,
      label: `normalised: ${refineCheckoutResponse.scene.label}`,
    };
    expect(patches.map((patch) => patch.ops[0]?.[1])).toEqual([
      expect.objectContaining({ scene: expect.any(Object) }),
      { scene: refined, reactCode: `// compiled: ${refined.label}` },
      { generationLog: [] },
    ]);
    expect(patches[2]?.ops[1]?.[2]).toEqual([
      expect.objectContaining({ mode: "good", calls: 2, status: "success" }),
    ]);
    expect(result).toMatchObject({
      status: "success",
      scene: refined,
      calls: 2,
    });
  });

  it("stops on a 429 with the budget message and logs the one call made", async () => {
    const { client, requests, patches } = fakeClient([
      budgetExhaustedError(),
      refineCheckoutResponse,
    ]);

    const result = await run(client, "good");

    expect(requests).toHaveLength(1);
    expect(result).toMatchObject({
      status: "error",
      error: BUDGET_EXHAUSTED_MESSAGE,
      budgetExhausted: true,
      calls: 1,
    });
    expect(patches).toEqual([
      {
        id: "drafts.animation-checkout",
        ops: [
          ["setIfMissing", { generationLog: [] }],
          [
            "append",
            "generationLog",
            [
              {
                _key: "log-key",
                _type: "generationLogEntry",
                mode: "good",
                calls: 1,
                status: "error",
                error: BUDGET_EXHAUSTED_MESSAGE,
                durationMs: 1500,
                at: "2026-10-21T09:14:00.000Z",
              },
            ],
          ],
        ],
      },
    ]);
  });

  it("shows any other failure's message and keeps the scene already written", async () => {
    const { client, patches } = fakeClient([
      generateCheckoutResponse,
      schemaNotFoundError(),
    ]);

    const result = await run(client, "good");

    expect(result).toMatchObject({
      status: "error",
      error:
        'Bad Request: Schema "_.schemas.default" not found in dataset "development"',
      budgetExhausted: false,
      calls: 2,
    });
    expect(patches).toHaveLength(2);
    expect(patches[0]?.ops[0]?.[1]).toHaveProperty("scene");
    expect(patches[1]?.ops[1]?.[2]).toEqual([
      expect.objectContaining({
        calls: 2,
        status: "error",
        error: expect.stringContaining("not found"),
      }),
    ]);
  });

  it("creates the draft from the published animation when there is none", async () => {
    const { _id, _rev, _createdAt, _updatedAt, ...content } =
      generateCheckoutResponse;
    const { client, created, requests } = fakeClient(
      [generateCheckoutResponse],
      { "animation-checkout": { ...content, _id: "animation-checkout", _rev } }
    );

    await run(client, "fast");

    expect(created).toEqual([{ ...content, _id: "drafts.animation-checkout" }]);
    expect(requests[0]?.documentId).toBe("drafts.animation-checkout");
  });

  it("creates an empty draft when the animation does not exist yet", async () => {
    const { client, created } = fakeClient([generateCheckoutResponse], {});

    await run(client, "fast");

    expect(created).toEqual([
      { _id: "drafts.animation-checkout", _type: "animation" },
    ]);
  });

  it("leaves an existing draft alone", async () => {
    const { client, created } = fakeClient([generateCheckoutResponse]);

    await run(client, "fast");

    expect(created).toEqual([]);
  });
});

describe("GENERATION_CALLS", () => {
  it("bills Fast one credit and Good two", () => {
    expect(GENERATION_CALLS).toEqual({ fast: 1, good: 2 });
  });
});
