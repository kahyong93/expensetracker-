import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure helpers in lib/ (money, months, calc, validation, CSV,
 * optimistic patches). No DB, no Clerk, no network. Browser tests live in e2e/ and run
 * with Playwright (`npm run test:e2e`).
 */
export default defineConfig({
  resolve: {
    // Mirrors the tsconfig "@/*" path.
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
      // `server-only` throws outside a React Server environment; lib/ai/* imports it.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./test/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
