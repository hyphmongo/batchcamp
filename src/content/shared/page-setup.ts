import { createDownloadButton } from "@/content/elements/download-button";
import { store } from "@/content/store";

interface ToggleableElement extends HTMLElement {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
  abort?: () => void;
}

interface PageController {
  observeOptions: MutationObserverInit;
  createObserver: (syncButtons: () => void) => MutationObserver;
  resolve: () => Element[] | null;
  injectExistingCheckboxes: () => void;
  getSelectAllButton: () => ToggleableElement | null;
  canSelectAll?: () => boolean;
  bulkCount?: () => number | null;
  totalCount?: () => number;
  beforeSend?: () => Promise<void>;
  source: string;
}

export const createPageController = (page: PageController): (() => void) => {
  let observer: MutationObserver | null = null;
  let pagehideCleanup: (() => void) | null = null;

  const cleanup = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (pagehideCleanup) {
      window.removeEventListener("pagehide", pagehideCleanup);
      pagehideCleanup = null;
    }
  };

  return () => {
    cleanup();

    const targets = page.resolve();
    if (!targets) {
      return;
    }

    const downloadBtn = createDownloadButton(store, {
      beforeSend: page.beforeSend,
      source: page.source,
    });
    const selectAllBtn = page.getSelectAllButton();
    if (selectAllBtn) {
      document.body.appendChild(selectAllBtn);
    }
    document.body.appendChild(downloadBtn);

    const { unsubscribe, syncButtonState } = setupButtonSubscription(store, {
      downloadBtn,
      selectAllBtn,
      canSelectAll: page.canSelectAll,
      bulkCount: page.bulkCount,
      totalCount: page.totalCount,
    });

    observer = page.createObserver(syncButtonState);
    for (const target of targets) {
      observer.observe(target, page.observeOptions);
    }

    page.injectExistingCheckboxes();

    pagehideCleanup = () => {
      cleanup();
      unsubscribe();
    };
    window.addEventListener("pagehide", pagehideCleanup);
  };
};

interface ButtonElements {
  downloadBtn: ToggleableElement;
  selectAllBtn?: ToggleableElement | null;
  canSelectAll?: () => boolean;
  bulkCount?: () => number | null;
  totalCount?: () => number;
}

const downloadLabel = (count: number, all = false) =>
  count > 1
    ? `Download ${all ? "all " : ""}${count} releases`
    : `Download ${count} release`;

const setLabel = (button: ToggleableElement, text: string) => {
  if ("setLabel" in button) {
    (button as { setLabel: (t: string) => void }).setLabel(text);
  } else {
    button.textContent = text;
  }
};

const setupButtonSubscription = (
  contentStore: typeof store,
  buttons: ButtonElements,
): { unsubscribe: () => void; syncButtonState: () => void } => {
  const {
    downloadBtn,
    selectAllBtn,
    canSelectAll = () => true,
    bulkCount,
    totalCount,
  } = buttons;

  const syncButtonState = () => {
    const selectedCount = contentStore.getState().selectedCount();
    const bulk = selectedCount === 0 ? (bulkCount?.() ?? null) : null;

    if (selectedCount === 0 && bulk === null) {
      downloadBtn.hide();

      if (selectAllBtn) {
        if (canSelectAll()) {
          selectAllBtn.show();
        } else {
          selectAllBtn.hide();
          selectAllBtn.abort?.();
        }
      }
      return;
    }

    const isEverything = bulk !== null || selectedCount === totalCount?.();

    setLabel(downloadBtn, downloadLabel(bulk ?? selectedCount, isEverything));
    downloadBtn.show();

    if (selectAllBtn) {
      selectAllBtn.hide();
      selectAllBtn.abort?.();
    }
  };

  syncButtonState();

  const unsubscribe = contentStore.subscribe(
    (state) => state.selected,
    syncButtonState,
  );

  return {
    unsubscribe: () => {
      unsubscribe();
      downloadBtn.cleanup();
      if (selectAllBtn) {
        selectAllBtn.abort?.();
        selectAllBtn.cleanup();
      }
    },
    syncButtonState,
  };
};
