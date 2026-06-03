import type { StoreApi } from "zustand/vanilla";

import type { ContentState } from "./store";

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
  const clearShiftKey = () => {
    store.getState().toggleShiftKey(false);
  };

  document.addEventListener("keydown", pressShiftKey);
  document.addEventListener("keyup", pressShiftKey);
  window.addEventListener("blur", clearShiftKey);
  document.addEventListener("visibilitychange", clearShiftKey);

  const cleanup = () => {
    document.removeEventListener("keydown", pressShiftKey);
    document.removeEventListener("keyup", pressShiftKey);
    window.removeEventListener("blur", clearShiftKey);
    document.removeEventListener("visibilitychange", clearShiftKey);
    window.removeEventListener("pagehide", cleanup);
    shiftKeyCleanup = null;
  };
  shiftKeyCleanup = cleanup;

  window.addEventListener("pagehide", cleanup);

  return cleanup;
};
