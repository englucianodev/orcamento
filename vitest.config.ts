import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integracao/**/*.test.ts"],
    hookTimeout: 120_000,
    testTimeout: 30_000,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/engine/**/*.ts"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
