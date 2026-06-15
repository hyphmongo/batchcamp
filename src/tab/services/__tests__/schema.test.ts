import { describe, expect, it } from "vitest";

import { bandcampPageSchema, digitalItemSchema } from "@/tab/services/schema";

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
  downloads: makeDownloads(),
  ...overrides,
});

const parseItem = (item: Record<string, unknown>) =>
  digitalItemSchema.safeParse(item);

describe("digitalItemSchema downloads/id invariants (BATCHCAMP-7W)", () => {
  it("accepts an item with no downloads (filtered downstream, not rejected)", () => {
    expect(parseItem(makeValidItem({ downloads: undefined })).success).toBe(
      true,
    );
  });

  it("rejects an item with neither item_id nor sale_id", () => {
    expect(
      parseItem(makeValidItem({ item_id: undefined, sale_id: undefined }))
        .success,
    ).toBe(false);
  });

  it("forms bandcampId from sale_id when item_id is absent", () => {
    const result = parseItem(
      makeValidItem({ item_id: undefined, sale_id: 77 }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bandcampId).toBe("77");
    }
  });
});

describe("digitalItemSchema null fields (BATCHCAMP-7W)", () => {
  it("accepts a null package_release_date and normalizes it to undefined", () => {
    const result = parseItem(makeValidItem({ package_release_date: null }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.package_release_date).toBeUndefined();
    }
  });

  it("accepts a null purchased date", () => {
    expect(parseItem(makeValidItem({ purchased: null })).success).toBe(true);
  });

  it("accepts a null size_mb on a download", () => {
    const downloads: Record<string, { url: string; size_mb?: string | null }> =
      makeDownloads();
    downloads.flac = { url: "https://bandcamp.com/flac", size_mb: null };
    expect(parseItem(makeValidItem({ downloads })).success).toBe(true);
  });
});

describe("digitalItemSchema id coercion", () => {
  it("transforms numeric item_id to string", () => {
    const result = parseItem(makeValidItem({ item_id: 42 }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.item_id).toBe("42");
    }
  });

  it("rejects non-number item_id", () => {
    expect(parseItem(makeValidItem({ item_id: "not-a-number" })).success).toBe(
      false,
    );
  });
});

describe("digitalItemSchema partial format availability", () => {
  it("accepts an item whose downloads lack some formats", () => {
    const downloads = makeDownloads();
    delete downloads["aiff-lossless"];
    delete downloads.alac;
    expect(parseItem(makeValidItem({ downloads })).success).toBe(true);
  });
});

describe("bandcampPageSchema", () => {
  it("rejects when digital_items is missing entirely", () => {
    expect(bandcampPageSchema.safeParse({}).success).toBe(false);
  });

  it("accepts arbitrary item shapes; items are validated individually downstream", () => {
    expect(
      bandcampPageSchema.safeParse({ digital_items: [{ anything: true }] })
        .success,
    ).toBe(true);
  });
});
