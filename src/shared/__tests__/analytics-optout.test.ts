import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";

const mocks = vi.hoisted(() => ({
  watchers: [] as Array<(value: Configuration) => void>,
  configGet: vi.fn(),
  analyticsGet: vi.fn(),
  analyticsSet: vi.fn(),
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  optOut: vi.fn(),
  optIn: vi.fn(),
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

vi.mock("posthog-js/dist/module.no-external", () => ({
  PostHog: class {
    init = mocks.init;
    register = mocks.register;
    capture = mocks.capture;
    opt_out_capturing = mocks.optOut;
    opt_in_capturing = mocks.optIn;
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: { runtime: { getManifest: () => ({ version: "2.0.0" }) } },
}));

vi.mock("@/shared/browser-info", () => ({
  browserName: "chrome",
  browserVersion: "120",
}));

const { initAnalytics } = await import("@/shared/analytics");

beforeEach(() => {
  mocks.watchers.length = 0;
  mocks.configGet.mockReset();
  mocks.analyticsGet
    .mockReset()
    .mockResolvedValue({ distinctId: "existing-id" });
  mocks.analyticsSet.mockReset().mockResolvedValue(undefined);
  mocks.init.mockReset();
  mocks.optOut.mockReset();
  mocks.optIn.mockReset();
});

describe("initAnalytics opt-out propagation", () => {
  it("stops capturing after an opt-out made while the context is running", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    await initAnalytics("background");

    for (const watcher of mocks.watchers) {
      watcher({ analyticsEnabled: false } as Configuration);
    }

    expect(mocks.optOut).toHaveBeenCalled();
  });

  it("starts capturing after an opt-in made while the context is running", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: false });
    await initAnalytics("background");

    for (const watcher of mocks.watchers) {
      watcher({ analyticsEnabled: true } as Configuration);
    }

    await vi.waitFor(() => {
      expect(mocks.optIn).toHaveBeenCalled();
    });
  });

  it("scrubs URLs from outgoing analytics events", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    await initAnalytics("background");

    const options = mocks.init.mock.calls.at(-1)?.[1] as {
      before_send: (event: unknown) => unknown;
    };
    const result = options.before_send({
      properties: { url: "https://bandcamp.com/coolfan123" },
    }) as { properties: { url: string } };

    expect(result.properties.url).toBe("https://bandcamp.com/<redacted>");
  });

  it("adopts the stored distinct id when another context wrote one concurrently", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    mocks.analyticsGet
      .mockResolvedValueOnce({ distinctId: null })
      .mockResolvedValue({ distinctId: "other-context-id" });

    await initAnalytics("background");

    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        bootstrap: { distinctID: "other-context-id" },
      }),
    );
  });
});
