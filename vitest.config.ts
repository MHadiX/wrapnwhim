import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
