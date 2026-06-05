import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import * as chrome from "vitest-chrome";

import { createFakeStorageArea } from "./vitest.fake-storage";

Object.assign(global, chrome);

const { area: storageArea, reset: resetStorage } = createFakeStorageArea();
const globalChrome = (globalThis as unknown as { chrome: Record<string, any> })
  .chrome;
globalChrome.runtime = { ...globalChrome.runtime, id: "test-extension" };
globalChrome.storage = {
  local: storageArea,
  sync: storageArea,
  managed: storageArea,
  session: storageArea,
  onChanged: { addListener: () => {}, removeListener: () => {} },
};

afterEach(() => {
  cleanup();
  resetStorage();
});

vi.mock("webextension-polyfill", () => ({
  default: {
    downloads: {
      download: vi.fn(),
      search: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
    tabs: {
      create: vi.fn(),
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
}));
