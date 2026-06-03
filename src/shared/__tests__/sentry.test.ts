import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";

import { sanitizeEvent } from "@/shared/sentry";

const run = (event: Partial<ErrorEvent>) => sanitizeEvent(event as ErrorEvent);

describe("sanitizeEvent", () => {
  it("redacts the fan username from a bandcamp page URL", () => {
    const event = run({
      contexts: { page: { url: "https://bandcamp.com/coolfan123" } },
    });

    expect(event.contexts?.page).toEqual({
      url: "https://bandcamp.com/<redacted>",
    });
  });

  it("strips signed tokens from bcbits download URLs in breadcrumbs", () => {
    const event = run({
      breadcrumbs: [
        {
          data: {
            url: "https://p4.bcbits.com/download/album/abc?token=secret&ts=123",
          },
        },
      ],
    });

    expect(event.breadcrumbs?.[0]?.data?.url).toBe(
      "https://p4.bcbits.com/<redacted>",
    );
  });

  it("redacts the request url", () => {
    const event = run({
      request: { url: "https://bandcamp.com/user/private" },
    });

    expect(event.request?.url).toBe("https://bandcamp.com/<redacted>");
  });

  it("drops the user IP address", () => {
    const event = run({ user: { ip_address: "1.2.3.4" } });

    expect(event.user?.ip_address).toBeUndefined();
  });

  it("still rewrites extension stack-frame paths", () => {
    const event = run({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                {
                  filename: "chrome-extension://abcdef/src/content/index.ts",
                },
              ],
            },
          },
        ],
      },
    });

    expect(
      event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename,
    ).toBe("~/src/content/index.ts");
  });

  it("redacts every URL inside a string that contains more than one", () => {
    const event = run({
      message:
        "failed at https://bandcamp.com/fan1 then https://p4.bcbits.com/x?token=t",
    });

    expect(event.message).toBe(
      "failed at https://bandcamp.com/<redacted> then https://p4.bcbits.com/<redacted>",
    );
  });

  it("leaves strings without URLs untouched", () => {
    const event = run({ message: "Download failed: network error" });

    expect(event.message).toBe("Download failed: network error");
  });

  it("scrubs URLs stored in arrays", () => {
    const event = run({
      extra: {
        urls: ["https://bandcamp.com/a", "https://bandcamp.com/b"],
      },
    });

    expect(event.extra?.urls).toEqual([
      "https://bandcamp.com/<redacted>",
      "https://bandcamp.com/<redacted>",
    ]);
  });

  it("redacts a URL-like token that fails to parse rather than leaking it", () => {
    const event = run({ message: "https://%" });

    expect(event.message).toBe("<redacted>");
  });
});
