import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Item } from "@/types";

const mocks = vi.hoisted(() => ({
  onMessageListener: {
    current: null as ((message: unknown, sender: unknown) => unknown) | null,
  },
  tabsGet: vi.fn(),
  tabsSendMessage: vi.fn(),
  tabsUpdate: vi.fn(),
  tabsReload: vi.fn(),
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  createManagedTab: vi.fn(),
  captureError: vi.fn(),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    tabs: {
      onRemoved: { addListener: vi.fn() },
      get: mocks.tabsGet,
      sendMessage: mocks.tabsSendMessage,
      update: mocks.tabsUpdate,
      reload: mocks.tabsReload,
    },
    runtime: {
      onMessage: {
        addListener: (
          listener: (message: unknown, sender: unknown) => unknown,
        ) => {
          mocks.onMessageListener.current = listener;
        },
      },
    },
    action: { onClicked: { addListener: vi.fn() } },
  },
}));

vi.mock("@/storage", () => ({
  backgroundStore: { get: mocks.storeGet, set: mocks.storeSet },
}));

vi.mock("@/shared/sentry", () => ({ initSentry: vi.fn() }));
vi.mock("@/shared/analytics", () => ({
  initAnalytics: vi.fn(),
  track: vi.fn(),
}));
vi.mock("@/shared/error-handler", () => ({ captureError: mocks.captureError }));
vi.mock("@/background/tab-manager", () => ({
  createManagedTab: mocks.createManagedTab,
}));

const setUiOptions = vi.fn();
(globalThis as { chrome?: unknown }).chrome = {
  downloads: { setUiOptions },
};

await import("@/background/index");

const dispatch = (message: unknown, sender: unknown = {}) =>
  mocks.onMessageListener.current?.(message, sender);

const makeItem = (id: string): Item => ({
  id,
  title: `Item ${id}`,
  status: "pending",
  url: `https://bandcamp.com/track/${id}`,
  format: "mp3-320",
});

beforeEach(() => {
  mocks.storeGet.mockReset().mockResolvedValue({ tabId: null, items: [] });
  mocks.storeSet.mockReset().mockResolvedValue(undefined);
  mocks.tabsGet.mockReset().mockRejectedValue(new Error("no tab"));
  mocks.tabsSendMessage.mockReset().mockResolvedValue(undefined);
  mocks.tabsUpdate.mockReset().mockResolvedValue(undefined);
  mocks.tabsReload.mockReset().mockResolvedValue(undefined);
  mocks.createManagedTab.mockReset().mockResolvedValue(undefined);
  mocks.captureError.mockReset();
  setUiOptions.mockReset().mockResolvedValue(undefined);
});

describe("background item delivery", () => {
  it("keeps stored items after sending them to an existing tab", async () => {
    const item = makeItem("a");
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7 });

    await dispatch({ type: "send-items-to-background", items: [item] });

    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(7, {
      type: "send-items-to-tab",
      items: [item],
    });
    expect(mocks.storeSet).not.toHaveBeenCalledWith({ items: [] });
  });

  it("keeps stored items after answering tab-opened", async () => {
    const item = makeItem("a");
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [item] });

    await dispatch({ type: "tab-opened" });

    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(7, {
      type: "send-items-to-tab",
      items: [item],
    });
    expect(mocks.storeSet).not.toHaveBeenCalledWith({ items: [] });
  });

  it("adopts the sender tab when tab-opened arrives with no stored tabId", async () => {
    const item = makeItem("a");
    mocks.storeGet.mockResolvedValue({ tabId: null, items: [item] });

    await dispatch({ type: "tab-opened" }, { tab: { id: 9 } });

    expect(mocks.storeSet).toHaveBeenCalledWith({ tabId: 9 });
    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(9, {
      type: "send-items-to-tab",
      items: [item],
    });
  });

  it("clears stored items when the tab acknowledges delivery", async () => {
    await dispatch({ type: "items-delivered" });

    expect(mocks.storeSet).toHaveBeenCalledWith({ items: [] });
  });

  it("merges a new batch with undelivered items instead of overwriting", async () => {
    const undelivered = makeItem("a");
    const incoming = makeItem("b");
    mocks.storeGet.mockResolvedValue({ tabId: null, items: [undelivered] });

    await dispatch({ type: "send-items-to-background", items: [incoming] });

    expect(mocks.storeSet).toHaveBeenCalledWith({
      items: [undelivered, incoming],
    });
    expect(mocks.createManagedTab).toHaveBeenCalled();
  });

  it("re-enables the download shelf when opening the managed tab fails", async () => {
    mocks.createManagedTab.mockRejectedValue(new Error("tab create failed"));

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(setUiOptions).toHaveBeenCalledWith({ enabled: false });
    expect(setUiOptions).toHaveBeenLastCalledWith({ enabled: true });
  });

  it("keeps the shelf hidden when delivery to the managed tab succeeds", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7 });

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(setUiOptions).toHaveBeenLastCalledWith({ enabled: false });
  });

  it("survives the shelf API rejecting (another extension owns it)", async () => {
    setUiOptions.mockRejectedValue(new Error("shelf owned elsewhere"));
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7 });

    await expect(
      dispatch({ type: "send-items-to-background", items: [makeItem("a")] }),
    ).resolves.toBeUndefined();
  });

  it("wakes a discarded managed tab and refocuses it instead of dropping the tabId", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7, discarded: true });
    mocks.tabsSendMessage.mockRejectedValue(
      new Error(
        "Could not establish connection. Receiving end does not exist.",
      ),
    );

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.tabsReload).toHaveBeenCalledWith(7);
    expect(mocks.tabsUpdate).toHaveBeenCalledWith(7, { active: true });
    expect(mocks.storeSet).not.toHaveBeenCalledWith({ tabId: null });
    expect(mocks.createManagedTab).not.toHaveBeenCalled();
    expect(mocks.captureError).not.toHaveBeenCalled();
  });

  it("refocuses a still-loading managed tab without reloading it", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7, discarded: false });
    mocks.tabsSendMessage.mockRejectedValue(
      new Error(
        "Could not establish connection. Receiving end does not exist.",
      ),
    );

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.tabsReload).not.toHaveBeenCalled();
    expect(mocks.tabsUpdate).toHaveBeenCalledWith(7, { active: true });
    expect(mocks.createManagedTab).not.toHaveBeenCalled();
    expect(mocks.captureError).not.toHaveBeenCalled();
  });

  it("opens a fresh tab when the managed tab vanished mid-delivery", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet
      .mockResolvedValueOnce({ id: 7 })
      .mockRejectedValue(new Error("no tab"));
    mocks.tabsSendMessage.mockRejectedValue(
      new Error(
        "Could not establish connection. Receiving end does not exist.",
      ),
    );

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.storeSet).toHaveBeenCalledWith({ tabId: null });
    expect(mocks.createManagedTab).toHaveBeenCalledWith("./src/tab/index.html");
  });

  it("does not duplicate an undelivered item resent in a new batch", async () => {
    const undelivered = makeItem("a");
    mocks.storeGet.mockResolvedValue({ tabId: null, items: [undelivered] });

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a"), makeItem("b")],
    });

    expect(mocks.storeSet).toHaveBeenCalledWith({
      items: [undelivered, makeItem("b")],
    });
  });
});
