import { describe, expect, it } from "vitest";
import {
  completedItemsSelector,
  derivedItemsSelector,
  failedItemsSelector,
  pendingItemsSelector,
  shallowArrayEqual,
  sizeEstimateSelector,
  totalItemCountSelector,
} from "@/tab/selectors";
import type { State } from "@/tab/store";
import type { Item, ItemStatus } from "@/types";

const makeState = (items: Item[]): State =>
  ({
    items: new Map(items.map((item) => [item.id, item])),
  }) as State;

const pending = (id: string): Item =>
  ({
    id,
    title: `Item ${id}`,
    status: "pending",
    url: "https://bc.com",
  }) as Item;

const single = (id: string, status: ItemStatus, sizeMb?: number): Item =>
  ({
    id,
    title: `Item ${id}`,
    status,
    download: {
      id: `d-${id}`,
      title: "Song",
      progress: status === "completed" ? 100 : 0,
      url: "https://dl.com",
      sizeMb,
    },
  }) as Item;

const completed = (id: string): Item => single(id, "completed");
const failed = (id: string): Item => single(id, "failed");

describe("shallowArrayEqual", () => {
  it("returns true for two empty arrays", () => {
    expect(shallowArrayEqual([], [])).toBe(true);
  });

  it("returns true for arrays with identical elements", () => {
    expect(shallowArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("returns false for arrays with different lengths", () => {
    expect(shallowArrayEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("returns false for arrays with same length but different values", () => {
    expect(shallowArrayEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it("uses reference equality, not deep equality", () => {
    const a = { x: 1 };
    const b = { x: 1 };
    expect(shallowArrayEqual([a], [a])).toBe(true);
    expect(shallowArrayEqual([a], [b])).toBe(false);
  });
});

describe("totalItemCountSelector", () => {
  it("counts every item", () => {
    const state = makeState([pending("1"), completed("2"), failed("3")]);
    expect(totalItemCountSelector(state)).toBe(3);
  });

  it("returns 0 for empty items", () => {
    expect(totalItemCountSelector(makeState([]))).toBe(0);
  });
});

describe("status selectors", () => {
  it("pendingItemsSelector returns only pending items", () => {
    const state = makeState([
      pending("1"),
      pending("2"),
      completed("3"),
      failed("4"),
    ]);
    expect(pendingItemsSelector(state).map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("completedItemsSelector returns only completed items", () => {
    const state = makeState([pending("1"), completed("3"), failed("4")]);
    expect(completedItemsSelector(state).map((i) => i.id)).toEqual(["3"]);
  });

  it("failedItemsSelector returns only failed items", () => {
    const state = makeState([pending("1"), completed("3"), failed("4")]);
    expect(failedItemsSelector(state).map((i) => i.id)).toEqual(["4"]);
  });

  it("returns empty array when no items match status", () => {
    const state = makeState([pending("1"), completed("2")]);
    expect(failedItemsSelector(state)).toEqual([]);
  });

  it("returns same reference when called twice with same state", () => {
    const state = makeState([pending("1"), completed("2")]);
    expect(pendingItemsSelector(state)).toBe(pendingItemsSelector(state));
  });
});

describe("derivedItemsSelector", () => {
  it("returns every item unchanged", () => {
    const state = makeState([pending("1"), completed("2"), failed("3")]);
    const result = derivedItemsSelector(state);

    expect(result.map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("reflects a new item set when state changes", () => {
    const result1 = derivedItemsSelector(makeState([pending("1")]));
    const result2 = derivedItemsSelector(
      makeState([pending("1"), completed("2")]),
    );

    expect(result1).not.toBe(result2);
    expect(result2).toHaveLength(2);
  });
});

describe("sizeEstimateSelector", () => {
  it("sums known single-item sizes and counts the unknowns", () => {
    const state = makeState([
      single("a", "queued", 5),
      single("b", "queued", 7),
      single("c", "queued"),
    ]);

    const est = sizeEstimateSelector(state);

    expect(est.totalCount).toBe(3);
    expect(est.knownCount).toBe(2);
    expect(est.knownSizeMb).toBe(12);
  });

  it("handles a single sized item", () => {
    const est = sizeEstimateSelector(makeState([single("s1", "completed", 4)]));
    expect(est).toEqual({ knownSizeMb: 4, knownCount: 1, totalCount: 1 });
  });
});

describe("failedItemsSelector", () => {
  it("returns failed items", () => {
    const state = makeState([failed("f1"), failed("f2"), completed("c1")]);
    expect(failedItemsSelector(state)).toHaveLength(2);
  });
});
