import { describe, expect, it } from "vitest";
import { calculateProgress, getStatus } from "@/tab/selectors";
import type { Item, ResolvedItem } from "@/types";

const makeSingle = (overrides: Partial<ResolvedItem> = {}): Item =>
  ({
    id: "1",
    title: "Song",
    status: "downloading",
    download: { id: "d1", title: "Song", progress: 50, url: "https://dl.com" },
    ...overrides,
  }) as Item;

const makePending = (): Item =>
  ({
    id: "p1",
    title: "Pending",
    status: "pending",
    url: "https://bc.com",
  }) as Item;

describe("calculateProgress", () => {
  it("returns download progress for a single item", () => {
    expect(calculateProgress(makeSingle(), {})).toBe(50);
  });

  it("prefers the live progress overlay over download.progress", () => {
    expect(calculateProgress(makeSingle(), { "1": 75 })).toBe(75);
  });

  it("returns 0 for a pending item", () => {
    expect(calculateProgress(makePending(), {})).toBe(0);
  });
});

describe("getStatus", () => {
  it("passes through the item's own status", () => {
    expect(getStatus(makeSingle({ status: "downloading" }))).toBe(
      "downloading",
    );
    expect(getStatus(makeSingle({ status: "failed" }))).toBe("failed");
  });
});
