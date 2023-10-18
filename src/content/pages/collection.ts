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
  const mutationHandler = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      for (const item of mutation.addedNodes) {
        const element = item as Element;

        if (
          element.nodeType === 1 &&
          element.classList.contains("collection-item-container")
        ) {
          const id = element.getAttribute("data-tralbumid");

          if (id && element.querySelector(".redownload-item")) {
            element.appendChild(createCheckbox(id, store, onChecked));
          }
        }
      }
    }
  };

  const observer = new MutationObserver(mutationHandler);

  const container = document.getElementById("collection-grid");

  if (!container) {
    return;
  }

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  const searchContainer = document.getElementById("collection-search-items");

  if (!searchContainer) {
    return;
  }

  observer.observe(searchContainer, {
    childList: true,
    subtree: true,
  });

  const itemContainers = document.querySelectorAll(
    "[id*='collection-item-container']"
  );

  for (const element of itemContainers) {
    const id = element?.getAttribute("data-tralbumid");

    if (id && element.querySelector(".redownload-item")) {
      element.appendChild(createCheckbox(id, store, onChecked));
    }
  }

  store.subscribe((store) => {
    const selected = store.selected;

    for (const [id, item] of Object.entries(selected)) {
      const checkboxes = document.querySelectorAll(`[data-id="${id}"]`);

      for (const checkbox of checkboxes) {
        (checkbox as HTMLInputElement).checked = Boolean(item);
      }
    }
  });

  createDownloadButton(store);
};
