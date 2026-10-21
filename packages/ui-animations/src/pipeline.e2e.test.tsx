// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

import {
  budgetExhaustedError,
  schemaNotFoundError,
} from "./fixtures/agent-actions/errors";
import { generateCheckoutResponse } from "./fixtures/agent-actions/generate-checkout";
import { refineCheckoutResponse } from "./fixtures/agent-actions/refine-checkout";
import {
  type GenerationClient,
  type GenerationMode,
  type GenerationResult,
  runGeneration,
} from "./pipeline";
import { Scene } from "./react";
import type { SceneSpec, SceneSpecDraft } from "./scene-spec";
import { DEFAULT_TOKENS } from "./tokens";
import { validateScene } from "./validate";

/**
 * Pipeline end to end, for the prompt "Show our checkout flow, and adding
 * discounts to cart": recorded Agent Actions replies go through the real
 * `runGeneration`, `normalizeScene`, `compileSceneToReact`, `validateScene`
 * and primitive library. Only the network is faked.
 */

const DRAFT_ID = "drafts.animation-checkout";
const STARTED_AT = Date.parse("2026-10-21T09:14:00.000Z");
const BUDGET_MESSAGE =
  "AI budget reached for this organisation. Ask an admin to raise the spending limit in Manage.";

type Patch = { id: string; ops: [string, ...unknown[]][] };

/** Replays recorded replies in order and records every committed patch. */
function recordedClient(replies: (Record<string, unknown> | Error)[]) {
  const queue = [...replies];
  const patches: Patch[] = [];
  const client: GenerationClient = {
    agent: {
      action: {
        generate: () => {
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
    getDocument: (id) =>
      Promise.resolve(
        id === DRAFT_ID
          ? { ...generateCheckoutResponse, scene: null }
          : undefined
      ),
    createIfNotExists: (document) => Promise.resolve(document),
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
  return { client, patches };
}

async function generate(
  mode: GenerationMode,
  replies: (Record<string, unknown> | Error)[]
) {
  const { client, patches } = recordedClient(replies);
  const progress: string[] = [];
  let clock = STARTED_AT;
  const result = await runGeneration({
    client,
    documentId: "animation-checkout",
    mode,
    onProgress: ({ message }) => progress.push(message),
    // Each reading advances 700ms, so durations are fixed.
    now: () => {
      const reading = clock;
      clock += 700;
      return reading;
    },
    createKey: () => "log-1",
  });
  return { result, patches, progress };
}

function succeeded(result: GenerationResult) {
  if (result.status !== "success") {
    throw new Error(`run failed: ${result.error}`);
  }
  return result;
}

const errorsIn = (scene: SceneSpec | SceneSpecDraft) =>
  validateScene(scene as SceneSpec, DEFAULT_TOKENS)
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.code);

/** The `{ scene, reactCode }` sets, in write order. */
const sceneWrites = (patches: Patch[]) =>
  patches.flatMap((patch) =>
    patch.ops.filter(([op]) => op === "set").map(([, attrs]) => attrs)
  );

/** The `generationLog` items appended, in write order. */
const logWrites = (patches: Patch[]) =>
  patches.flatMap((patch) =>
    patch.ops
      .filter(
        ([op, selector]) => op === "append" && selector === "generationLog"
      )
      .flatMap(([, , items]) => items as unknown[])
  );

function parse(code: string) {
  return ts.createSourceFile(
    "scene.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

/** What a compiled `reactCode` contains, read through the TypeScript parser. */
function inspect(code: string) {
  const strings: string[] = [];
  const identifiers = new Set<string>();
  let dynamicImports = 0;
  // `setTimeout("code")` would evaluate its string.
  let timersGivenStrings = 0;
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isJsxText(node)) {
      strings.push(node.text);
    }
    if (ts.isIdentifier(node)) {
      identifiers.add(node.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      dynamicImports += 1;
    }
    if (
      ts.isCallExpression(node) &&
      /\bset(Timeout|Interval)$/.test(node.expression.getText()) &&
      node.arguments[0] &&
      !ts.isArrowFunction(node.arguments[0]) &&
      !ts.isIdentifier(node.arguments[0])
    ) {
      timersGivenStrings += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(code));
  const { diagnostics = [] } = ts.transpileModule(code, {
    fileName: "scene.tsx",
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  });
  return {
    strings,
    identifiers,
    dynamicImports,
    timersGivenStrings,
    diagnostics,
  };
}

/** Compiled code is a component over literals: nothing in it runs strings. */
function expectInert(code: string, scene: SceneSpec) {
  const {
    strings,
    identifiers,
    dynamicImports,
    timersGivenStrings,
    diagnostics,
  } = inspect(code);
  expect(diagnostics).toEqual([]);
  expect(code).toContain("export default function SceneAnimation()");
  for (const banned of [
    "eval",
    "Function",
    "dangerouslySetInnerHTML",
    "innerHTML",
    "fetch",
  ]) {
    expect(identifiers.has(banned), banned).toBe(false);
  }
  expect(dynamicImports).toBe(0);
  expect(timersGivenStrings).toBe(0);
  expect(code).not.toMatch(/<script/i);
  // The scene's words are carried as plain literals.
  expect(strings).toContain(scene.windows[0]?.title);
  expect(strings).toContain("Apply discount");
}

/** `label` is the recorded reply's own aria-label, untouched by the run. */
function expectRendersAsImage(scene: SceneSpec, label: string) {
  render(<Scene reducedMotion scene={scene} tokens={DEFAULT_TOKENS} />);
  const image = screen.getByRole("img", { name: label });
  expect(image.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  expect(image.textContent).toContain("Wireless headphones");
  expect(image.textContent).toContain("Apply discount");
  expect(image.textContent).toContain("Order #1042");
}

afterEach(cleanup);

describe("the recorded checkout fixtures", () => {
  it("are rough enough that the raw first pass would fail validation", () => {
    expect(errorsIn(generateCheckoutResponse.scene as SceneSpecDraft)).toEqual([
      "tide-overused",
      "duration-out-of-range",
      "dangling-target",
    ]);
  });
});

describe("checkout pipeline, Fast", () => {
  it("normalises the rough first pass into a scene with no validation errors", async () => {
    const { result } = await generate("fast", [generateCheckoutResponse]);

    const { scene } = succeeded(result);
    expect(errorsIn(scene)).toEqual([]);
    // What normalisation fixed: one Tide accent, an in-range glide, and the
    // update aimed at the missing `row-shipping` row dropped.
    const accented = scene.windows
      .flatMap((window) => window.elements)
      .filter((element) => element.accent)
      .map((element) => element.id);
    expect(accented).toEqual(["row-total"]);
    expect(scene.steps.map((step) => step.target)).not.toContain(
      "row-shipping"
    );
    const glide = scene.steps.find((step) => step._key === "a02");
    expect(glide?.durationMs).toBeLessThanOrEqual(1750);
  });

  it("writes the normalised scene and inert compiled code in one patch", async () => {
    const { result, patches } = await generate("fast", [
      generateCheckoutResponse,
    ]);

    const { scene, reactCode } = succeeded(result);
    expect(sceneWrites(patches)).toEqual([{ scene, reactCode }]);
    expect(patches.every((patch) => patch.id === DRAFT_ID)).toBe(true);
    expectInert(reactCode, scene);
  });

  it("logs one call and one progress step", async () => {
    const { result, patches, progress } = await generate("fast", [
      generateCheckoutResponse,
    ]);

    expect(progress).toEqual(["Generating… (call 1 of 1)"]);
    expect(logWrites(patches)).toEqual([
      {
        _key: "log-1",
        _type: "generationLogEntry",
        mode: "fast",
        calls: 1,
        status: "success",
        durationMs: 700,
        at: "2026-10-21T09:14:00.000Z",
      },
    ]);
    expect(result.log).toEqual(logWrites(patches)[0]);
  });

  it("renders through the primitives as one labelled image", async () => {
    const { result } = await generate("fast", [generateCheckoutResponse]);

    expectRendersAsImage(
      succeeded(result).scene,
      generateCheckoutResponse.scene.label
    );
  });
});

describe("checkout pipeline, Good", () => {
  it("writes after each call and ends on a refined scene with no errors", async () => {
    const { result, patches, progress } = await generate("good", [
      generateCheckoutResponse,
      refineCheckoutResponse,
    ]);

    const { scene, reactCode } = succeeded(result);
    expect(progress).toEqual([
      "Generating… (call 1 of 2)",
      "Generating… (call 2 of 2)",
    ]);
    expect(errorsIn(scene)).toEqual([]);
    const writes = sceneWrites(patches);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({ scene, reactCode });
    // The refine pass moved Tide back to the button and gave the cursor a start.
    const accented = scene.windows
      .flatMap((window) => window.elements)
      .filter((element) => element.accent)
      .map((element) => element.id);
    expect(accented).toEqual(["btn-apply"]);
    expect(scene.cursor?.start).toEqual({ x: 560, y: 120 });
    expectInert(reactCode, scene);
  });

  it("logs two calls", async () => {
    const { result } = await generate("good", [
      generateCheckoutResponse,
      refineCheckoutResponse,
    ]);

    expect(result.log).toEqual({
      _key: "log-1",
      _type: "generationLogEntry",
      mode: "good",
      calls: 2,
      status: "success",
      durationMs: 700,
      at: "2026-10-21T09:14:00.000Z",
    });
  });

  it("renders through the primitives as one labelled image", async () => {
    const { result } = await generate("good", [
      generateCheckoutResponse,
      refineCheckoutResponse,
    ]);

    expectRendersAsImage(
      succeeded(result).scene,
      refineCheckoutResponse.scene.label
    );
  });

  it("stops at a 429 on call 1, logging one call and the budget message", async () => {
    const { result, patches, progress } = await generate("good", [
      budgetExhaustedError(),
      refineCheckoutResponse,
    ]);

    expect(result).toMatchObject({
      status: "error",
      error: BUDGET_MESSAGE,
      budgetExhausted: true,
      calls: 1,
    });
    expect(progress).toEqual(["Generating… (call 1 of 2)"]);
    expect(sceneWrites(patches)).toEqual([]);
    expect(logWrites(patches)).toEqual([
      {
        _key: "log-1",
        _type: "generationLogEntry",
        mode: "good",
        calls: 1,
        status: "error",
        error: BUDGET_MESSAGE,
        durationMs: 700,
        at: "2026-10-21T09:14:00.000Z",
      },
    ]);
  });

  it("keeps call 1's valid scene when call 2 fails, logging two calls", async () => {
    const { result, patches } = await generate("good", [
      generateCheckoutResponse,
      schemaNotFoundError(),
    ]);

    expect(result).toMatchObject({
      status: "error",
      error:
        'Bad Request: Schema "_.schemas.default" not found in dataset "development"',
      budgetExhausted: false,
      calls: 2,
    });
    const writes = sceneWrites(patches) as { scene: SceneSpec }[];
    expect(writes).toHaveLength(1);
    expect(errorsIn(writes[0]?.scene as SceneSpec)).toEqual([]);
    expect(logWrites(patches)).toEqual([
      expect.objectContaining({ mode: "good", calls: 2, status: "error" }),
    ]);
  });
});
