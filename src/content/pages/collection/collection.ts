import { Item } from "../../../types";
import { createDownloadButton } from "../../elements/download-button";
import { createCheckbox } from "../../elements/checkbox";
import { createSelectAllButton } from "../../elements/select-all-button";
import { store } from "../../store";
import { createMutationObserver } from "./mutation";

const getDownloadItem = (eventTarget: HTMLInputElement): Item | null => {
  const downloadElement =
    eventTarget.parentNode?.querySelector(".redownload-item a");

  if (!(downloadElement instanceof HTMLAnchorElement)) {
    return null;
  }

  const container = eventTarget.closest(".collection-item-container");

  const id = container?.getAttribute("data-tralbumid");

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
    url: downloadElement.href,
    title: `${artist} - ${title}`,
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

export const setupCollectionPage = () => {
  const container = document.getElementById("collection-grid");
  const searchContainer = document.getElementById("collection-search-grid");

  if (!container || !searchContainer) {
    return;
  }

  const observer = createMutationObserver(onChecked);

  const options = {
    attributes: true,
    childList: true,
    subtree: true,
  };

  observer.observe(container, options);
  observer.observe(searchContainer, options);

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
  const selectAllBtn = createSelectAllButton();

  document.body.appendChild(selectAllBtn);
  document.body.appendChild(downloadBtn);

  store.subscribe((store) => {
    const selectedCount = store.selectedCount();

    if (selectedCount === 0) {
      downloadBtn.classList.add("hidden");
      selectAllBtn.classList.remove("hidden");
    }

    if (selectedCount > 0) {
      downloadBtn.textContent = `Download ${selectedCount} ${
        selectedCount > 1 ? "items" : "item"
      }`;

      downloadBtn.classList.remove("hidden");
      selectAllBtn.classList.add("hidden");
    }
  });
};
