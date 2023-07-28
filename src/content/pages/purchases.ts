import { Item } from "../../types";
import { createDownloadButton } from "../elements/button";
import { createCheckbox } from "../elements/checkbox";
import { store } from "../store";

const getDownloadItem = (eventTarget: HTMLInputElement): Item | null => {
  const downloadElement = eventTarget
    .closest(".purchases-item")
    ?.querySelector('[data-tid="download"]');

  if (!(downloadElement instanceof HTMLAnchorElement)) {
    return null;
  }

  const downloadUrl = new URL(downloadElement.href);
  const id = new URLSearchParams(downloadUrl.search).get("sitem_id");

  if (!id) {
    return null;
  }

  const title = eventTarget
    .closest(".purchases-item")
    ?.querySelector(".purchases-item-title")
    ?.textContent?.replace(" by ", " - ");

  return {
    id,
    url: downloadUrl.toString(),
    title: title ?? id,
  };
};

export const setupPurchasesPage = () => {
  const addCheckbox = (item: Element) => {
    const toAppend = item.querySelector(".purchases-item-download");

    const container = document.createElement("div");
    container.className = "[&>*]:left-0";
    container.appendChild(createCheckbox(store));

    toAppend!.append(container);
  };

  const container = document.getElementById("oh-container");

  if (!container) {
    return;
  }

  const mutationHandler = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const item of mutation.addedNodes) {
        if (
          item.nodeType === 1 &&
          (item as Element).querySelector(".purchases-item-download")
        ) {
          addCheckbox(item as Element);
        }
      }
    }
  };

  const observer = new MutationObserver(mutationHandler);

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  const itemContainers = document.querySelectorAll(".purchases-item");

  for (const item of itemContainers) {
    addCheckbox(item);
  }

  createDownloadButton(store, getDownloadItem);
};
