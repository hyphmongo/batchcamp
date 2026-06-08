import { describe, expect, it } from "vitest";

import {
  sanitizeFilename,
  sanitizePath,
} from "@/tab/services/downloader-utils";

const isAbsolute = (name: string): boolean =>
  name.startsWith("/") ||
  name.startsWith("\\") ||
  /^[a-zA-Z]:/.test(name) ||
  name.split("/").includes("..");

describe("sanitizePath never yields an absolute path (BATCHCAMP-6M)", () => {
  it.each([
    "/Music/Album.zip",
    "/etc/passwd.zip",
    "//leading/double.zip",
    "../../escape.zip",
    "/{artist}/{title}.zip",
  ])("strips absolute/traversal markers from %s", (input) => {
    expect(isAbsolute(sanitizePath(input))).toBe(false);
  });

  it("keeps intended subdirectories while dropping the leading slash", () => {
    expect(sanitizePath("/Artist/Album.zip")).toBe("Artist/Album.zip");
  });
});

describe("sanitizeFilename never yields an absolute path (BATCHCAMP-6M)", () => {
  it.each([
    "/abs/name.zip",
    "C:\\Windows\\name.zip",
    "\\\\server\\share.zip",
  ])("neutralizes %s", (input) => {
    expect(isAbsolute(sanitizeFilename(input))).toBe(false);
  });
});
