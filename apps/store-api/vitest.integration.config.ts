import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["src/__tests__/integration/**/*.test.ts"],
    environment: "node",
    globals: false,
    setupFiles: ["src/__tests__/setup.ts"],
    fileParallelism: false,
    root: resolve(__dirname),
    // Integration tests talk to a live stack, give them more time
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
