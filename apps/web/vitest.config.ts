import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: `${path.resolve(__dirname, "src")}/$1`,
      },
    ],
  },
  test: {
    environment: "node",
    // Playwright owns tests/e2e (*.spec.ts); Vitest only sees unit tests.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
