import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      browser: process.env.TARGET || "chrome",
      additionalInputs: ["src/tab/index.html"],
    }),
    sentryVitePlugin({
      org: "batchcamp-t7u",
      project: "javascript",
    }),
  ],
  build: {
    sourcemap: true,
  },
});
