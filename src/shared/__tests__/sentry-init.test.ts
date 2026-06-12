import type { ErrorEvent } from "@sentry/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";

const mocks = vi.hoisted(() => ({
  watchers: [] as Array<(value: Configuration) => void>,
  dataWatchers: [] as Array<(granted: boolean) => void>,
  configGet: vi.fn(),
  dataGranted: vi.fn(),
  analyticsGet: vi.fn(),
  analyticsSet: vi.fn(),
  setUser: vi.fn(),
  scopeSetUser: vi.fn(),
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
  analyticsStore: { get: mocks.analyticsGet, set: mocks.analyticsSet },
}));

vi.mock("@/shared/data-collection", () => ({
  isDataCollectionGranted: mocks.dataGranted,
  watchDataCollection: (callback: (granted: boolean) => void) => {
    mocks.dataWatchers.push(callback);
  },
}));

vi.mock("@sentry/browser", () => ({
  init: (options: never) => {
    mocks.initOptions.current = options;
  },
  setTag: vi.fn(),
  setUser: mocks.setUser,
  getDefaultIntegrations: () => [],
  BrowserClient: class {
    init() {}
  },
  Scope: class {
    setClient() {}
    setTag() {}
    setUser = mocks.scopeSetUser;
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
  mocks.dataWatchers.length = 0;
  mocks.initOptions.current = null;
  mocks.configGet.mockReset();
  mocks.dataGranted.mockReset().mockResolvedValue(true);
  mocks.analyticsGet
    .mockReset()
    .mockResolvedValue({ distinctId: "install-id" });
  mocks.analyticsSet.mockReset().mockResolvedValue(undefined);
  mocks.setUser.mockReset();
  mocks.scopeSetUser.mockReset();
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

  it("drops crash reports when Firefox data collection is denied at init", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    mocks.dataGranted.mockResolvedValue(false);
    await initSentry("background");

    const beforeSend = mocks.initOptions.current?.beforeSend;
    expect(beforeSend?.({} as ErrorEvent)).toBeNull();
  });

  it("drops crash reports when the Firefox data-collection permission is revoked at runtime", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    await initSentry("background");

    const beforeSend = mocks.initOptions.current?.beforeSend;
    expect(beforeSend?.({} as ErrorEvent)).toBeTruthy();

    for (const watcher of mocks.dataWatchers) {
      watcher(false);
    }

    expect(beforeSend?.({} as ErrorEvent)).toBeNull();
  });

  it("resumes crash reports when the Firefox data-collection permission is granted at runtime", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    mocks.dataGranted.mockResolvedValue(false);
    await initSentry("background");

    const beforeSend = mocks.initOptions.current?.beforeSend;
    expect(beforeSend?.({} as ErrorEvent)).toBeNull();

    for (const watcher of mocks.dataWatchers) {
      watcher(true);
    }

    expect(beforeSend?.({} as ErrorEvent)).toBeTruthy();
  });
});

describe("initSentry anonymous install id", () => {
  it("tags isolated-context events with the stored install id", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    mocks.analyticsGet.mockResolvedValue({ distinctId: "install-123" });

    await initSentry("background");

    expect(mocks.setUser).toHaveBeenCalledWith({ id: "install-123" });
  });

  it("tags content-context events with the stored install id", async () => {
    mocks.configGet.mockResolvedValue({ crashReportsEnabled: true });
    mocks.analyticsGet.mockResolvedValue({ distinctId: "install-123" });

    await initSentry("content");

    expect(mocks.scopeSetUser).toHaveBeenCalledWith({ id: "install-123" });
  });

  it("attaches the install id regardless of the analytics opt-out", async () => {
    mocks.configGet.mockResolvedValue({
      crashReportsEnabled: true,
      analyticsEnabled: false,
    });
    mocks.analyticsGet.mockResolvedValue({ distinctId: "install-123" });

    await initSentry("background");

    expect(mocks.setUser).toHaveBeenCalledWith({ id: "install-123" });
  });
});
