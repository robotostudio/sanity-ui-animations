import ts from "typescript";
import { describe, expect, it } from "vitest";

import { compileSceneToReact } from "./compile";
import { checkoutScene } from "./fixtures/checkout";
import type { SceneSpec } from "./scene-spec";
import { DEFAULT_TOKENS } from "./tokens";

const INJECTIONS = [
  '"});alert(1)//',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: an injection payload
  "`${alert(1)}`",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: an injection payload
  "${globalThis.pwned = 1}",
  "</script><script>alert(1)</script>",
  "'; alert(1); '",
  '\\"; alert(1); //',
  "line\u2028break\u2029here",
  "{alert(1)}",
];

function parse(code: string) {
  return ts.createSourceFile(
    "scene.tsx",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function syntaxErrors(code: string): string[] {
  const out = ts.transpileModule(code, {
    fileName: "scene.tsx",
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  });
  return (out.diagnostics ?? []).map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, "\n")
  );
}

/** Every string literal value in the program, decoded. */
function stringLiterals(code: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node)) {
      found.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(code));
  return found;
}

/** Every identifier the program names, e.g. to catch a smuggled `alert`. */
function identifiers(code: string): Set<string> {
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      found.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(code));
  return found;
}

function withLabels(label: string): SceneSpec {
  const [cart, payments] = checkoutScene.windows;
  if (!(cart && payments)) {
    throw new Error("checkout fixture changed shape");
  }
  return {
    ...checkoutScene,
    label,
    windows: [
      {
        ...cart,
        title: label,
        id: label,
        elements: cart.elements.map((element) => ({
          ...element,
          label,
          value: label,
          badge: element.badge && { ...element.badge, label },
        })),
      },
      payments,
    ],
    steps: checkoutScene.steps.map((step) =>
      step.action === "update" ? { ...step, value: label } : step
    ),
  };
}

describe("compileSceneToReact", () => {
  it.each(INJECTIONS)("keeps %j an inert string literal", (payload) => {
    const code = compileSceneToReact(withLabels(payload));

    expect(syntaxErrors(code)).toEqual([]);
    expect(stringLiterals(code)).toContain(payload);
    expect(identifiers(code).has("alert")).toBe(false);
    expect(identifiers(code).has("pwned")).toBe(false);
    expect(code).not.toContain("</script");
    expect(code).not.toContain("${");
    expect(code).not.toContain("\u2028");
  });

  it("leaves data that looks like a template placeholder alone", () => {
    const code = compileSceneToReact(withLabels("__THEME__ __SCENE__"));

    expect(syntaxErrors(code)).toEqual([]);
    expect(stringLiterals(code)).toContain("__THEME__ __SCENE__");
    expect(code).toMatch(/const THEME = \{/);
  });

  it("escapes design-token strings too, since they come from the dataset", () => {
    const payload = '"});alert(1)//</script>';
    const code = compileSceneToReact(checkoutScene, {
      ...DEFAULT_TOKENS,
      badges: {
        ...DEFAULT_TOKENS.badges,
        colors: { ...DEFAULT_TOKENS.badges.colors, success: payload },
      },
    });

    expect(syntaxErrors(code)).toEqual([]);
    expect(stringLiterals(code)).toContain(payload);
    expect(identifiers(code).has("alert")).toBe(false);
  });

  it("drops values that are not strings instead of emitting them", () => {
    const scene = {
      ...checkoutScene,
      label: { toString: "alert(1)" },
    } as unknown as SceneSpec;
    const code = compileSceneToReact(scene);

    expect(syntaxErrors(code)).toEqual([]);
    expect(code).not.toContain("alert");
  });

  it("emits no dynamic code paths", () => {
    const code = compileSceneToReact(checkoutScene);

    expect(code).not.toMatch(/\beval\b|new Function|import\(/);
    expect(code).not.toContain("dangerouslySetInnerHTML");
  });

  it("keeps prices readable", () => {
    const code = compileSceneToReact(checkoutScene);

    expect(code).toContain('"label": "Wireless headphones"');
    expect(code).toContain('"value": "$120"');
  });

  it("is deterministic, whatever order the spec's keys arrive in", () => {
    const shuffled = Object.fromEntries(
      Object.entries(checkoutScene).reverse()
    ) as SceneSpec;

    expect(compileSceneToReact(shuffled)).toBe(
      compileSceneToReact(checkoutScene)
    );
  });

  it("compiles the checkout scene to the reviewed component", async () => {
    await expect(compileSceneToReact(checkoutScene)).toMatchFileSnapshot(
      "./__snapshots__/checkout-scene.tsx.snap"
    );
  });
});
