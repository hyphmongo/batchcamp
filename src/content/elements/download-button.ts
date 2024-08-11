import browser from "webextension-polyfill";
import { StoreApi } from "zustand/vanilla";

import { ContentState } from "../store";
import { createMovableButton } from "./movable-button";

export const createDownloadButton = (store: StoreApi<ContentState>) => {
  const onDownloadButtonClicked = () => {
    const { selected, resetSelected } = store.getState();

    browser.runtime.sendMessage({
      type: "send-items-to-background",
      items: Object.values(selected).filter((x) => x),
    });

    resetSelected();
  };

  const button = createMovableButton(
    "download-all",
    "btn btn-primary fixed bottom-4 right-4 z-[1000] hidden",
    onDownloadButtonClicked
  );

  return button;
};
