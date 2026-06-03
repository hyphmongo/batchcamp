import { describe, expect, it } from "vitest";

import { parseDate, parseYear } from "@/shared/date-utils";

describe("parseYear", () => {
  it.each([
    ["20 Feb 2026 00:00:00 GMT", "2026"],
    ["24 May 2024 08:11:31 GMT", "2024"],
    ["07 Nov 2011 00:00:00 GMT", "2011"],
    ["15 Mar 2024 12:00:00 GMT", "2024"],
  ])("extracts year from Bandcamp date '%s'", (input, expected) => {
    expect(parseYear(input)).toBe(expected);
  });

  it("returns empty string for undefined", () => {
    expect(parseYear(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(parseYear("")).toBe("");
  });

  it("returns empty string for garbage input", () => {
    expect(parseYear("not a date")).toBe("");
  });

  it("returns empty string for non-Bandcamp date formats", () => {
    expect(parseYear("2024-03-15")).toBe("");
  });

  it("handles single-digit day", () => {
    expect(parseYear("1 Jan 2020 00:00:00 GMT")).toBe("2020");
  });
});

describe("parseDate", () => {
  it.each([
    ["20 Feb 2026 00:00:00 GMT", "2026-02-20"],
    ["24 May 2024 08:11:31 GMT", "2024-05-24"],
    ["07 Nov 2011 00:00:00 GMT", "2011-11-07"],
    ["15 Mar 2024 12:00:00 GMT", "2024-03-15"],
  ])("converts Bandcamp date '%s' to ISO date", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("returns empty string for undefined", () => {
    expect(parseDate(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(parseDate("")).toBe("");
  });

  it("returns empty string for garbage input", () => {
    expect(parseDate("not a date")).toBe("");
  });

  it("returns empty string for non-Bandcamp date formats", () => {
    expect(parseDate("2024-03-15")).toBe("");
  });

  it("zero-pads single-digit days", () => {
    expect(parseDate("1 Jan 2020 00:00:00 GMT")).toBe("2020-01-01");
  });

  it("returns empty string for an out-of-range day", () => {
    expect(parseDate("99 Mar 2024 00:00:00 GMT")).toBe("");
    expect(parseDate("00 Jan 2009 00:00:00 GMT")).toBe("");
  });
});
