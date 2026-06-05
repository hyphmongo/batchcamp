import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";

import {
  chromeDownloadClient,
  firefoxDownloadClient,
} from "@/tab/services/download-client";

const downloadMock = browser.downloads.download as ReturnType<typeof vi.fn>;
const sendMessageMock = browser.runtime.sendMessage as ReturnType<typeof vi.fn>;

const stubFetch = (contentDisposition: string | null) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      headers: { get: () => contentDisposition },
      status: 200,
    }),
  );
};

beforeEach(() => {
  downloadMock.mockReset();
  sendMessageMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chromeDownloadClient.inferFilenameExtension", () => {
  it("derives the real extension from the server (a single track is not a .zip)", async () => {
    stubFetch('attachment; filename="Joy Orbison - Hyph Mngo.mp3"');

    const ext = await chromeDownloadClient.inferFilenameExtension(
      "https://bandcamp.com/download/track?token=abc",
    );

    expect(ext).toBe(".mp3");
  });

  it("probes only the first byte instead of downloading the file to read headers", async () => {
    stubFetch('attachment; filename="track.mp3"');

    await chromeDownloadClient.inferFilenameExtension(
      "https://bandcamp.com/download/track?token=abc",
    );

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(init.headers?.Range).toBe("bytes=0-0");
  });

  it("falls back to a full GET when a ranged response omits content-disposition", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ headers: { get: () => null }, status: 206 })
      .mockResolvedValue({
        headers: { get: () => 'attachment; filename="track.flac"' },
        status: 200,
      });
    vi.stubGlobal("fetch", fetchMock);

    const ext = await chromeDownloadClient.inferFilenameExtension(
      "https://bandcamp.com/download/track?token=abc",
    );

    expect(ext).toBe(".flac");
    const secondInit = fetchMock.mock.calls[1]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(secondInit.headers?.Range).toBeUndefined();
  });

  it("retries the header probe once after a transient network error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network hiccup"))
      .mockResolvedValue({
        headers: { get: () => 'attachment; filename="track.mp3"' },
        status: 200,
      });
    vi.stubGlobal("fetch", fetchMock);

    const ext = await chromeDownloadClient.inferFilenameExtension(
      "https://bandcamp.com/download/track?token=abc",
    );

    expect(ext).toBe(".mp3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("derives .zip for an album download", async () => {
    stubFetch('attachment; filename="Album.zip"');

    const ext = await chromeDownloadClient.inferFilenameExtension(
      "https://bandcamp.com/download/album?token=abc",
    );

    expect(ext).toBe(".zip");
  });
});

describe("chromeDownloadClient filename rollback", () => {
  it("unregisters the custom filename when the download fails to start", async () => {
    downloadMock.mockRejectedValueOnce(new Error("blocked by policy"));
    sendMessageMock.mockResolvedValue(undefined);

    await expect(
      chromeDownloadClient.startDownload({
        url: "https://bandcamp.com/download/album?token=abc",
        filename: "Album.zip",
      }),
    ).rejects.toThrow("blocked by policy");

    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: "register-filename",
      url: "https://bandcamp.com/download/album?token=abc",
      filename: "Album.zip",
    });
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: "unregister-filename",
      url: "https://bandcamp.com/download/album?token=abc",
    });
  });
});

describe("firefoxDownloadClient illegal-character fallback", () => {
  it("preserves subdirectories when re-sanitizing illegal characters", async () => {
    downloadMock.mockRejectedValueOnce(
      new Error("illegal characters in filename"),
    );
    downloadMock.mockResolvedValueOnce(2);

    await firefoxDownloadClient.startDownload({
      url: "https://bandcamp.com/download/album?token=abc",
      filename: "Björk/Vespertine.zip",
    });

    expect(downloadMock).toHaveBeenCalledTimes(2);
    const fallbackCall = downloadMock.mock.calls[1]?.[0] as {
      filename: string;
    };
    expect(fallbackCall.filename).toBe("Bj_rk/Vespertine.zip");
  });
});
