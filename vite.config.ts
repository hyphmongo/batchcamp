import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      browser: process.env.TARGET || "firefox",
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
