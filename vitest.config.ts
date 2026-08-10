import { defineConfig } from "vitest/config";
import { browserPlugins, browserTest, sharedResolve } from "./vitest.browser";

export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "node",
          globals: true,
          environment: "node",
          setupFiles: "./vitest.setup.ts",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.test.tsx", "node_modules/**"],
        },
      },
      {
        resolve: sharedResolve,
        plugins: browserPlugins,
        test: {
          name: "browser",
          ...browserTest,
        },
      },
    ],
  },
});
