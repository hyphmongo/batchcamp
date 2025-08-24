import { createCheckbox } from "../elements/checkbox";
import { createDownloadButton } from "../elements/download-button";
import { createSelectAllButton } from "../elements/select-all-button";
import { extractDownloadItem } from "../shared/item-extractor";
import { setupButtonSubscription } from "../shared/page-setup";
import { store } from "../store";


const onChecked = (target: HTMLInputElement) => {
  const { updateSelected } = store.getState();

  const id = target.getAttribute("data-id");

  if (!id) {
    return;
  }

  const item = extractDownloadItem(target, 'purchase');

  if (!item) {
    return;
  }

  updateSelected(id, target.checked, item);
};

const addCheckbox = (item: Element) => {
  const toAppend = item.querySelector('[data-tid="links"]');

  if (!toAppend) {
    return;
  }

  if (toAppend.classList.contains("deleted-badge")) {
    return;
  }

  const container = document.createElement("div");
  container.className = "[&>*]:left-0 [&>*]:relative";
  container.style.paddingBottom = "8px";
  const id = item.getAttribute("sale_item_id");

  if (!id) {
    return;
  }

  container.appendChild(createCheckbox(id, store, onChecked));
  toAppend.prepend(container);
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

const getSelectAllButton = () => {
  const target = parseInt(
    (
      document.querySelector(".page-items-number")?.parentElement
        ?.textContent || ""
    ).match(/of (\d+)/)?.[1] || "0"
  );

  const showMore = document.querySelector(".view-all-button") as HTMLElement;

  const container = document.getElementsByClassName(
    "purchases"
  )[0] as HTMLElement;

  return createSelectAllButton(target, showMore, container, "purchases-item");
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
  const selectAllBtn = getSelectAllButton();

  document.body.appendChild(selectAllBtn);
  document.body.appendChild(downloadBtn);

  setupButtonSubscription(store, {
    downloadBtn,
    selectAllBtn
  });
};
