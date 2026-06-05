import { describe, expect, it } from "vitest";

import { makeItemId, releaseIdOf, releaseIdSet } from "@/shared/id";

describe("makeItemId", () => {
  it("joins a bandcamp id and format with a colon", () => {
    expect(makeItemId(123, "mp3-320")).toBe("123:mp3-320");
    expect(makeItemId("456", "flac")).toBe("456:flac");
  });
});

describe("releaseIdOf", () => {
  it("strips the format suffix", () => {
    expect(releaseIdOf("123:flac")).toBe("123");
  });

  it("returns a bare id unchanged", () => {
    expect(releaseIdOf("123")).toBe("123");
  });
});

describe("releaseIdSet", () => {
  it("strips ':format' suffixes from composite entries", () => {
    const entries = ["123:flac", "456:mp3-320", "789:wav"];
    expect(releaseIdSet(entries)).toEqual(new Set(["123", "456", "789"]));
  });

  it("dedupes a release that appears in multiple formats", () => {
    expect(releaseIdSet(["123:flac", "123:mp3-320", "123:wav"])).toEqual(
      new Set(["123"]),
    );
  });

  it("handles bare release ids without a suffix", () => {
    expect(releaseIdSet(["123", "456"])).toEqual(new Set(["123", "456"]));
  });

  it("mixes composite and bare entries", () => {
    expect(releaseIdSet(["123:flac", "456"])).toEqual(new Set(["123", "456"]));
  });

  it("returns an empty set for empty entries", () => {
    expect(releaseIdSet([])).toEqual(new Set());
  });
});
