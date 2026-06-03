import { beforeEach, describe, expect, it, vi } from "vitest";

const { tabsQuery, tabsCreate, tabsUpdate, getURL, storeSet } = vi.hoisted(
  () => ({
    tabsQuery: vi.fn(),
    tabsCreate: vi.fn(),
    tabsUpdate: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    storeSet: vi.fn(),
  }),
);

vi.mock("webextension-polyfill", () => ({
  default: {
    tabs: { query: tabsQuery, create: tabsCreate, update: tabsUpdate },
    windows: { WINDOW_ID_CURRENT: -2 },
    runtime: { getURL },
  },
}));

vi.mock("@/storage", () => ({
  backgroundStore: { set: storeSet },
}));

import { createManagedTab } from "@/background/tab-manager";

beforeEach(() => {
  tabsQuery.mockReset().mockResolvedValue([{ index: 0 }]);
  tabsCreate.mockReset().mockResolvedValue({ id: 1 });
  tabsUpdate.mockReset().mockResolvedValue(undefined);
  storeSet.mockReset().mockResolvedValue(undefined);
});

describe("createManagedTab", () => {
  it("opens the resolved URL just after the active tab and returns the new id", async () => {
    tabsQuery.mockResolvedValue([{ index: 2 }]);
    tabsCreate.mockResolvedValue({ id: 42, autoDiscardable: true });

    const id = await createManagedTab("./src/tab/index.html");

    expect(id).toBe(42);
    expect(getURL).toHaveBeenCalledWith("./src/tab/index.html");
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "chrome-extension://test/./src/tab/index.html",
        index: 3,
      }),
    );
    expect(storeSet).toHaveBeenCalledWith({ tabId: 42 });
  });

  it("copies the active tab's cookieStoreId (Firefox containers)", async () => {
    tabsQuery.mockResolvedValue([{ index: 0, cookieStoreId: "firefox-c1" }]);
    tabsCreate.mockResolvedValue({ id: 7 });

    await createManagedTab("./x");

    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ cookieStoreId: "firefox-c1" }),
    );
  });

  it("disables autoDiscardable when the platform exposes it", async () => {
    tabsCreate.mockResolvedValue({ id: 7, autoDiscardable: true });

    await createManagedTab("./x");

    expect(tabsUpdate).toHaveBeenCalledWith(7, { autoDiscardable: false });
  });

  it("skips autoDiscardable when unsupported (Firefox)", async () => {
    tabsCreate.mockResolvedValue({ id: 7 });

    await createManagedTab("./x");

    expect(tabsUpdate).not.toHaveBeenCalled();
  });

  it("throws when the created tab has no id", async () => {
    tabsCreate.mockResolvedValue({ id: undefined });

    await expect(createManagedTab("./x")).rejects.toThrow(
      "Created tab has no ID",
    );
  });
});
