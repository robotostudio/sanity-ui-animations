import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}$1` }],
  },
  test: {
    environment: "jsdom",
    env: {
      // styled-components (under @sanity/ui) defaults to its non-"speedy"
      // text-node sheet outside production: every new rule is appended to
      // one <style> element, and jsdom re-parses that whole sheet on each
      // append. The first render of the workspace injects hundreds of
      // rules, so it spent seconds in jsdom's CSS parser and the first test
      // in a file could pass the 5s timeout on CI. Speedy mode inserts each
      // rule with insertRule(), which jsdom parses once.
      SC_DISABLE_SPEEDY: "false",
    },
    include: ["components/**/*.test.{ts,tsx}"],
  },
});
