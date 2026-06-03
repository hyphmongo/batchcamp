import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "vitest-chrome": "vitest-chrome/lib/index.esm.js",
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: "./vitest.setup.ts",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.test.tsx", "node_modules/**"],
  },
});
