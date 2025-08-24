import { StoreApi } from "zustand/vanilla";

import { ContentState } from "./store";

let shiftKeyCleanup: (() => void) | null = null;

export const addShiftKeyListener = (store: StoreApi<ContentState>) => {
  if (shiftKeyCleanup) {
    shiftKeyCleanup();
  }

  const pressShiftKey = (e: KeyboardEvent) => {
    if (e.key === "Shift" || e.key === "Meta") {
      store.getState().toggleShiftKey(Boolean(e.shiftKey || e.metaKey));
    }
  };

  document.addEventListener("keydown", pressShiftKey);
  document.addEventListener("keyup", pressShiftKey);

  shiftKeyCleanup = () => {
    document.removeEventListener("keydown", pressShiftKey);
    document.removeEventListener("keyup", pressShiftKey);
    shiftKeyCleanup = null;
  };

  window.addEventListener('beforeunload', shiftKeyCleanup);

  return shiftKeyCleanup;
};
