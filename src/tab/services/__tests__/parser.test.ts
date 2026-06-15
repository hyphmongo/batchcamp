import { Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { track } from "@/shared/analytics";
import { addBreadcrumb, captureError } from "@/shared/error-handler";
import {
  type PageOutcome,
  ParseError,
  parse,
  parsePage,
  parseSizeMb,
} from "@/tab/services/parser";
import type { Format, PendingItem } from "@/types";

vi.mock("@/shared/error-handler", () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
vi.mock("@/shared/analytics", async () => {
  const actual =
    await vi.importActual<typeof import("@/shared/analytics")>(
      "@/shared/analytics",
    );
  return { ...actual, track: vi.fn() };
});

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

  it("returns undefined for a non-finite value", () => {
    expect(parseSizeMb("1e400")).toBeUndefined();
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
  downloads: makeDownloads(),
  ...overrides,
});

const makeData = (items: Record<string, unknown>[] = [makeItem()]) => ({
  digital_items: items,
});

const parseWith = (format: Format, data: unknown) =>
  Effect.runSyncExit(
    parsePage(format)(data).pipe(
      Effect.map((outcome) =>
        outcome._tag === "Downloads" ? outcome.downloads : [],
      ),
    ),
  );

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

const outcomeOf = (format: Format, data: unknown): PageOutcome =>
  expectOk(Effect.runSyncExit(parsePage(format)(data)));

describe("parsePage download extraction", () => {
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

  it("skips an item missing both ids but keeps its valid siblings", () => {
    const data = makeData([
      makeItem({ item_id: undefined, sale_id: undefined }),
      makeItem({ item_id: 5 }),
    ]);
    expect(expectOk(parseWith("flac", data)).map((d) => d.id)).toEqual([
      "5:flac",
    ]);
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

  it("filters out items that have no downloads for the format", () => {
    const data = makeData([
      makeItem(),
      makeItem({ item_id: 2, downloads: undefined }),
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

  it("returns empty array when no item has downloads", () => {
    const data = makeData([
      makeItem({ downloads: undefined, item_id: 1 }),
      makeItem({ downloads: undefined, item_id: 2 }),
    ]);
    expect(expectOk(parseWith("mp3-320", data))).toEqual([]);
  });

  it("returns empty array for empty digital_items", () => {
    expect(expectOk(parseWith("mp3-320", makeData([])))).toEqual([]);
  });

  it("keeps valid downloads when a sibling has empty downloads (BATCHCAMP-7W)", () => {
    const data = makeData([
      makeItem({ item_id: 1 }),
      makeItem({ item_id: 2, downloads: undefined }),
    ]);
    expect(expectOk(parseWith("mp3-320", data)).map((d) => d.id)).toEqual([
      "1:mp3-320",
    ]);
  });

  it("keeps an item whose package_release_date is null (BATCHCAMP-7W)", () => {
    const result = expectOk(
      parseWith("flac", makeData([makeItem({ package_release_date: null })])),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBeUndefined();
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

  it("skips an item that fails validation, keeping the rest of the page (BATCHCAMP-7W)", () => {
    vi.mocked(addBreadcrumb).mockClear();
    const data = makeData([
      makeItem({ item_id: 1 }),
      { bad: "data" },
      makeItem({ item_id: 3 }),
    ]);
    expect(expectOk(parseWith("mp3-320", data)).map((d) => d.id)).toEqual([
      "1:mp3-320",
      "3:mp3-320",
    ]);
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("returns a ParseError when the page envelope itself is unusable", () => {
    const err = expectErr(parseWith("mp3-320", { digital_items: "nope" }));
    expect(err).toBeInstanceOf(ParseError);
  });

  it("surfaces a ParseError when every item fails validation (Bandcamp shape change)", () => {
    const data = makeData([{ bad: "data" }, { also: "bad" }]);
    const err = expectErr(parseWith("mp3-320", data));
    expect(err).toBeInstanceOf(ParseError);
    expect(err.cause.message).toContain("failed validation");
  });

  it("does not surface an error when some items still produce downloads", () => {
    const data = makeData([{ bad: "data" }, makeItem({ item_id: 7 })]);
    expect(expectOk(parseWith("mp3-320", data)).map((d) => d.id)).toEqual([
      "7:mp3-320",
    ]);
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

describe("parse surfaces non-OK fetch responses (BATCHCAMP-7H)", () => {
  const item: PendingItem = {
    id: "i1",
    title: "Album",
    status: "pending",
    url: "https://bandcamp.com/download/x",
    format: "flac",
  };

  beforeEach(() => {
    vi.mocked(captureError).mockClear();
    vi.mocked(addBreadcrumb).mockClear();
    vi.mocked(track).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a 429 to PostHog but not as a Sentry error (handled, auto-retried)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("<html>too many requests</html>"),
      }),
    );

    const result = await parse(item);

    expect(result.kind).toBe("rateLimited");
    expect(track).toHaveBeenCalledWith("rate_limited", { format: "flac" });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("treats a 404 as an expected upstream miss: warns, does not capture to Sentry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("<html>not found</html>"),
      }),
    );

    const result = await parse(item);

    expect(result.kind).toBe("failed");
    expect(captureError).not.toHaveBeenCalled();
    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warning",
        message: expect.stringContaining("404"),
      }),
    );
    expect(track).not.toHaveBeenCalledWith("rate_limited", expect.anything());
  });
});

describe("parse signals a Bandcamp schema change (BATCHCAMP-7W)", () => {
  const item: PendingItem = {
    id: "i1",
    title: "Album",
    status: "pending",
    url: "https://bandcamp.com/download/x",
    format: "flac",
  };

  const stubPage = (data: unknown) => {
    const blob = JSON.stringify(data);
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString() {
          return { getElementById: () => ({ getAttribute: () => blob }) };
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
      }),
    );
  };

  beforeEach(() => {
    vi.mocked(captureError).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures a parse_bandcamp_data error when every item fails validation", async () => {
    stubPage({ digital_items: [{ bad: "data" }] });

    const result = await parse(item);

    expect(result.kind).toBe("failed");
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        parser: expect.objectContaining({ format: "flac" }),
      }),
      expect.objectContaining({ operation: "parse_bandcamp_data" }),
      ["parse-bandcamp-data"],
    );
  });

  it("does not capture when at least one item parses normally", async () => {
    stubPage({
      digital_items: [
        { bad: "data" },
        {
          artist: "A",
          title: "T",
          item_id: 1,
          downloads: { flac: { url: "https://bandcamp.com/f" } },
        },
      ],
    });

    const result = await parse(item);

    expect(result.kind).toBe("downloads");
    if (result.kind === "downloads") {
      expect(result.downloads).toHaveLength(1);
    }
    expect(captureError).not.toHaveBeenCalled();
  });
});

describe("parsePage tolerates null string fields (BATCHCAMP-7F)", () => {
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

describe("parsePage unverified gate (account email not confirmed)", () => {
  const page = (
    verified: boolean | null,
    items: Record<string, unknown>[],
  ) => ({
    identities: { fan: verified === null ? null : { verified } },
    digital_items: items,
  });

  it("is Unverified when items lack downloads and the fan is not verified", () => {
    const outcome = outcomeOf(
      "flac",
      page(false, [makeItem({ downloads: undefined })]),
    );
    expect(outcome._tag).toBe("Unverified");
  });

  it("yields Downloads when the verified account still has links", () => {
    const outcome = outcomeOf("flac", page(true, [makeItem()]));
    expect(outcome._tag).toBe("Downloads");
  });

  it("is not Unverified for a verified account whose links are simply absent", () => {
    const outcome = outcomeOf(
      "flac",
      page(true, [makeItem({ downloads: undefined })]),
    );
    expect(outcome._tag).toBe("Downloads");
  });

  it("is not Unverified when there is no fan identity (anonymous access)", () => {
    const outcome = outcomeOf(
      "flac",
      page(null, [makeItem({ downloads: undefined })]),
    );
    expect(outcome._tag).toBe("Downloads");
  });

  it("yields Downloads when an unverified fan still has downloads on some items", () => {
    const outcome = outcomeOf(
      "flac",
      page(false, [
        makeItem({ item_id: 1 }),
        makeItem({ item_id: 2, downloads: undefined }),
      ]),
    );
    expect(outcome._tag).toBe("Downloads");
  });

  it("fails with a ParseError for unparseable page data", () => {
    expect(Exit.isFailure(Effect.runSyncExit(parsePage("flac")(null)))).toBe(
      true,
    );
  });
});
