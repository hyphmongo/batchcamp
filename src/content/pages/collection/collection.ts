import { createCheckbox } from "../../elements/checkbox";
import { createDownloadButton } from "../../elements/download-button";
import { createSelectAllButton } from "../../elements/select-all-button";
import { extractDownloadItem } from "../../shared/item-extractor";
import { setupButtonSubscription } from "../../shared/page-setup";
import { store } from "../../store";
import { createMutationObserver } from "./mutation";


const onChecked = (target: HTMLInputElement) => {
  const { updateSelected } = store.getState();

  const id = target.getAttribute("data-id");

  if (!id) {
    return;
  }

  const item = extractDownloadItem(target, 'collection');

  if (!item) {
    return;
  }

  updateSelected(id, target.checked, item);
};

const getSelectAllButton = () => {
  const target = parseInt(
    document.querySelector("#grid-tabs>.active .count")?.textContent || "0"
  );

  const showMore = document.querySelector(
    ".expand-container.show-button > button"
  ) as HTMLElement;

  const container = document.getElementById("collection-grid");
  
  if (!container) {
    return null;
  }

  return createSelectAllButton(
    target,
    showMore,
    container,
    "collection-item-container"
  );
};

let collectionObserver: MutationObserver | null = null;

const cleanupCollectionPage = () => {
  if (collectionObserver) {
    collectionObserver.disconnect();
    collectionObserver = null;
  }
};

export const setupCollectionPage = () => {
  cleanupCollectionPage();
  
  const container = document.getElementById("collection-grid");
  const searchContainer = document.getElementById("collection-search-grid");

  if (!container || !searchContainer) {
    return;
  }

  const collectionSearchInput = document.getElementById("collection-search");
  const ownerElement = document.getElementsByClassName("fan-bio owner");

  if (!collectionSearchInput && !ownerElement.length) {
    return;
  }

  collectionObserver = createMutationObserver(onChecked);

  const options = {
    attributes: true,
    childList: true,
    subtree: true,
  };

  collectionObserver.observe(container, options);
  collectionObserver.observe(searchContainer, options);

  window.addEventListener('beforeunload', cleanupCollectionPage);

  const itemContainers = document.querySelectorAll(
    "[id*='collection-item-container']"
  );

  for (const element of itemContainers) {
    const id = element?.getAttribute("data-tralbumid");

    if (id && element.querySelector(".redownload-item")) {
      element.appendChild(createCheckbox(id, store, onChecked));
    }
  }

  const downloadBtn = createDownloadButton(store);
  const selectAllBtn = getSelectAllButton();

  if (selectAllBtn) {
    document.body.appendChild(selectAllBtn);
  }
  document.body.appendChild(downloadBtn);

  const unsubscribe = setupButtonSubscription(store, {
    downloadBtn,
    selectAllBtn
  });

  window.addEventListener('beforeunload', () => {
    cleanupCollectionPage();
    unsubscribe();
  });
};
