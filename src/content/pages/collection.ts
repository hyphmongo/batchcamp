import { Item } from "../../types";
import { createDownloadButton } from "../elements/button";
import { createCheckbox } from "../elements/checkbox";
import { store } from "../store";

const getDownloadItem = (eventTarget: HTMLInputElement): Item | null => {
  const downloadElement =
    eventTarget.parentNode?.querySelector(".redownload-item a");

  if (!(downloadElement instanceof HTMLAnchorElement)) {
    return null;
  }

  const container = eventTarget.closest(".collection-item-container");

  const downloadUrl = new URL(downloadElement.href);
  const id = new URLSearchParams(downloadUrl.search).get("sitem_id");

  if (!id) {
    return null;
  }

  const title = container
    ?.querySelector(".collection-item-title")
    ?.textContent?.split("\n")[0];

  const artist = container
    ?.querySelector(".collection-item-artist")
    ?.textContent?.replace("by ", "");

  return {
    id,
    url: downloadUrl.toString(),
    title: `${artist} - ${title}`,
  };
};

export const setupCollectionPage = () => {
  const container = document.getElementById("collection-grid");

  if (!container) {
    return;
  }

  const mutationHandler = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const item of mutation.addedNodes) {
        if (
          item.nodeType === 1 &&
          (item as Element).querySelector(".redownload-item")
        ) {
          item.appendChild(createCheckbox(store));
        }
      }
    }
  };

  const observer = new MutationObserver(mutationHandler);

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  const itemContainers = document.querySelectorAll(
    "[id*='collection-item-container']"
  );

  for (const item of itemContainers) {
    if (item.querySelector(".redownload-item")) {
      item.appendChild(createCheckbox(store));
    }
  }

  createDownloadButton(store, getDownloadItem);
};
