import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Item } from "@/types";

const mocks = vi.hoisted(() => ({
  onMessageListener: {
    current: null as ((message: unknown, sender: unknown) => unknown) | null,
  },
  onRemovedListener: {
    current: null as ((tabId: number) => unknown) | null,
  },
  onClickedListener: {
    current: null as (() => unknown) | null,
  },
  tabsGet: vi.fn(),
  tabsSendMessage: vi.fn(),
  tabsUpdate: vi.fn(),
  tabsReload: vi.fn(),
  windowsUpdate: vi.fn(),
  storeGet: vi.fn(),
  storeSet: vi.fn(),
  createManagedTab: vi.fn(),
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    tabs: {
      onRemoved: {
        addListener: (listener: (tabId: number) => unknown) => {
          mocks.onRemovedListener.current = listener;
        },
      },
      get: mocks.tabsGet,
      sendMessage: mocks.tabsSendMessage,
      update: mocks.tabsUpdate,
      reload: mocks.tabsReload,
    },
    windows: { update: mocks.windowsUpdate },
    runtime: {
      onMessage: {
        addListener: (
          listener: (message: unknown, sender: unknown) => unknown,
        ) => {
          mocks.onMessageListener.current = listener;
        },
      },
    },
    action: {
      onClicked: {
        addListener: (listener: () => unknown) => {
          mocks.onClickedListener.current = listener;
        },
      },
    },
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
vi.mock("@/shared/error-handler", () => ({
  captureError: mocks.captureError,
  addBreadcrumb: mocks.addBreadcrumb,
}));
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
  mocks.windowsUpdate.mockReset().mockResolvedValue(undefined);
  mocks.createManagedTab.mockReset().mockResolvedValue(undefined);
  mocks.captureError.mockReset();
  mocks.addBreadcrumb.mockReset();
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

  it("tags the terminal failure with the error name for triage", async () => {
    const failure = new Error("Tabs cannot be edited right now");
    failure.name = "TabDragError";
    mocks.createManagedTab.mockRejectedValue(failure);

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.captureError).toHaveBeenCalledWith(
      failure,
      { items: { count: 1 } },
      { operation: "handle_new_items", error_name: "TabDragError" },
    );
  });

  it("leaves a breadcrumb trail describing the delivery path before it fails", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: null, items: [makeItem("a")] });
    mocks.storeSet.mockRejectedValue(new Error("storage unavailable"));

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("b")],
    });

    expect(mocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "handle_new_items",
        message: "Persisting merged batch",
        data: expect.objectContaining({ incoming: 1, merged: 2 }),
      }),
    );
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { items: { count: 1 } },
      expect.objectContaining({ operation: "handle_new_items" }),
    );
  });

  it("retries a transient items write and still opens the tab", async () => {
    mocks.storeSet
      .mockRejectedValueOnce(new Error("transient storage error"))
      .mockResolvedValue(undefined);

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.storeSet).toHaveBeenCalledTimes(2);
    expect(mocks.createManagedTab).toHaveBeenCalledWith("./src/tab/index.html");
    expect(mocks.captureError).not.toHaveBeenCalled();
  });

  it("reports the items write only after the retry also fails", async () => {
    mocks.storeSet.mockRejectedValue(new Error("storage unavailable"));

    await dispatch({
      type: "send-items-to-background",
      items: [makeItem("a")],
    });

    expect(mocks.storeSet).toHaveBeenCalledTimes(2);
    expect(mocks.createManagedTab).not.toHaveBeenCalled();
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { items: { count: 1 } },
      expect.objectContaining({ operation: "handle_new_items" }),
    );
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

  it("ignores a malformed runtime message", async () => {
    await dispatch({ type: "bogus" });

    expect(mocks.storeSet).not.toHaveBeenCalled();
    expect(mocks.tabsSendMessage).not.toHaveBeenCalled();
    expect(mocks.createManagedTab).not.toHaveBeenCalled();
  });
});

describe("managed tab lifecycle", () => {
  const removeTab = (tabId: number) => mocks.onRemovedListener.current?.(tabId);

  it("clears the stored tab and items when the managed tab is closed", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [makeItem("a")] });

    await removeTab(7);

    expect(mocks.storeSet).toHaveBeenCalledWith({ tabId: null, items: [] });
    expect(setUiOptions).toHaveBeenCalledWith({ enabled: true });
  });

  it("ignores closure of an unrelated tab", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });

    await removeTab(99);

    expect(mocks.storeSet).not.toHaveBeenCalled();
  });

  it("reports, rather than throws, when shutdown breaks the store access", async () => {
    mocks.storeGet.mockRejectedValue(
      new Error("The browser is shutting down."),
    );

    await expect(removeTab(7)).resolves.toBeUndefined();

    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { tab: { tabId: 7 } },
      { operation: "tab_removed" },
    );
  });
});

describe("toolbar action opens settings", () => {
  const clickAction = () => mocks.onClickedListener.current?.();

  it("focuses the existing tab and reveals settings", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: 7, items: [] });
    mocks.tabsGet.mockResolvedValue({ id: 7, windowId: 3 });

    await clickAction();

    expect(mocks.tabsUpdate).toHaveBeenCalledWith(7, { active: true });
    expect(mocks.windowsUpdate).toHaveBeenCalledWith(3, { focused: true });
    expect(mocks.tabsSendMessage).toHaveBeenCalledWith(7, {
      type: "show-settings",
    });
    expect(mocks.createManagedTab).not.toHaveBeenCalled();
  });

  it("opens a new settings tab when none exists", async () => {
    mocks.storeGet.mockResolvedValue({ tabId: null, items: [] });

    await clickAction();

    expect(mocks.createManagedTab).toHaveBeenCalledWith(
      "./src/tab/index.html#settings",
    );
  });
});
