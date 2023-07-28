import { StoreApi } from "zustand/vanilla";

import { ContentState } from "./store";

export const addShiftKeyListener = (store: StoreApi<ContentState>) => {
  const pressShiftKey = (e: KeyboardEvent) => {
    if (e.key === "Shift" || e.key === "Meta") {
      store.getState().toggleShiftKey(Boolean(e.shiftKey || e.metaKey));
    }
  };

  document.addEventListener("keydown", pressShiftKey);
  document.addEventListener("keyup", pressShiftKey);
};
