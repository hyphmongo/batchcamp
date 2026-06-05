import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/content/store";
import type { Item } from "@/types";

const makeItem = (id: string): Item =>
  ({
    id,
    title: `Item ${id}`,
    status: "pending",
    url: "https://bc.com",
  }) as Item;

beforeEach(() => {
  store.setState({
    selected: {},
    downloadedIds: new Set(),
    shiftKeyPressed: false,
    lastClickedIndex: 0,
  });
});

describe("updateSelected", () => {
  it("adds an item to selected when isSelected is true", () => {
    const item = makeItem("1");
    store.getState().updateSelected("1", true, item);

    expect(store.getState().selected["1"]).toBe(item);
  });

  it("removes an item from selected when isSelected is false", () => {
    const item = makeItem("1");
    store.getState().updateSelected("1", true, item);
    store.getState().updateSelected("1", false, null);

    expect(store.getState().selected["1"]).toBeUndefined();
  });

  it("does not add when isSelected is true but item is null", () => {
    store.getState().updateSelected("1", true, null);

    expect(store.getState().selected["1"]).toBeUndefined();
  });

  it("handles multiple selections independently", () => {
    store.getState().updateSelected("1", true, makeItem("1"));
    store.getState().updateSelected("2", true, makeItem("2"));

    expect(Object.keys(store.getState().selected)).toEqual(["1", "2"]);
  });

  it("overwrites existing selection with new item data", () => {
    const itemA = makeItem("1");
    const itemB = { ...makeItem("1"), title: "Updated" } as Item;
    store.getState().updateSelected("1", true, itemA);
    store.getState().updateSelected("1", true, itemB);

    expect(store.getState().selected["1"]!.title).toBe("Updated");
    expect(store.getState().selectedCount()).toBe(1);
  });
});

describe("resetSelected", () => {
  it("clears all selections", () => {
    store.getState().updateSelected("1", true, makeItem("1"));
    store.getState().updateSelected("2", true, makeItem("2"));

    store.getState().resetSelected();

    expect(store.getState().selected).toEqual({});
  });
});

describe("selectedCount", () => {
  it("returns 0 when nothing is selected", () => {
    expect(store.getState().selectedCount()).toBe(0);
  });

  it("returns the number of selected items", () => {
    store.getState().updateSelected("1", true, makeItem("1"));
    store.getState().updateSelected("2", true, makeItem("2"));
    store.getState().updateSelected("3", true, makeItem("3"));

    expect(store.getState().selectedCount()).toBe(3);
  });
});
