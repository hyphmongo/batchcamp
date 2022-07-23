import { StoreApi } from "zustand/vanilla";
import { Item, Message } from "../../types";
import { ContentState } from "../store";

const mapToItem = (eventTarget: HTMLInputElement): Item | null => {
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

export const createDownloadButton = (store: StoreApi<ContentState>) => {
  const onDownloadButtonClicked = () => {
    const selected = document.querySelectorAll(
      "input:checked"
    ) as NodeListOf<HTMLInputElement>;

    const mapped = Array.from(selected)
      .map(mapToItem)
      .reduce<Item[]>((result, item) => {
        if (item) {
          result.push(item);
        }

        return result;
      }, []);

    chrome.runtime.sendMessage<Message>({
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

  return button;
};
