import { addBreadcrumb, captureError } from "@/shared/error-handler";
import { initSentry } from "@/shared/sentry";
import { downloadHistoryStore, migrateLegacyStorage } from "@/storage";
import type { Item } from "@/types";
import { DownloadHistoryTracker } from "./download-history-tracker";
import { setupCollectionPage } from "./pages/collection/collection";
import { setupPurchasesPage } from "./pages/purchases";
import { waitForElement } from "./shared/wait-for-element";
import { addShiftKeyListener } from "./shift-key-listener";
import { store } from "./store";

type PageType = "collection" | "purchases" | null;

const detectPageType = (): PageType => {
  if (document.getElementById("collection-grid")) {
    return "collection";
  }
  if (document.getElementById("oh-container")) {
    return "purchases";
  }
  return null;
};

const injectStyles = () => {
  void import("./content-styles.css");
};

const updateCheckboxDownloadedState = (ids: Set<string>) => {
  for (const checkbox of document.querySelectorAll(".bc-checkbox")) {
    const id = checkbox.getAttribute("data-id");
    if (id && ids.has(id)) {
      checkbox.classList.add("bc-checkbox-downloaded");
    } else {
      checkbox.classList.remove("bc-checkbox-downloaded");
    }
  }
};

const resetCheckboxesAfterDownload = (selected: Record<string, Item>) => {
  if (store.getState().selectedCount() > 0) {
    return;
  }

  for (const checkbox of document.querySelectorAll(".bc-checkbox")) {
    const id = checkbox.getAttribute("data-id");
    if (id) {
      (checkbox as HTMLInputElement).checked = Boolean(selected[id]);
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const pageType = detectPageType();

  if (!pageType) {
    return;
  }

  injectStyles();
  await initSentry("content");

  addBreadcrumb({
    category: "content.init",
    message: `Page type: ${pageType}`,
    level: "info",
  });

  try {
    await migrateLegacyStorage();

    const tracker = new DownloadHistoryTracker((ids) => {
      store.getState().setDownloadedIds(ids);
      updateCheckboxDownloadedState(ids);
    });

    const { downloadedIds } = await downloadHistoryStore.get();
    tracker.updateHistory(downloadedIds);

    addShiftKeyListener(store);

    if (pageType === "collection") {
      await waitForElement("#collection-search-grid", "collection search grid");
      setupCollectionPage();
    } else {
      setupPurchasesPage();
    }

    const unsubscribeSelected = store.subscribe(
      (state) => state.selected,
      resetCheckboxesAfterDownload,
    );

    const unsubscribeHistory = downloadHistoryStore.watch(({ downloadedIds }) =>
      tracker.updateHistory(downloadedIds),
    );

    window.addEventListener("pagehide", () => {
      unsubscribeSelected();
      unsubscribeHistory();
    });
  } catch (error) {
    captureError(
      error,
      { page: { url: window.location.href } },
      { operation: "content_script_init" },
    );
  }
});
