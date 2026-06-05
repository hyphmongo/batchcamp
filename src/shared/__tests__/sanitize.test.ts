import { describe, expect, it } from "vitest";

import { scrubUrls } from "@/shared/sanitize";

describe("scrubUrls", () => {
  it("rewrites per-install moz-extension origins to a stable placeholder", () => {
    expect(
      scrubUrls(
        "moz-extension://3c5f3a3e-9d6c-4e08-a1b2-1234567890ab/src/tab/index.html",
      ),
    ).toBe("~/src/tab/index.html");
  });

  it("rewrites chrome-extension origins", () => {
    expect(scrubUrls("chrome-extension://abcdef/src/background/index.js")).toBe(
      "~/src/background/index.js",
    );
  });

  it("scrubs https URLs alongside extension URLs in the same string", () => {
    expect(
      scrubUrls(
        "opened moz-extension://uuid-1/tab.html from https://bandcamp.com/coolfan123",
      ),
    ).toBe("opened ~/tab.html from https://bandcamp.com/<redacted>");
  });

  it("returns a scrubbed copy without mutating the input object", () => {
    const input = { url: "https://bandcamp.com/coolfan123" };

    const scrubbed = scrubUrls(input) as { url: string };

    expect(scrubbed.url).toBe("https://bandcamp.com/<redacted>");
    expect(input.url).toBe("https://bandcamp.com/coolfan123");
  });
});
