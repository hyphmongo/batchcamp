import "../styles.css";

import { createDownloadButton } from "./elements/button";
import { createCheckbox } from "./elements/checkbox";
import { addShiftKeyListener } from "./shiftKeyListener";
import { store } from "./store";

const setup = () => {
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

  const downloadButton = createDownloadButton(store);

  store.subscribe((store) => {
    const selectedCount = store.checkedCount;

    if (selectedCount === 0 && document.getElementById("download-all")) {
      document.body.removeChild(downloadButton);
    }

    if (selectedCount > 0 && !document.getElementById("download-all")) {
      document.body.appendChild(downloadButton);
    }

    downloadButton.innerText = `Download ${selectedCount} ${
      selectedCount > 1 ? "items" : "item"
    }`;
  });
};

addShiftKeyListener(store);
setup();
