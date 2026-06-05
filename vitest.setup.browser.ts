import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { createFakeStorageArea } from "./vitest.fake-storage";

configure({ reactStrictMode: true });

const { area: fakeArea, reset: resetStorage } = createFakeStorageArea();

(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: "test-extension",
    getManifest: () => ({ manifest_version: 3 }),
    sendMessage: () => Promise.resolve(),
    onMessage: { addListener: () => {}, removeListener: () => {} },
    onInstalled: { addListener: () => {}, removeListener: () => {} },
  },
  storage: {
    local: fakeArea,
    sync: fakeArea,
    managed: fakeArea,
    session: fakeArea,
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
  downloads: {
    download: () => Promise.resolve(0),
    search: () => Promise.resolve([]),
    pause: () => Promise.resolve(),
    resume: () => Promise.resolve(),
    cancel: () => Promise.resolve(),
    show: () => Promise.resolve(true),
    removeFile: () => Promise.resolve(),
    erase: () => Promise.resolve([]),
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
};

void vi;

afterEach(() => {
  cleanup();
  resetStorage();
});
