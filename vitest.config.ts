import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  alias: {
    "@": path.resolve(__dirname, "src"),
    "vitest-chrome": "vitest-chrome/lib/index.esm.js",
  },
};

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
        test: {
          name: "browser",
          globals: true,
          setupFiles: "./vitest.setup.browser.ts",
          include: ["src/**/*.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            api: { host: "127.0.0.1" },
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
