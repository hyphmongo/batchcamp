import { describe, expect, it } from "vitest";

import { type Item, isResolvedItem } from "@/types";

describe("isResolvedItem uses a structural discriminant", () => {
  const resolvedButPending = {
    id: "x",
    title: "t",
    status: "pending",
    download: {
      id: "d",
      title: "t",
      artist: "a",
      progress: 0,
      url: "https://bandcamp.com/d",
      format: "flac",
    },
  } as Item;

  it("treats a resolved item re-queued at status:pending as resolved", () => {
    expect(isResolvedItem(resolvedButPending)).toBe(true);
  });
});
