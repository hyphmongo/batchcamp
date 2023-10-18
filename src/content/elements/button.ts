import { StoreApi } from "zustand/vanilla";
import { ContentState } from "../store";

import browser from "webextension-polyfill";

export const createDownloadButton = (store: StoreApi<ContentState>) => {
  const onDownloadButtonClicked = () => {
    const { selected, resetSelected } = store.getState();

    browser.runtime.sendMessage({
      type: "send-downloads-to-background",
      items: Object.values(selected).filter((x) => x),
    });

    resetSelected();
  };

  const button = document.createElement("button");
  button.className = "btn btn-primary fixed bottom-4 right-4 z-[1000]";
  button.setAttribute("id", "download-all");
  button.onclick = onDownloadButtonClicked;

  store.subscribe((store) => {
    const selectedCount = store.selectedCount();

    if (selectedCount === 0 && document.getElementById("download-all")) {
      document.body.removeChild(button);
    }

    if (selectedCount > 0 && !document.getElementById("download-all")) {
      document.body.appendChild(button);
    }

    button.innerText = `Download ${selectedCount} ${
      selectedCount > 1 ? "items" : "item"
    }`;
  });

  return button;
};
