import "../styles.css";
import { Item } from "../types";

import { setupCollectionPage } from "./pages/collection/collection";
import { setupPurchasesPage } from "./pages/purchases";
import { addShiftKeyListener } from "./shiftKeyListener";
import { store } from "./store";

const resetAfterDownload = (selected: Record<string, Item | null>) => {
  const count = store.getState().selectedCount();

  if (count === 0) {
    const checkboxes = Array.from(document.getElementsByClassName("checkbox"));

    for (const checkbox of checkboxes) {
      const id = checkbox.getAttribute("data-id");

      if (!id) {
        continue;
      }

      (checkbox as HTMLInputElement).checked = Boolean(selected[id]);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  addShiftKeyListener(store);
  setupCollectionPage();
  setupPurchasesPage();
  store.subscribe((state) => state.selected, resetAfterDownload);
});
