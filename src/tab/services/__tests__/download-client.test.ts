import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";

import {
  chromeDownloadClient,
  ENCODING_DEADLINE_MS,
  EncodingIncompleteError,
  FilenameRateLimitError,
  firefoxDownloadClient,
  isEncodingPending,
} from "@/tab/services/download-client";

const ALBUM_URL = "https://popplers5.bandcamp.com/download/album?enc=flac";

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

  it("waits out a 503 while Bandcamp encodes the format, then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, headers: { get: () => null } })
      .mockResolvedValueOnce({
        status: 200,
        headers: { get: () => 'attachment; filename="track.flac"' },
      });
    vi.stubGlobal("fetch", fetchMock);

    const pending = chromeDownloadClient.inferFilenameExtension(
      "https://popplers5.bandcamp.com/download/track?enc=flac",
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expect(pending).resolves.toBe(".flac");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("keeps polling a slow encode well past the first few seconds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      status: 503,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = chromeDownloadClient.inferFilenameExtension(
      "https://popplers5.bandcamp.com/download/album?enc=flac",
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(
      EncodingIncompleteError,
    );

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(5);

    await vi.advanceTimersByTimeAsync(ENCODING_DEADLINE_MS);
    await assertion;
    vi.useRealTimers();
  });

  it("throws a rate-limit error on a 429 so the store can retry later", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ headers: { get: () => null }, status: 429 }),
    );

    await expect(
      chromeDownloadClient.inferFilenameExtension(
        "https://bandcamp.com/download/track?token=abc",
      ),
    ).rejects.toBeInstanceOf(FilenameRateLimitError);
  });

  it("treats a 200 with no content-disposition (throttle page) as a retryable rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ headers: { get: () => null }, status: 200 }),
    );

    await expect(
      chromeDownloadClient.inferFilenameExtension(
        "https://bandcamp.com/download/track?token=abc",
      ),
    ).rejects.toBeInstanceOf(FilenameRateLimitError);
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

describe("isEncodingPending", () => {
  it("reports a 503 as an encode still in progress", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 503, headers: { get: () => null } }),
    );

    await expect(isEncodingPending(ALBUM_URL)).resolves.toBe(true);
  });

  it("reports a ready link as not encoding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null } }),
    );

    await expect(isEncodingPending(ALBUM_URL)).resolves.toBe(false);
  });

  it("answers without polling, leaving the wait to the retry schedule", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ status: 503, headers: { get: () => null } });
    vi.stubGlobal("fetch", fetchMock);

    await isEncodingPending(ALBUM_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blames something other than encoding when the probe itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(isEncodingPending(ALBUM_URL)).resolves.toBe(false);
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
