import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";

import { createFilenameRouter } from "@/background/filename-router";

describe("createFilenameRouter", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes a registered URL to its custom filename with uniquify conflict action", () => {
    const router = createFilenameRouter();
    const suggest = vi.fn();

    router.register("https://example.com/file.zip", "Custom Name.zip");
    router.route(
      { url: "https://example.com/file.zip", filename: "server.zip" },
      suggest,
    );

    expect(suggest).toHaveBeenCalledWith({
      filename: "Custom Name.zip",
      conflictAction: "uniquify",
    });
  });

  it("stays silent for a download batchcamp did not start", () => {
    const router = createFilenameRouter();
    const suggest = vi.fn();

    const handled = router.route(
      {
        url: "https://example.com/unknown.zip",
        filename: "server-derived.zip",
      },
      suggest,
    );

    expect(handled).toBe(false);
    expect(suggest).not.toHaveBeenCalled();
  });

  it("consumes the registration after a single use", () => {
    const router = createFilenameRouter();
    const suggest = vi.fn();

    router.register("https://example.com/file.zip", "Custom.zip");
    router.route(
      { url: "https://example.com/file.zip", filename: "server.zip" },
      suggest,
    );
    router.route(
      { url: "https://example.com/file.zip", filename: "server.zip" },
      suggest,
    );

    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith({
      filename: "Custom.zip",
      conflictAction: "uniquify",
    });
  });

  it("keeps registrations for different URLs independent", () => {
    const router = createFilenameRouter();
    const suggest = vi.fn();

    router.register("https://a.example/", "A.zip");
    router.register("https://b.example/", "B.zip");

    router.route(
      { url: "https://a.example/", filename: "fallback-a" },
      suggest,
    );
    router.route(
      { url: "https://b.example/", filename: "fallback-b" },
      suggest,
    );

    expect(suggest).toHaveBeenNthCalledWith(1, {
      filename: "A.zip",
      conflictAction: "uniquify",
    });
    expect(suggest).toHaveBeenNthCalledWith(2, {
      filename: "B.zip",
      conflictAction: "uniquify",
    });
  });

  it("size reflects the number of pending registrations", () => {
    const router = createFilenameRouter();

    expect(router.size()).toBe(0);

    router.register("https://a.example/", "A");
    router.register("https://b.example/", "B");
    expect(router.size()).toBe(2);

    router.route({ url: "https://a.example/", filename: "x" }, vi.fn());
    expect(router.size()).toBe(1);
  });

  it("unregister drops a pending registration that never routed", () => {
    const router = createFilenameRouter();

    router.register("https://a.example/", "A");
    expect(router.size()).toBe(1);

    router.unregister("https://a.example/");
    expect(router.size()).toBe(0);
  });

  it("caps the number of pending registrations, evicting the oldest", () => {
    const router = createFilenameRouter(2);

    router.register("https://a.example/", "A");
    router.register("https://b.example/", "B");
    router.register("https://c.example/", "C");

    expect(router.size()).toBe(2);

    const suggest = vi.fn();
    router.route(
      { url: "https://a.example/", filename: "fallback-a" },
      suggest,
    );

    expect(suggest).not.toHaveBeenCalled();
  });
});

describe("createFilenameRouter session persistence", () => {
  const polyfillStorage = browser.storage as {
    session?: { get: unknown; set: unknown };
  };

  const stubSession = (stored: Record<string, string> = {}) => {
    const set = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ pendingFilenames: stored });
    polyfillStorage.session = { get, set };
    return { get, set };
  };

  afterEach(() => {
    polyfillStorage.session = undefined;
    vi.unstubAllGlobals();
  });

  it("mirrors registrations to session storage", async () => {
    const { set } = stubSession();
    const router = createFilenameRouter();

    router.register("https://a.example/", "A.zip");

    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        pendingFilenames: { "https://a.example/": "A.zip" },
      });
    });
  });

  it("serves a registration made before a service-worker restart", async () => {
    stubSession({ "https://a.example/": "Survived.zip" });
    const router = createFilenameRouter();
    const suggest = vi.fn();

    const handled = router.route(
      { url: "https://a.example/", filename: "server.zip" },
      suggest,
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(suggest).toHaveBeenCalledWith({
        filename: "Survived.zip",
        conflictAction: "uniquify",
      });
    });
  });

  it("survives Firefox's callback-style chrome.storage.session", () => {
    vi.stubGlobal("chrome", {
      storage: {
        session: { get: vi.fn(), set: vi.fn() },
      },
    });

    expect(() => createFilenameRouter()).not.toThrow();
  });

  it("releases an async hold with a bare suggest when the url is unknown", async () => {
    stubSession();
    const router = createFilenameRouter();
    const suggest = vi.fn();

    const handled = router.route(
      { url: "https://unknown.example/", filename: "server.zip" },
      suggest,
    );

    expect(handled).toBe(true);
    await vi.waitFor(() => {
      expect(suggest).toHaveBeenCalledWith();
    });
  });
});
