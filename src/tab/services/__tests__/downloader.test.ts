import { describe, expect, it } from "vitest";

import {
  parseContentDispositionFilename,
  sanitizeFilename,
  sanitizePath,
} from "@/tab/services/downloader-utils";

describe("sanitizeFilename", () => {
  it("prefixes reserved Windows names with underscore", () => {
    expect(sanitizeFilename("CON.mp3")).toBe("_CON.mp3");
    expect(sanitizeFilename("LPT9.mp3")).toBe("_LPT9.mp3");
  });

  it("replaces every filesystem-illegal character with underscore", () => {
    expect(sanitizeFilename('a<>:"|?*%b.mp3')).toBe("a_b.mp3");
    expect(sanitizeFilename("song\\name.mp3")).toBe("song_name.mp3");
  });

  it("strips control characters", () => {
    expect(sanitizeFilename("song\x00\x1fname.mp3")).toBe("songname.mp3");
  });

  it("strips zero-width and unicode-whitespace characters", () => {
    expect(sanitizeFilename("song\u00A0name.mp3")).toBe("songname.mp3");
    expect(sanitizeFilename("song\u200Cname.mp3")).toBe("songname.mp3");
  });

  it("preserves non-Latin scripts", () => {
    expect(sanitizeFilename("日本語アーティスト - アルバム.zip")).toBe(
      "日本語アーティスト - アルバム.zip",
    );
  });

  it("collapses multiple spaces to single space", () => {
    expect(sanitizeFilename("song   name.mp3")).toBe("song name.mp3");
  });

  it("preserves a single space between words", () => {
    expect(sanitizeFilename("Artist - Album.zip")).toBe("Artist - Album.zip");
  });

  it("collapses multiple underscores from replacements", () => {
    expect(sanitizeFilename("a<><>b.mp3")).toBe("a_b.mp3");
  });

  it("strips leading and trailing dots and whitespace from name", () => {
    expect(sanitizeFilename("...song...mp3")).toBe("song.mp3");
  });

  it("strips leading and trailing underscores", () => {
    expect(sanitizeFilename("___song___.mp3")).toBe("song.mp3");
  });

  it("falls back to 'download' when name is empty after cleaning", () => {
    expect(sanitizeFilename("<>.mp3")).toBe("download.mp3");
  });

  it("falls back to 'download' for empty string input", () => {
    expect(sanitizeFilename("")).toBe("download");
  });

  it("falls back to 'download' for leading-dot-only input like .mp3", () => {
    expect(sanitizeFilename(".mp3")).toBe("download.mp3");
  });

  it("sanitizes illegal characters in the extension", () => {
    expect(sanitizeFilename("song.<>")).toBe("song");
  });

  it("preserves valid extension after sanitizing illegal chars", () => {
    expect(sanitizeFilename("song.mp3?token=abc")).toBe("song.mp3_token=abc");
  });

  it("sanitizes extensionless input with illegal characters", () => {
    expect(sanitizeFilename("<>")).toBe("download");
  });

  it("does not truncate a name that fits the 200-char budget with its extension", () => {
    const name = "a".repeat(196);
    expect(sanitizeFilename(`${name}.mp3`)).toBe(`${name}.mp3`);
  });

  it("truncates an overlong name so name plus extension fit 200 characters", () => {
    const name = "a".repeat(201);
    expect(sanitizeFilename(`${name}.mp3`)).toBe(`${"a".repeat(196)}.mp3`);
  });

  it("strips trailing underscores after truncation", () => {
    const name = `${"a".repeat(195)}_bbbbb`;
    const result = sanitizeFilename(`${name}.mp3`);
    expect(result).toBe(`${"a".repeat(195)}.mp3`);
  });

  it("preserves extension when name part is cleaned", () => {
    expect(sanitizeFilename("valid-name.flac")).toBe("valid-name.flac");
  });

  it("treats dotless filename as empty name + extension", () => {
    expect(sanitizeFilename("valid-name")).toBe("download.valid-name");
  });

  it("handles filename with multiple dots", () => {
    expect(sanitizeFilename("artist.name.song.mp3")).toBe(
      "artist.name.song.mp3",
    );
  });

  it("replaces forward slashes", () => {
    expect(sanitizeFilename("path/song.mp3")).toBe("path_song.mp3");
  });
});

describe("sanitizePath", () => {
  it("sanitizes each path segment independently", () => {
    expect(sanitizePath("Radiohead/OK Computer.zip")).toBe(
      "Radiohead/OK Computer.zip",
    );
  });

  it("sanitizes illegal characters in each segment", () => {
    expect(sanitizePath("Art<ist>/Alb:um.zip")).toBe("Art_ist/Alb_um.zip");
  });

  it("handles multiple directory levels", () => {
    expect(sanitizePath("2026/Radiohead/OK Computer.zip")).toBe(
      "2026/Radiohead/OK Computer.zip",
    );
  });

  it("removes empty segments from double slashes", () => {
    expect(sanitizePath("Artist//Album.zip")).toBe("Artist/Album.zip");
  });

  it("removes leading and trailing slashes", () => {
    expect(sanitizePath("/Artist/Album.zip/")).toBe("Artist/Album.zip");
  });

  it("handles a flat filename with no slashes", () => {
    expect(sanitizePath("Artist - Album.zip")).toBe("Artist - Album.zip");
  });

  it("handles reserved names in directory segments", () => {
    expect(sanitizePath("CON/Album.zip")).toBe("_CON/Album.zip");
  });

  it("prevents directory traversal with ..", () => {
    expect(sanitizePath("../../Artist/Album.zip")).toBe("Artist/Album.zip");
  });

  it("handles segment that sanitizes to empty", () => {
    expect(sanitizePath("<>/Album.zip")).toBe("Album.zip");
  });

  it("preserves CJK characters in path segments", () => {
    expect(sanitizePath("アーティスト/アルバム.zip")).toBe(
      "アーティスト/アルバム.zip",
    );
  });
});

describe("sanitizeFilename length budget", () => {
  it("keeps the extension when truncating an overlong name", () => {
    const result = sanitizeFilename(`${"a".repeat(250)}.flac`);

    expect(result.endsWith(".flac")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("does not split a surrogate pair at the truncation boundary", () => {
    const result = sanitizeFilename(`${"𝄞".repeat(150)}.mp3`);

    expect(result).not.toMatch(/[\uD800-\uDBFF]\./);
    expect(result.endsWith(".mp3")).toBe(true);
  });
});

describe("parseContentDispositionFilename", () => {
  it("parses RFC 5987 UTF-8 encoded filename", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''My%20Album.zip",
      ),
    ).toBe("My Album.zip");
  });

  it("parses RFC 5987 filenames that carry a language tag", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8'en'My%20Album.zip",
      ),
    ).toBe("My Album.zip");
  });

  it("decodes percent-encoded unicode in RFC 5987 format", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''caf%C3%A9.zip",
      ),
    ).toBe("café.zip");
  });

  it("parses quoted filename", () => {
    expect(
      parseContentDispositionFilename('attachment; filename="My Album.zip"'),
    ).toBe("My Album.zip");
  });

  it("parses unquoted filename", () => {
    expect(
      parseContentDispositionFilename("attachment; filename=album.zip"),
    ).toBe("album.zip");
  });

  it("prefers RFC 5987 over quoted filename when both present", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.zip\"; filename*=UTF-8''preferred.zip",
      ),
    ).toBe("preferred.zip");
  });

  it.each([
    ["attachment", "header with no filename directive"],
    ["", "empty string"],
    ["inline", "inline disposition with no filename"],
  ])("returns null for %s", (header) => {
    expect(parseContentDispositionFilename(header)).toBeNull();
  });

  it("handles RFC 5987 with extra whitespace around equals", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename* = UTF-8''spaced.zip",
      ),
    ).toBe("spaced.zip");
  });

  it("handles case-insensitive UTF-8 prefix", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=utf-8''lowercase.zip",
      ),
    ).toBe("lowercase.zip");
  });

  it("stops RFC 5987 value at semicolon", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''album.zip; other=value",
      ),
    ).toBe("album.zip");
  });

  it("throws on malformed percent-encoding in RFC 5987", () => {
    expect(() =>
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''%ZZbad.zip",
      ),
    ).toThrow(URIError);
  });

  it("returns null for empty quoted filename", () => {
    expect(
      parseContentDispositionFilename('attachment; filename=""'),
    ).toBeNull();
  });
});
