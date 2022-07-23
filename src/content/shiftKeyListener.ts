import { StoreApi } from "zustand/vanilla";
import { ContentState } from "./store";

export const addShiftKeyListener = (store: StoreApi<ContentState>) => {
  const pressShiftKey = (e: KeyboardEvent) => {
    if (e.key === "Shift") {
      store.getState().toggleShiftKey(Boolean(e.shiftKey));
    }
  };

  document.addEventListener("keydown", pressShiftKey);
  document.addEventListener("keyup", pressShiftKey);
};
