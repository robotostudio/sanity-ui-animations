/**
 * The optional live preview of `reactCode`. The compiled code only ever runs
 * inside `<iframe sandbox="allow-scripts" srcdoc>` without
 * `allow-same-origin`: an opaque origin with no cookies, storage, Studio
 * token or parent DOM. See docs/spec.md, "Safety".
 */

/** Exactly the sandbox tokens the frame gets. Never add `allow-same-origin`. */
export const CODE_PREVIEW_SANDBOX = "allow-scripts";

const BABEL_URL = "https://unpkg.com/@babel/standalone@7.28.4/babel.min.js";

const IMPORT_MAP = {
  imports: {
    react: "https://esm.sh/react@19.2.0",
    "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
    "react-dom/client":
      "https://esm.sh/react-dom@19.2.0/client?deps=react@19.2.0",
  },
};

/**
 * A string literal safe to place inside a `<script>`: JSON quoting, plus
 * every `<` escaped so the code cannot close the element or open a comment.
 */
const scriptLiteral = (value: string) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");

/**
 * The frame's whole document. Babel compiles the TSX inside the frame and
 * the result runs there as a module, so nothing compiles or runs in the
 * Studio itself.
 */
export function codePreviewDocument(reactCode: string): string {
  const component = /export default function (\w+)/.exec(reactCode)?.[1];
  const mount = component
    ? `\nimport { createRoot as __createRoot } from "react-dom/client";\n__createRoot(document.getElementById("root")).render(<${component} />);\n`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>html,body{margin:0}pre{margin:0;padding:12px;font:12px/1.5 ui-monospace,monospace;color:#b3261e;white-space:pre-wrap}</style>
<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
<script src="${BABEL_URL}"></script>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  function show(message) {
    var pre = document.createElement("pre");
    pre.textContent = String(message);
    document.body.replaceChildren(pre);
  }
  window.addEventListener("error", function (event) { show(event.message); });
  var source = ${scriptLiteral(reactCode)};
  var mount = ${JSON.stringify(mount)};
  if (!mount) { show("This code has no default export to preview."); return; }
  try {
    var compiled = Babel.transform(source + mount, {
      filename: "scene-animation.tsx",
      presets: [
        ["typescript", { isTSX: true, allExtensions: true }],
        ["react", { runtime: "automatic" }]
      ]
    }).code;
    var script = document.createElement("script");
    script.type = "module";
    script.textContent = compiled;
    document.body.appendChild(script);
  } catch (error) {
    show(error && error.message ? error.message : error);
  }
})();
</script>
</body>
</html>`;
}

export function CodePreview({ reactCode }: { reactCode: string }) {
  return (
    <iframe
      sandbox={CODE_PREVIEW_SANDBOX}
      srcDoc={codePreviewDocument(reactCode)}
      style={{
        display: "block",
        width: "100%",
        aspectRatio: "1 / 1",
        border: 0,
      }}
      title="Compiled React code preview"
    />
  );
}
