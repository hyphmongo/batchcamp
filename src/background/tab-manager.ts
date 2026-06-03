import browser from "webextension-polyfill";

import { backgroundStore as store } from "@/storage";

const getCurrentTab = async () => {
  const tabs = await browser.tabs.query({
    active: true,
    windowId: browser.windows.WINDOW_ID_CURRENT,
  });

  return tabs[0];
};

export const createManagedTab = async (path: string): Promise<number> => {
  const currentTab = await getCurrentTab();

  const options: browser.Tabs.CreateCreatePropertiesType = {
    url: browser.runtime.getURL(path),
    index: (currentTab?.index ?? 0) + 1,
  };

  if (currentTab?.cookieStoreId) {
    options.cookieStoreId = currentTab.cookieStoreId;
  }

  const tab = await browser.tabs.create(options);

  if (tab.id == null) {
    throw new Error("Created tab has no ID");
  }

  if ("autoDiscardable" in tab) {
    await browser.tabs.update(tab.id, { autoDiscardable: false });
  }

  await store.set({ tabId: tab.id });
  return tab.id;
};
