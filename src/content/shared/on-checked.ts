import { store } from "@/content/store";
import { extractDownloadItem } from "./item-extractor";

export const createOnChecked =
  (pageType: "collection" | "purchase") => (target: HTMLInputElement) => {
    const { updateSelected } = store.getState();

    const id = target.getAttribute("data-id");

    if (!id) {
      return;
    }

    if (!target.checked) {
      updateSelected(id, false, null);
      return;
    }

    const item = extractDownloadItem(target, pageType);

    if (!item) {
      return;
    }

    updateSelected(id, true, item);
  };
