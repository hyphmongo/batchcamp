import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseStatResponse,
  queryStatDownload,
  toStatUrl,
} from "@/tab/services/statdownload";

const DOWNLOAD_URL =
  "https://popplers5.bandcamp.com/download/track?enc=flac&id=123&sig=abc&sitem_id=456";

const jsonp = (payload: string) =>
  `if (window.Downloads) { Downloads.statResult(${payload}) };`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toStatUrl", () => {
  it("points a download link at the readiness endpoint, keeping its credentials", () => {
    const url = new URL(toStatUrl(DOWNLOAD_URL) ?? "");

    expect(url.pathname).toBe("/statdownload/track");
    expect(url.host).toBe("popplers5.bandcamp.com");
    expect(url.searchParams.get("enc")).toBe("flac");
    expect(url.searchParams.get("id")).toBe("123");
    expect(url.searchParams.get("sig")).toBe("abc");
    expect(url.searchParams.get("sitem_id")).toBe("456");
  });

  it("busts the cache so a stale verdict cannot be replayed", () => {
    const first = new URL(toStatUrl(DOWNLOAD_URL) ?? "");
    const second = new URL(toStatUrl(DOWNLOAD_URL) ?? "");

    expect(first.searchParams.get(".vrs")).toBe("1");
    expect(first.searchParams.get(".rand")).not.toBe(
      second.searchParams.get(".rand"),
    );
  });

  it("keeps album links pointed at the album endpoint", () => {
    const url = toStatUrl(DOWNLOAD_URL.replace("/track?", "/album?"));

    expect(new URL(url ?? "").pathname).toBe("/statdownload/album");
  });

  it("declines a url that is not a download link", () => {
    expect(toStatUrl("https://p4.bcbits.com/stream/abc")).toBeNull();
    expect(toStatUrl("not a url")).toBeNull();
  });
});

describe("parseStatResponse", () => {
  it("reads a ready verdict", () => {
    const body = jsonp(
      '{"result":"ok","download_url":"https://p4.bcbits.com/x"}',
    );

    expect(parseStatResponse(body)).toEqual({ _tag: "Ready" });
  });

  it("surfaces the error type bandcamp gives for a dead link", () => {
    const body = jsonp(
      '{"result":"err","errortype":"ExpirationError","retry_url":""}',
    );

    expect(parseStatResponse(body)).toEqual({
      _tag: "Rejected",
      errortype: "ExpirationError",
    });
  });

  it("names an unlabelled rejection rather than dropping it", () => {
    expect(parseStatResponse(jsonp('{"result":"err"}'))).toEqual({
      _tag: "Rejected",
      errortype: "unknown",
    });
  });

  it("gives up on a body that is not the callback we expect", () => {
    expect(parseStatResponse("<html>nope</html>")).toEqual({
      _tag: "Unreadable",
    });
    expect(parseStatResponse(jsonp("{oops"))).toEqual({ _tag: "Unreadable" });
  });
});

describe("queryStatDownload", () => {
  it("reports the verdict for a live link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ text: async () => jsonp('{"result":"ok"}') }),
    );

    await expect(queryStatDownload(DOWNLOAD_URL)).resolves.toEqual({
      _tag: "Ready",
    });
  });

  it("stays quiet when the diagnosis itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(queryStatDownload(DOWNLOAD_URL)).resolves.toEqual({
      _tag: "Unreadable",
    });
  });

  it("does not call out at all for a url it cannot convert", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryStatDownload("not a url")).resolves.toEqual({
      _tag: "Unreadable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
