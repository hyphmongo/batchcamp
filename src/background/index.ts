import { backgroundStore as store } from "../storage";
import { Item, Message } from "../types";

chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  const storage = await store.get();

  if (tabId === storage.tabId) {
    store.set({ tabId: null, items: [] });
    chrome.downloads.setShelfEnabled(true);
  }
});

const handleNewDownloads = async (items: Item[]) => {
  chrome.downloads.setShelfEnabled(false);

  const storage = await store.get();
  let tabId = storage.tabId;

  // is the tab still open?
  try {
    if (tabId) {
      await chrome.tabs.get(tabId);
    }
  } catch (error) {
    tabId = null;
  }

  if (!tabId) {
    const tab = await chrome.tabs.create({
      url: chrome.runtime.getURL("./src/tab/index.html"),
    });

    await store.set({ tabId: tab.id });
  } else {
    chrome.tabs.sendMessage<Message>(tabId, {
      type: "send-downloads-to-tab",
      items,
    });

    chrome.tabs.update(tabId, {
      active: true,
    });
  }

  store.set({ items });
};

const handleNewTabOpened = async () => {
  const storage = await store.get();

  if (storage.tabId && storage.items.length > 0) {
    chrome.tabs.sendMessage<Message>(storage.tabId, {
      type: "send-downloads-to-tab",
      items: storage.items,
    });
    await store.set({ items: [] });
  }

  return true;
};

chrome.runtime.onMessage.addListener(async (message: Message) => {
  if (message.type === "send-downloads-to-background") {
    await handleNewDownloads(message.items);
  }

  if (message.type === "tab-opened") {
    await handleNewTabOpened();
  }
});

export {};
