import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Unit tests only (no live infra needed)
    include: ["src/__tests__/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
    setupFiles: ["src/__tests__/setup.ts"],
    root: resolve(__dirname),
  },
});
