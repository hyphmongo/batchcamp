import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";

const mocks = vi.hoisted(() => ({
  watchers: [] as Array<(value: Configuration) => void>,
  dataWatchers: [] as Array<(granted: boolean) => void>,
  configGet: vi.fn(),
  dataGranted: vi.fn(),
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

vi.mock("@/shared/data-collection", () => ({
  isDataCollectionGranted: mocks.dataGranted,
  watchDataCollection: (callback: (granted: boolean) => void) => {
    mocks.dataWatchers.push(callback);
  },
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

const { initAnalytics, setAnalyticsEnabled } = await import(
  "@/shared/analytics"
);

beforeEach(() => {
  mocks.watchers.length = 0;
  mocks.dataWatchers.length = 0;
  mocks.configGet.mockReset();
  mocks.dataGranted.mockReset().mockResolvedValue(true);
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

  it("ignores config changes that leave analytics enabled unchanged", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    await initAnalytics("background");

    for (const watcher of mocks.watchers) {
      watcher({ analyticsEnabled: true, format: "flac" } as Configuration);
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.optIn).not.toHaveBeenCalled();
    expect(mocks.optOut).not.toHaveBeenCalled();
  });

  it("opts in without emitting a synthetic opt-in event", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: false });
    await initAnalytics("background");

    for (const watcher of mocks.watchers) {
      watcher({ analyticsEnabled: true } as Configuration);
    }

    await vi.waitFor(() => {
      expect(mocks.optIn).toHaveBeenCalledWith({ captureEventName: false });
    });
  });

  it("never creates person profiles", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    await initAnalytics("background");

    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ person_profiles: "never" }),
    );
  });

  it("emits the provided opt-in event when analytics is enabled", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: false });
    await initAnalytics("background");

    setAnalyticsEnabled(true, {
      name: "setting_changed",
      properties: { setting: "analyticsEnabled", value: true },
    });

    await vi.waitFor(() => {
      expect(mocks.optIn).toHaveBeenCalledWith({
        captureEventName: "setting_changed",
        captureProperties: { setting: "analyticsEnabled", value: true },
      });
    });
  });

  it("does not start capturing when Firefox data collection is denied", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    mocks.dataGranted.mockResolvedValue(false);

    await initAnalytics("background");

    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("stops capturing when the Firefox data-collection permission is revoked at runtime", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    await initAnalytics("background");

    for (const watcher of mocks.dataWatchers) {
      watcher(false);
    }

    expect(mocks.optOut).toHaveBeenCalled();
  });

  it("resumes capturing when the Firefox data-collection permission is granted at runtime", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: true });
    mocks.dataGranted.mockResolvedValue(false);
    await initAnalytics("background");

    for (const watcher of mocks.dataWatchers) {
      watcher(true);
    }

    await vi.waitFor(() => {
      expect(mocks.optIn).toHaveBeenCalled();
    });
  });

  it("stays opted out when data collection is granted but in-app analytics is off", async () => {
    mocks.configGet.mockResolvedValue({ analyticsEnabled: false });
    await initAnalytics("background");

    for (const watcher of mocks.dataWatchers) {
      watcher(true);
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.optIn).not.toHaveBeenCalled();
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
