import { BANDCAMP, reportMissingMarkup } from "@/content/bandcamp-dom";
import { createSelectAllButton } from "@/content/elements/select-all-button";
import {
  COLLECTION_CHECKBOX,
  injectCheckbox,
} from "@/content/shared/inject-checkbox";
import { createCollect, createOnChecked } from "@/content/shared/on-checked";
import { createPageController } from "@/content/shared/page-setup";
import { store } from "@/content/store";
import { addBreadcrumb } from "@/shared/error-handler";
import { createMutationObserver } from "./mutation";

const onChecked = createOnChecked("collection");
const collect = createCollect("collection");

const expectedItemCount = () =>
  parseInt(
    (
      document.querySelector(BANDCAMP.activeTabCount)?.textContent || "0"
    ).replace(/,/g, ""),
    10,
  );

const getSelectAllButton = () => {
  const target = expectedItemCount();

  const showMore = document.querySelector(
    ".expand-container.show-button > button",
  ) as HTMLElement | null;

  const container = document.getElementById(BANDCAMP.collectionGrid);

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
    collect,
  );
};

const isCollectionTabActive = () =>
  document.querySelector(BANDCAMP.activeTab)?.getAttribute("data-tab") ===
  "collection";

export const setupCollectionPage = createPageController({
  source: "collection",
  observeOptions: { attributes: true, childList: true, subtree: true },
  createObserver: (syncButtons) =>
    createMutationObserver(onChecked, syncButtons),
  resolve: () => {
    const container = document.getElementById(BANDCAMP.collectionGrid);
    const searchContainer = document.getElementById(
      BANDCAMP.collectionSearchGrid,
    );

    if (!container || !searchContainer) {
      addBreadcrumb({
        category: "content.init",
        message: `Collection setup bail: container=${Boolean(container)} searchContainer=${Boolean(searchContainer)}`,
        level: "warning",
      });
      return null;
    }

    const collectionSearchInput = document.getElementById(
      BANDCAMP.collectionSearchInput,
    );
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
    const elements = document.querySelectorAll(BANDCAMP.collectionItem);

    if (elements.length === 0 && expectedItemCount() > 0) {
      reportMissingMarkup("collection", BANDCAMP.collectionItem, {
        expected: expectedItemCount(),
      });
    }

    for (const element of elements) {
      injectCheckbox(element, COLLECTION_CHECKBOX, onChecked);
    }
  },
  getSelectAllButton,
  canSelectAll: isCollectionTabActive,
});
