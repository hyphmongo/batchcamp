import { backgroundStore as store } from "../storage";
import { Item, Message } from "../types";

import browser from "webextension-polyfill";

const isChrome = typeof chrome.downloads.setShelfEnabled !== "undefined";

browser.tabs.onRemoved.addListener(async (tabId: number) => {
  const storage = await store.get();

  if (tabId === storage.tabId) {
    store.set({ tabId: null, items: [] });
    if (isChrome) {
      chrome.downloads.setShelfEnabled(true);
    }
  }
});

const getCurrentTab = async () => {
  const tabs = await browser.tabs.query({
    active: true,
    windowId: browser.windows.WINDOW_ID_CURRENT,
  });

  return tabs[0];
};

const handleNewItems = async (items: Item[]) => {
  if (isChrome) {
    chrome.downloads.setShelfEnabled(false);
  }

  const storage = await store.get();
  let tabId = storage.tabId;

  // is the tab still open?
  try {
    if (tabId) {
      await browser.tabs.get(tabId);
    }
  } catch (error) {
    tabId = null;
  }

  if (!tabId) {
    const currentTab = await getCurrentTab();

    const options: browser.Tabs.CreateCreatePropertiesType = {
      url: browser.runtime.getURL("./src/tab/index.html"),
      index: currentTab.index + 1,
    };

    if (!isChrome) {
      options.cookieStoreId = currentTab.cookieStoreId;
    }

    const tab = await browser.tabs.create(options);

    browser.tabs.update(tab.id, {
      autoDiscardable: false,
    });

    await store.set({ tabId: tab.id });
  } else {
    browser.tabs.sendMessage(tabId, {
      type: "send-items-to-tab",
      items,
    });

    browser.tabs.update(tabId, {
      active: true,
    });
  }

  store.set({ items });
};

const handleNewTabOpened = async () => {
  const storage = await store.get();

  if (storage.tabId && storage.items.length > 0) {
    browser.tabs.sendMessage(storage.tabId, {
      type: "send-items-to-tab",
      items: storage.items,
    });
    await store.set({ items: [] });
  }

  return true;
};

browser.runtime.onMessage.addListener(
  async (message: Message, _, sendResponse: () => void) => {
    if (message.type === "send-items-to-background") {
      await handleNewItems(message.items);
    }

    if (message.type === "tab-opened") {
      await handleNewTabOpened();
    }

    sendResponse();
  }
);

export {};
