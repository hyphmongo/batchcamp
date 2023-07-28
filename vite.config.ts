import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      browser: process.env.TARGET || "firefox",
      additionalInputs: ["src/tab/index.html"],
    }),
  ],
});
