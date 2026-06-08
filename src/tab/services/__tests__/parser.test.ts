import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

import { getDownloads, ParseError, parseSizeMb } from "@/tab/services/parser";
import type { Format } from "@/types";

describe("parseSizeMb", () => {
  it("treats a bare number as MB", () => {
    expect(parseSizeMb("150")).toBe(150);
  });

  it("scales GB to MB", () => {
    expect(parseSizeMb("2 GB")).toBe(2048);
  });

  it("scales TB to MB", () => {
    expect(parseSizeMb("1 TB")).toBe(1024 * 1024);
  });

  it("scales KB to MB", () => {
    expect(parseSizeMb("512 KB")).toBeCloseTo(0.5);
  });

  it("ignores a unit that is not at the end of the string", () => {
    expect(parseSizeMb("2 kbps stream")).toBe(2);
  });

  it("accepts a trailing unit with surrounding whitespace", () => {
    expect(parseSizeMb("1.5 GB ")).toBe(1536);
  });

  it("returns undefined for missing or non-numeric input", () => {
    expect(parseSizeMb(undefined)).toBeUndefined();
    expect(parseSizeMb("abc")).toBeUndefined();
  });
});

const makeDownloads = (url = "https://bandcamp.com/download/track") =>
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
    ].map((key) => [key, { url }]),
  );

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  artist: "Test Artist",
  title: "Test Album",
  item_id: 12345,
  sale_id: 67890,
  killed: null,
  downloads: makeDownloads(),
  ...overrides,
});

const makeData = (items: Record<string, unknown>[] = [makeItem()]) => ({
  digital_items: items,
});

const parseWith = (format: Format, data: unknown) =>
  Effect.runSyncExit(getDownloads(format)(data));

const expectOk = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isFailure(exit)) {
    throw new Error(`expected success, got failure: ${String(exit.cause)}`);
  }
  return exit.value;
};

const expectErr = <A, E>(exit: Exit.Exit<A, E>): E => {
  if (Exit.isSuccess(exit)) {
    throw new Error("expected failure, got success");
  }
  const failure = Exit.causeOption(exit);
  if (failure._tag === "None") {
    throw new Error("expected cause");
  }
  const cause = failure.value;
  if (cause._tag !== "Fail") {
    throw new Error(`unexpected cause type: ${cause._tag}`);
  }
  return cause.error;
};

describe("getDownloads", () => {
  it("extracts download from a valid item using the specified format", () => {
    const url = "https://bandcamp.com/download/track?format=mp3-320";
    const data = makeData([makeItem({ downloads: makeDownloads(url) })]);

    expect(expectOk(parseWith("mp3-320", data))).toEqual([
      {
        id: "12345:mp3-320",
        title: "Test Album",
        artist: "Test Artist",
        date: undefined,
        artUrl: undefined,
        sizeMb: undefined,
        url,
        progress: 0,
        format: "mp3-320",
      },
    ]);
  });

  it("uses item_id as id when both item_id and sale_id are present", () => {
    const data = makeData([makeItem({ item_id: 111, sale_id: 222 })]);
    expect(expectOk(parseWith("flac", data))[0]!.id).toBe("111:flac");
  });

  it("falls back to sale_id when item_id is missing", () => {
    const data = makeData([makeItem({ item_id: undefined, sale_id: 99999 })]);
    expect(expectOk(parseWith("flac", data))[0]!.id).toBe("99999:flac");
  });

  it("uses item_id of 0 correctly after schema coercion to string", () => {
    const data = makeData([makeItem({ item_id: 0, sale_id: 999 })]);
    expect(expectOk(parseWith("flac", data))[0]!.id).toBe("0:flac");
  });

  it("returns ParseError when both item_id and sale_id are missing", () => {
    const data = makeData([
      makeItem({ item_id: undefined, sale_id: undefined }),
    ]);
    const err = expectErr(parseWith("flac", data));
    expect(err).toBeInstanceOf(ParseError);
    expect(err.cause.message).toBe("id is missing");
  });

  it("uses parsed.title verbatim without prepending the artist", () => {
    const data = makeData([
      makeItem({ artist: "Radiohead", title: "OK Computer" }),
    ]);
    expect(expectOk(parseWith("mp3-320", data))[0]!.title).toBe("OK Computer");
  });

  it("preserves bandcamp titles that already include the artist prefix", () => {
    const data = makeData([
      makeItem({ artist: "Dylan Forbes", title: "Dylan Forbes - Resoblaster" }),
    ]);
    const result = expectOk(parseWith("mp3-320", data));
    expect(result[0]!.title).toBe("Dylan Forbes - Resoblaster");
    expect(result[0]!.artist).toBe("Dylan Forbes");
  });

  it("filters out killed items (items without downloads)", () => {
    const data = makeData([
      makeItem(),
      makeItem({ item_id: 2, downloads: undefined, killed: 1 }),
    ]);
    expect(expectOk(parseWith("mp3-320", data))).toHaveLength(1);
  });

  it("extracts multiple items from digital_items array", () => {
    const data = makeData([
      makeItem({ item_id: 1 }),
      makeItem({ item_id: 2 }),
      makeItem({ item_id: 3 }),
    ]);
    const result = expectOk(parseWith("mp3-320", data));
    expect(result.map((d) => d.id)).toEqual([
      "1:mp3-320",
      "2:mp3-320",
      "3:mp3-320",
    ]);
  });

  it("returns empty array when all items are killed", () => {
    const data = makeData([
      makeItem({ downloads: undefined, killed: 1, item_id: 1 }),
      makeItem({ downloads: undefined, killed: 1, item_id: 2 }),
    ]);
    expect(expectOk(parseWith("mp3-320", data))).toEqual([]);
  });

  it("returns empty array for empty digital_items", () => {
    expect(expectOk(parseWith("mp3-320", makeData([])))).toEqual([]);
  });

  it.each([
    "mp3-v0",
    "mp3-320",
    "flac",
    "aac-hi",
    "vorbis",
    "alac",
    "wav",
    "aiff-lossless",
  ] as Format[])("extracts url for format %s", (format) => {
    const url = `https://bandcamp.com/${format}`;
    const data = makeData([makeItem({ downloads: makeDownloads(url) })]);
    expect(expectOk(parseWith(format, data))[0]!.url).toBe(url);
  });

  it("returns ParseError with ZodError messages for invalid schema", () => {
    const data = { digital_items: [{ bad: "data" }] };
    const err = expectErr(parseWith("mp3-320", data));
    expect(err).toBeInstanceOf(ParseError);
    expect(err.cause.message).toContain("Required");
  });

  it("falls back to the purchase date when no release date exists", () => {
    const data = makeData([makeItem({ purchased: "2020-01-01" })]);

    expect(expectOk(parseWith("mp3-320", data))[0]!.date).toBe("2020-01-01");
  });

  it("skips items missing the requested format but keeps the rest", () => {
    const downloads = makeDownloads();
    delete downloads.flac;
    const data = makeData([
      makeItem({ item_id: 1 }),
      makeItem({ item_id: 2, downloads }),
    ]);

    const result = expectOk(parseWith("flac", data));

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("1:flac");
  });

  it("returns no downloads when the only item lacks the requested format", () => {
    const downloads = makeDownloads();
    delete downloads.flac;
    const data = makeData([makeItem({ downloads })]);

    expect(expectOk(parseWith("flac", data))).toEqual([]);
  });

  it.each([
    ["string", "not an object"],
    ["null", null],
    ["number", 42],
  ])("returns Err for %s input", (_, input) => {
    expect(Exit.isFailure(parseWith("mp3-320", input))).toBe(true);
  });
});

describe("getDownloads tolerates null string fields (BATCHCAMP-7F)", () => {
  it("keeps an item whose artist is null rather than dropping the whole page", () => {
    const result = expectOk(
      parseWith("flac", makeData([makeItem({ artist: null })])),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.artist).toBe("");
  });

  it("keeps an item whose title is null", () => {
    const result = expectOk(
      parseWith("flac", makeData([makeItem({ title: null })])),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("");
  });

  it("returns the valid items when only one item in the page has a null field", () => {
    const data = makeData([
      makeItem({ item_id: 1, artist: null }),
      makeItem({ item_id: 2 }),
    ]);
    const result = expectOk(parseWith("flac", data));
    expect(result.map((d) => d.id)).toEqual(["1:flac", "2:flac"]);
  });
});
