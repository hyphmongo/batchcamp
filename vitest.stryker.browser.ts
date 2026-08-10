import { defineConfig } from "vitest/config";
import { browserPlugins, browserTest, sharedResolve } from "./vitest.browser";

export default defineConfig({
  resolve: sharedResolve,
  plugins: browserPlugins,
  test: browserTest,
});
