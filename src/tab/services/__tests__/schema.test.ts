import { describe, expect, it } from "vitest";

import { bandcampSchema } from "@/tab/services/schema";

const makeDownloads = () =>
  Object.fromEntries(
    [
      "mp3-v0",
      "mp3-320",
      "flac",
      "aac-hi",
      "vorbis",
      "alac",
      "wav",
      "aiff-lossless",
    ].map((key) => [key, { url: `https://bandcamp.com/${key}` }]),
  );

const makeValidItem = (overrides: Record<string, unknown> = {}) => ({
  artist: "Artist",
  title: "Album",
  item_id: 100,
  sale_id: 200,
  killed: null,
  downloads: makeDownloads(),
  ...overrides,
});

const parse = (items: Record<string, unknown>[]) =>
  bandcampSchema.safeParse({ digital_items: items });

describe("bandcampSchema killed/downloads cross-field constraint", () => {
  it("rejects an item with no downloads and not killed", () => {
    const result = parse([
      makeValidItem({ downloads: undefined, killed: null }),
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe(
        "downloads is empty but item is not killed",
      );
    }
  });

  it("rejects an item that has downloads AND killed=1 (inconsistent)", () => {
    const result = parse([makeValidItem({ killed: 1 })]);
    expect(result.success).toBe(false);
  });

  it("rejects an item with killed set to a non-1 truthy value", () => {
    const result = parse([makeValidItem({ downloads: undefined, killed: 2 })]);
    expect(result.success).toBe(false);
  });
});

describe("bandcampSchema id coercion", () => {
  it("transforms numeric item_id to string", () => {
    const result = parse([makeValidItem({ item_id: 42 })]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.digital_items[0]!.item_id).toBe("42");
    }
  });

  it("rejects non-number item_id", () => {
    const result = parse([makeValidItem({ item_id: "not-a-number" })]);
    expect(result.success).toBe(false);
  });
});

describe("bandcampSchema partial format availability", () => {
  it("accepts an item whose downloads lack some formats", () => {
    const downloads = makeDownloads();
    delete downloads["aiff-lossless"];
    delete downloads.alac;

    const result = parse([makeValidItem({ downloads })]);

    expect(result.success).toBe(true);
  });
});

describe("bandcampSchema envelope shape", () => {
  it("rejects when digital_items is missing entirely", () => {
    const result = bandcampSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
