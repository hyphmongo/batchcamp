import { describe, expect, it } from "vitest";

import { applyTemplate } from "@/shared/filename-utils";

const sampleData = {
  artist: "Radiohead",
  title: "OK Computer",
  date: "2024-03-15",
  format: "flac",
};

describe("applyTemplate", () => {
  it("replaces all tokens with their values", () => {
    expect(applyTemplate("{artist} - {title}", sampleData)).toBe(
      "Radiohead - OK Computer",
    );
  });

  it("handles template with all available tokens", () => {
    expect(
      applyTemplate("{date} - {artist} - {title} [{format}]", sampleData),
    ).toBe("2024-03-15 - Radiohead - OK Computer [flac]");
  });

  it("leaves unknown tokens as-is", () => {
    expect(applyTemplate("{artist} - {unknown}", sampleData)).toBe(
      "Radiohead - {unknown}",
    );
  });

  it("handles template with no tokens", () => {
    expect(applyTemplate("plain text", sampleData)).toBe("plain text");
  });

  it("handles empty template", () => {
    expect(applyTemplate("", sampleData)).toBe("");
  });

  it("handles repeated tokens", () => {
    expect(applyTemplate("{artist} - {artist}", sampleData)).toBe(
      "Radiohead - Radiohead",
    );
  });

  it("handles path separators for subdirectory organization", () => {
    expect(applyTemplate("{artist}/{title}", sampleData)).toBe(
      "Radiohead/OK Computer",
    );
  });

  it("handles missing data values by keeping the token", () => {
    expect(applyTemplate("{artist} - {title}", { artist: "Radiohead" })).toBe(
      "Radiohead - {title}",
    );
  });

  it("handles empty string data values", () => {
    expect(
      applyTemplate("{artist} - {title}", { artist: "", title: "Album" }),
    ).toBe(" - Album");
  });

  it("escapes slashes inside a value so they don't become directories", () => {
    expect(
      applyTemplate("{artist} - {title}", {
        artist: "AC/DC",
        title: "Back in Black",
      }),
    ).toBe("AC_DC - Back in Black");
  });

  it("keeps literal template slashes while escaping slashes within values", () => {
    expect(
      applyTemplate("{artist}/{title}", {
        artist: "AC/DC",
        title: "Hells/Bells",
      }),
    ).toBe("AC_DC/Hells_Bells");
  });

  it("escapes backslashes inside a value", () => {
    expect(applyTemplate("{artist}", { artist: "AC\\DC" })).toBe("AC_DC");
  });
});
