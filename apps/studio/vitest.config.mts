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
    include: ["components/**/*.test.{ts,tsx}"],
  },
});
