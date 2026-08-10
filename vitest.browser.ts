import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";

export const sharedResolve = {
  alias: {
    "@": path.resolve(__dirname, "src"),
    "vitest-chrome": "vitest-chrome/lib/index.esm.js",
  },
};

export const browserPlugins = [tailwindcss()];

export const browserTest = {
  globals: true,
  setupFiles: "./vitest.setup.browser.ts",
  include: ["src/**/*.test.tsx"],
  browser: {
    enabled: true,
    provider: playwright(),
    headless: true,
    api: { host: "127.0.0.1" },
    instances: [{ browser: "chromium" as const }],
  },
};
