import { createSelectAllButton } from "@/content/elements/select-all-button";
import {
  COLLECTION_CHECKBOX,
  injectCheckbox,
} from "@/content/shared/inject-checkbox";
import { createOnChecked } from "@/content/shared/on-checked";
import { createPageController } from "@/content/shared/page-setup";
import { store } from "@/content/store";
import { addBreadcrumb } from "@/shared/error-handler";
import { createMutationObserver } from "./mutation";

const onChecked = createOnChecked("collection");

const getSelectAllButton = () => {
  const target = parseInt(
    (
      document.querySelector("#grid-tabs>.active .count")?.textContent || "0"
    ).replace(/,/g, ""),
    10,
  );

  const showMore = document.querySelector(
    ".expand-container.show-button > button",
  ) as HTMLElement | null;

  const container = document.getElementById("collection-grid");

  if (!container) {
    return null;
  }

  const hasHistory = store.getState().downloadedIds.size > 0;

  return createSelectAllButton(
    target,
    showMore,
    container,
    "collection-item-container",
    hasHistory,
  );
};

export const setupCollectionPage = createPageController({
  observeOptions: { attributes: true, childList: true, subtree: true },
  createObserver: () => createMutationObserver(onChecked),
  resolve: () => {
    const container = document.getElementById("collection-grid");
    const searchContainer = document.getElementById("collection-search-grid");

    if (!container || !searchContainer) {
      addBreadcrumb({
        category: "content.init",
        message: `Collection setup bail: container=${Boolean(container)} searchContainer=${Boolean(searchContainer)}`,
        level: "warning",
      });
      return null;
    }

    const collectionSearchInput = document.getElementById("collection-search");
    const ownerElement = document.getElementsByClassName("fan-bio owner");

    if (!collectionSearchInput && !ownerElement.length) {
      addBreadcrumb({
        category: "content.init",
        message: "Collection setup bail: not page owner",
        level: "info",
      });
      return null;
    }

    return [container, searchContainer];
  },
  injectExistingCheckboxes: () => {
    for (const element of document.querySelectorAll(
      "[id*='collection-item-container']",
    )) {
      injectCheckbox(element, COLLECTION_CHECKBOX, onChecked);
    }
  },
  getSelectAllButton,
});
