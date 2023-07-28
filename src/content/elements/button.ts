import { StoreApi } from "zustand/vanilla";

import { Item } from "../../types";
import { ContentState } from "../store";

import browser from "webextension-polyfill";

export const createDownloadButton = (
  store: StoreApi<ContentState>,
  mapper: (eventTarget: HTMLInputElement) => Item | null
) => {
  const onDownloadButtonClicked = () => {
    const selected = document.querySelectorAll(
      "input:checked"
    ) as NodeListOf<HTMLInputElement>;

    const mapped = Array.from(selected)
      .map(mapper)
      .filter((x) => x);

    browser.runtime.sendMessage({
      type: "send-downloads-to-background",
      items: mapped,
    });

    document
      .querySelectorAll<HTMLInputElement>("input:checked")
      .forEach((checkbox: HTMLInputElement) => {
        checkbox.checked = false;
      });

    store.getState().setCheckedCount(0);
  };

  const button = document.createElement("button");
  button.className = "btn btn-primary fixed bottom-4 right-4 z-[1000]";
  button.setAttribute("id", "download-all");
  button.onclick = onDownloadButtonClicked;

  store.subscribe((store) => {
    const selectedCount = store.checkedCount;

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
