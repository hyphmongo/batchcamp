import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    react(),
    checker({
      typescript: true,
      enableBuild: false,
    }),
    webExtension({
      browser: process.env.TARGET || "firefox",
      additionalInputs: ["src/tab/index.html"],
    }),
    sentryVitePlugin({
      org: "batchcamp-t7u",
      project: "batchcamp",
      release: {
        name: process.env.npm_package_version,
      },
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeTracing: true,
        excludeReplayIframe: true,
        excludeReplayShadowDom: true,
        excludeReplayCanvas: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
  },
  build: {
    sourcemap: "hidden",
  },
});
