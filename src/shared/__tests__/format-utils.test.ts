import { describe, expect, it } from "vitest";

import { formatSizeMb } from "@/shared/format-utils";

describe("formatSizeMb", () => {
  it("renders values under 1024 MB as rounded mb", () => {
    expect(formatSizeMb(150.4)).toBe("150 mb");
    expect(formatSizeMb(1023)).toBe("1023 mb");
  });

  it("renders values of 1024 MB or more as gb with one decimal", () => {
    expect(formatSizeMb(1024)).toBe("1.0 gb");
    expect(formatSizeMb(2560)).toBe("2.5 gb");
  });
});
