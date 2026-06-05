import type { ErrorEvent } from "@sentry/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";

const mocks = vi.hoisted(() => ({
  watchers: [] as Array<(value: Configuration) => void>,
  configGet: vi.fn(),
  initOptions: {
    current: null as null | {
      beforeSend?: (event: ErrorEvent) => ErrorEvent | null;
    },
  },
}));

vi.mock("@/storage", () => ({
  configurationStore: {
    get: mocks.configGet,
    watch: (callback: (value: Configuration) => void) => {
      mocks.watchers.push(callback);
      return () => {};
    },
  },
}));

vi.mock("@sentry/browser", () => ({
  init: (options: never) => {
    mocks.initOptions.current = options;
  },
  setTag: vi.fn(),
  getDefaultIntegrations: () => [],
  BrowserClient: class {
    init() {}
  },
  Scope: class {
    setClient() {}
    setTag() {}
  },
  defaultStackParser: {},
  makeFetchTransport: {},
}));

vi.mock("webextension-polyfill", () => ({
  default: { runtime: { getManifest: () => ({ version: "2.0.0" }) } },
}));

vi.mock("@/shared/browser-info", () => ({
  browserName: "chrome",
  browserVersion: "120",
}));

const { initSentry } = await import("@/shared/sentry");

beforeEach(() => {
  mocks.watchers.length = 0;
  mocks.initOptions.current = null;
  mocks.configGet.mockReset();
});

describe("initSentry opt-out propagation", () => {
  it("drops crash reports after an opt-out made while the context is running", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    await initSentry("background");

    const beforeSend = mocks.initOptions.current?.beforeSend;
    expect(beforeSend?.({} as ErrorEvent)).toBeTruthy();

    for (const watcher of mocks.watchers) {
      watcher({ crashReportsEnabled: false } as Configuration);
    }

    expect(beforeSend?.({} as ErrorEvent)).toBeNull();
  });

  it("resumes crash reports after an opt-in made while the context is running", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: false });
    await initSentry("background");

    const beforeSend = mocks.initOptions.current?.beforeSend;
    expect(beforeSend?.({} as ErrorEvent)).toBeNull();

    for (const watcher of mocks.watchers) {
      watcher({ crashReportsEnabled: true } as Configuration);
    }

    expect(beforeSend?.({} as ErrorEvent)).toBeTruthy();
  });
});
