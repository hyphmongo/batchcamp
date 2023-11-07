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

  button.className = "btn btn-primary fixed bottom-4 right-4 z-[1000] hidden";
  button.setAttribute("id", "download-all");
  button.onclick = onDownloadButtonClicked;

  return button;
};
