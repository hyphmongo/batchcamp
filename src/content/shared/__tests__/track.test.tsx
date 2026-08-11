import { afterEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";
import { trackFromContent } from "@/content/shared/track";
import { parseMessage } from "@/messages";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reporting a content-script event", () => {
  it("hands the event to the background worker rather than sending it itself", () => {
    const send = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockResolvedValue(undefined);

    trackFromContent("bc_download_clicked", { source: "cart-download" });

    expect(send).toHaveBeenCalledWith({
      type: "track-content-event",
      event: "bc_download_clicked",
      properties: { source: "cart-download" },
    });
  });

  it("sends something the background will actually accept", () => {
    const send = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockResolvedValue(undefined);

    trackFromContent("bc_format_opened");

    expect(parseMessage(send.mock.calls[0]?.[0])).toMatchObject({
      type: "track-content-event",
      event: "bc_format_opened",
    });
  });

  it("stays silent when the background worker is asleep", async () => {
    vi.spyOn(browser.runtime, "sendMessage").mockRejectedValue(
      new Error("no receiving end"),
    );

    expect(() => trackFromContent("bc_select_all_clicked")).not.toThrow();
    await Promise.resolve();
  });
});
