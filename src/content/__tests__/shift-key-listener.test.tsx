import { afterEach, describe, expect, it } from "vitest";

import { addShiftKeyListener } from "@/content/shift-key-listener";
import { store } from "@/content/store";

afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  store.setState({ shiftKeyPressed: false, lastClickedIndex: 0 });
});

describe("addShiftKeyListener", () => {
  it("tracks shift presses on the page", () => {
    addShiftKeyListener(store);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
    );
    expect(store.getState().shiftKeyPressed).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    expect(store.getState().shiftKeyPressed).toBe(false);
  });

  it("clears the shift state when the window loses focus", () => {
    addShiftKeyListener(store);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
    );
    expect(store.getState().shiftKeyPressed).toBe(true);

    window.dispatchEvent(new Event("blur"));

    expect(store.getState().shiftKeyPressed).toBe(false);
  });

  it("clears the shift state when the tab visibility changes", () => {
    addShiftKeyListener(store);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Meta", metaKey: true }),
    );
    expect(store.getState().shiftKeyPressed).toBe(true);

    document.dispatchEvent(new Event("visibilitychange"));

    expect(store.getState().shiftKeyPressed).toBe(false);
  });
});
