import browser from "webextension-polyfill";

import { initAnalytics, track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import { initSentry } from "@/shared/sentry";
import { backgroundStore as store } from "@/storage";
import { type Item, isMessage } from "@/types";
import { createFilenameRouter } from "./filename-router";
import { createManagedTab } from "./tab-manager";

void initSentry("background");
void initAnalytics("background");

const setDownloadShelfEnabled = (enabled: boolean) => {
  if (typeof chrome !== "undefined" && chrome.downloads?.setUiOptions) {
    void Promise.resolve(chrome.downloads.setUiOptions({ enabled })).catch(
      () => {},
    );
  }
};

browser.tabs.onRemoved.addListener(async (tabId: number) => {
  try {
    const storage = await store.get();

    if (tabId === storage.tabId) {
      await store.set({ tabId: null, items: [] });
      setDownloadShelfEnabled(true);
    }
  } catch (error) {
    captureError(error, { tab: { tabId } }, { operation: "tab_removed" });
  }
});

let handleNewItemsLock: Promise<void> = Promise.resolve();

const mergeItems = (existing: Item[], incoming: Item[]): Item[] => {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
};

const handleNewItems = async (incoming: Item[]) => {
  const releaseLock = handleNewItemsLock;
  let release: () => void;
  handleNewItemsLock = new Promise((r) => {
    release = r;
  });
  await releaseLock;
  try {
    track("items_received", { count: incoming.length });
    setDownloadShelfEnabled(false);

    const storage = await store.get();
    let tabId = storage.tabId;

    try {
      if (tabId) {
        await browser.tabs.get(tabId);
      }
    } catch {
      tabId = null;
    }

    const items = mergeItems(storage.items, incoming);
    await store.set({ items });

    if (!tabId) {
      await createManagedTab("./src/tab/index.html");
    } else {
      try {
        await browser.tabs.sendMessage(tabId, {
          type: "send-items-to-tab",
          items,
        });
        await browser.tabs.update(tabId, { active: true });
      } catch (error) {
        captureError(
          error,
          { message: { tabId } },
          { operation: "send_items_to_tab" },
        );
        await store.set({ tabId: null });
      }
    }
  } catch (error) {
    setDownloadShelfEnabled(true);
    captureError(
      error,
      { items: { count: incoming.length } },
      { operation: "handle_new_items" },
    );
  } finally {
    release!();
  }
};

const handleNewTabOpened = async (senderTabId?: number) => {
  try {
    const storage = await store.get();
    let tabId = storage.tabId;

    if (!tabId && senderTabId != null) {
      tabId = senderTabId;
      await store.set({ tabId });
    }

    if (tabId && storage.items.length > 0) {
      await browser.tabs.sendMessage(tabId, {
        type: "send-items-to-tab",
        items: storage.items,
      });
    }
  } catch (error) {
    captureError(error, {}, { operation: "handle_tab_opened" });
  }

  return true;
};

const filenameRouter = createFilenameRouter();

if (typeof chrome !== "undefined" && chrome.downloads?.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) =>
    filenameRouter.route({ url: item.url, filename: item.filename }, suggest),
  );
}

const openOrFocusTab = async () => {
  try {
    const storage = await store.get();
    let tabId = storage.tabId;

    if (tabId) {
      try {
        const tab = await browser.tabs.get(tabId);
        await browser.tabs.update(tabId, { active: true });
        if (tab.windowId != null) {
          await browser.windows.update(tab.windowId, { focused: true });
        }
        try {
          await browser.tabs.sendMessage(tabId, { type: "show-settings" });
        } catch {}
        return;
      } catch {
        tabId = null;
      }
    }

    await createManagedTab("./src/tab/index.html#settings");
  } catch (error) {
    captureError(error, {}, { operation: "open_or_focus_tab" });
  }
};

type ActionApi = {
  onClicked: {
    addListener: (callback: () => void) => void;
  };
};
type WithActionApi = {
  action?: ActionApi;
  browserAction?: ActionApi;
};
const { action, browserAction } = browser as typeof browser & WithActionApi;
const actionApi = action ?? browserAction;
if (actionApi?.onClicked) {
  actionApi.onClicked.addListener(openOrFocusTab);
}

browser.runtime.onMessage.addListener(
  (message: unknown, sender: browser.Runtime.MessageSender) => {
    if (!isMessage(message)) {
      return;
    }

    if (message.type === "register-filename") {
      filenameRouter.register(message.url, message.filename);
      return;
    }

    if (message.type === "unregister-filename") {
      filenameRouter.unregister(message.url);
      return;
    }

    if (message.type === "send-items-to-background") {
      return handleNewItems(message.items);
    }

    if (message.type === "tab-opened") {
      return handleNewTabOpened(sender.tab?.id);
    }

    if (message.type === "items-delivered") {
      return store.set({ items: [] }).catch((error) => {
        captureError(error, {}, { operation: "items_delivered" });
      });
    }

    return;
  },
);
