import { createDownloadButton } from "@/content/elements/download-button";
import { store } from "@/content/store";

interface ToggleableElement extends HTMLElement {
  hide: () => void;
  show: () => void;
  cleanup: () => void;
}

interface PageController {
  observeOptions: MutationObserverInit;
  createObserver: () => MutationObserver;
  resolve: () => Element[] | null;
  injectExistingCheckboxes: () => void;
  getSelectAllButton: () => ToggleableElement | null;
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

    observer = page.createObserver();
    for (const target of targets) {
      observer.observe(target, page.observeOptions);
    }

    page.injectExistingCheckboxes();

    const downloadBtn = createDownloadButton(store);
    const selectAllBtn = page.getSelectAllButton();
    if (selectAllBtn) {
      document.body.appendChild(selectAllBtn);
    }
    document.body.appendChild(downloadBtn);

    const unsubscribe = setupButtonSubscription(store, {
      downloadBtn,
      selectAllBtn,
    });

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
}

const setupButtonSubscription = (
  contentStore: typeof store,
  buttons: ButtonElements,
): (() => void) => {
  const { downloadBtn, selectAllBtn } = buttons;

  const syncButtonState = () => {
    const selectedCount = contentStore.getState().selectedCount();

    if (selectedCount === 0) {
      downloadBtn.hide();

      if (selectAllBtn) {
        selectAllBtn.show();
      }
    } else {
      const label = `Download ${selectedCount} ${selectedCount > 1 ? "releases" : "release"}`;
      if ("setLabel" in downloadBtn) {
        (downloadBtn as { setLabel: (t: string) => void }).setLabel(label);
      } else {
        downloadBtn.textContent = label;
      }

      downloadBtn.show();

      if (selectAllBtn) {
        selectAllBtn.hide();
      }
    }
  };

  syncButtonState();

  const unsubscribe = contentStore.subscribe(
    (state) => state.selected,
    syncButtonState,
  );

  return () => {
    unsubscribe();
    downloadBtn.cleanup();
    if (selectAllBtn) {
      selectAllBtn.cleanup();
    }
  };
};
