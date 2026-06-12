import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  onAdded: [] as Array<(permissions: unknown) => void>,
  onRemoved: [] as Array<(permissions: unknown) => void>,
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  storeWatchers: [] as Array<(value: { granted: boolean }) => void>,
  browser: { permissions: undefined as unknown },
}));

vi.mock("webextension-polyfill", () => ({ default: mocks.browser }));

vi.mock("@/storage", () => ({
  dataCollectionStore: {
    get: mocks.storeGet,
    set: mocks.storeSet,
    watch: (cb: (value: { granted: boolean }) => void) => {
      mocks.storeWatchers.push(cb);
      return () => {};
    },
  },
}));

const permissionsApi = {
  getAll: mocks.getAll,
  onAdded: {
    addListener: (cb: (permissions: unknown) => void) => mocks.onAdded.push(cb),
  },
  onRemoved: {
    addListener: (cb: (permissions: unknown) => void) =>
      mocks.onRemoved.push(cb),
  },
};

const { isDataCollectionGranted, watchDataCollection } = await import(
  "@/shared/data-collection"
);

beforeEach(() => {
  mocks.browser.permissions = permissionsApi;
  mocks.getAll.mockReset();
  mocks.onAdded.length = 0;
  mocks.onRemoved.length = 0;
  mocks.storeGet.mockReset().mockResolvedValue({ granted: true });
  mocks.storeSet.mockReset().mockResolvedValue(undefined);
  mocks.storeWatchers.length = 0;
});

describe("isDataCollectionGranted (privileged context)", () => {
  it("treats the absence of data_collection (Chrome) as granted", async () => {
    mocks.getAll.mockResolvedValue({ permissions: ["storage"], origins: [] });

    expect(await isDataCollectionGranted()).toBe(true);
  });

  it("is granted when technicalAndInteraction is present", async () => {
    mocks.getAll.mockResolvedValue({
      data_collection: ["technicalAndInteraction"],
    });

    expect(await isDataCollectionGranted()).toBe(true);
  });

  it("is denied when data_collection is present but excludes technicalAndInteraction", async () => {
    mocks.getAll.mockResolvedValue({ data_collection: [] });

    expect(await isDataCollectionGranted()).toBe(false);
  });

  it("mirrors the resolved consent into storage for content scripts", async () => {
    mocks.getAll.mockResolvedValue({ data_collection: [] });

    await isDataCollectionGranted();

    expect(mocks.storeSet).toHaveBeenCalledWith({ granted: false });
  });

  it("falls back to granted when the permissions API throws", async () => {
    mocks.getAll.mockRejectedValue(new Error("no api"));

    expect(await isDataCollectionGranted()).toBe(true);
  });
});

describe("isDataCollectionGranted (content script)", () => {
  it("reads the mirrored consent from storage when permissions are unavailable", async () => {
    mocks.browser.permissions = undefined;
    mocks.storeGet.mockResolvedValue({ granted: false });

    expect(await isDataCollectionGranted()).toBe(false);
    expect(mocks.getAll).not.toHaveBeenCalled();
  });
});

describe("watchDataCollection (privileged context)", () => {
  it("reports granted and mirrors to storage when technicalAndInteraction is added", () => {
    const callback = vi.fn();
    watchDataCollection(callback);

    for (const listener of mocks.onAdded) {
      listener({ data_collection: ["technicalAndInteraction"] });
    }

    expect(callback).toHaveBeenCalledWith(true);
    expect(mocks.storeSet).toHaveBeenCalledWith({ granted: true });
  });

  it("reports denied and mirrors to storage when technicalAndInteraction is removed", () => {
    const callback = vi.fn();
    watchDataCollection(callback);

    for (const listener of mocks.onRemoved) {
      listener({ data_collection: ["technicalAndInteraction"] });
    }

    expect(callback).toHaveBeenCalledWith(false);
    expect(mocks.storeSet).toHaveBeenCalledWith({ granted: false });
  });

  it("ignores permission changes that do not involve data collection", () => {
    const callback = vi.fn();
    watchDataCollection(callback);

    for (const listener of mocks.onAdded) {
      listener({ permissions: ["downloads"] });
    }
    for (const listener of mocks.onRemoved) {
      listener({ origins: ["https://example.com/*"] });
    }

    expect(callback).not.toHaveBeenCalled();
  });
});

describe("watchDataCollection (content script)", () => {
  it("reacts to storage changes when permissions are unavailable", () => {
    mocks.browser.permissions = undefined;
    const callback = vi.fn();
    watchDataCollection(callback);

    for (const watcher of mocks.storeWatchers) {
      watcher({ granted: false });
    }

    expect(callback).toHaveBeenCalledWith(false);
    expect(mocks.onAdded).toHaveLength(0);
  });
});
