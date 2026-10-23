import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const harness = fileURLToPath(new URL(".", import.meta.url));
const studio = fileURLToPath(new URL("..", import.meta.url));

/**
 * Dev-only page that renders the animation generator outside the Studio, so
 * its states can be screenshotted without a Sanity login. `sanity` resolves to
 * `sanity-mock.tsx`; nothing here is reachable from `sanity.config.ts`, so
 * `sanity build` never bundles it.
 */
export default defineConfig({
  root: harness,
  // Its own pre-bundle cache: the Studio dev server's can be stale here.
  cacheDir: `${studio}node_modules/.vite-harness`,
  plugins: [react()],
  define: {
    "process.env.SANITY_STUDIO_SCHEMA_ID": JSON.stringify(""),
  },
  resolve: {
    alias: [
      { find: /^sanity$/, replacement: `${harness}sanity-mock.tsx` },
      { find: /^@\/(.*)$/, replacement: `${studio}$1` },
    ],
  },
  // No file watching: the harness is for screenshots, and large checkouts
  // run out of inotify watchers. Reload the page after an edit.
  server: { port: 3334, strictPort: true, watch: null },
});
