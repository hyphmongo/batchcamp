import { Item } from "../../types";
import { createDownloadButton } from "../elements/download-button";
import { createCheckbox } from "../elements/checkbox";
import { store } from "../store";

const getDownloadItem = (eventTarget: HTMLInputElement): Item | null => {
  const purchase = eventTarget.closest(".purchases-item");

  if (!purchase) {
    return null;
  }

  const id = purchase.getAttribute("sale_item_id");

  if (!id) {
    return null;
  }

  const downloadElement = purchase.querySelector('[data-tid="download"]');

  if (!(downloadElement instanceof HTMLAnchorElement)) {
    return null;
  }

  const url = new URL(downloadElement.href);

  const split = eventTarget
    .closest(".purchases-item")
    ?.querySelector(".purchases-item-title")
    ?.textContent?.split(" by ");

  if (!split) {
    return null;
  }

  let title = `${split[1]} - ${split[0]}`;

  if (!split[1]) {
    title = split[0];
  }

  return {
    id,
    status: "pending",
    url: url.toString(),
    title,
  };
};

const onChecked = (target: HTMLInputElement) => {
  const { updateSelected } = store.getState();

  const id = target.getAttribute("data-id");

  if (!id) {
    return;
  }

  const item = getDownloadItem(target);

  if (!item) {
    return;
  }

  updateSelected(id, target.checked, item);
};

const addCheckbox = (item: Element) => {
  const toAppend = item.querySelector(".purchases-item-download");

  if (!toAppend) {
    return;
  }

  const container = document.createElement("div");
  container.className = "[&>*]:left-0 [&>*]:relative";
  const id = item.getAttribute("sale_item_id");

  if (!id) {
    return;
  }

  container.appendChild(createCheckbox(id, store, onChecked));
  toAppend.append(container);
};

const mutationHandler = (mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    for (const item of mutation.addedNodes) {
      const element = item as Element;

      if (
        element.nodeType === 1 &&
        element.classList.contains("purchases-item")
      ) {
        addCheckbox(element);
      }
    }
  }
};

export const setupPurchasesPage = () => {
  const container = document.getElementById("oh-container");

  if (!container) {
    return;
  }

  const observer = new MutationObserver(mutationHandler);

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  const itemContainers = document.getElementsByClassName("purchases-item");

  for (const item of itemContainers) {
    addCheckbox(item);
  }

  const downloadBtn = createDownloadButton(store);

  document.body.appendChild(downloadBtn);

  store.subscribe((store) => {
    const selectedCount = store.selectedCount();

    if (selectedCount === 0) {
      downloadBtn.classList.add("hidden");
    }

    if (selectedCount > 0) {
      downloadBtn.textContent = `Download ${selectedCount} ${
        selectedCount > 1 ? "items" : "item"
      }`;

      downloadBtn.classList.remove("hidden");
    }
  });
};
