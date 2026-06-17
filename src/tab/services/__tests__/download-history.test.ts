import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("@/storage", () => ({
  downloadHistoryStore: { get: mocks.get, set: mocks.set },
}));
vi.mock("@/shared/error-handler", () => ({ captureError: vi.fn() }));

const { captureError } = await import("@/shared/error-handler");
const {
  addToDownloadHistory,
  flushHistory,
  loadHistoryCache,
  resetHistoryCache,
} = await import("@/tab/services/download-history");

afterEach(() => {
  vi.useRealTimers();
});

describe("download history", () => {
  it("concurrent first loads share one cache so early adds are not lost", async () => {
    let resolveGet: (value: { downloadedIds: string[] }) => void = () => {};
    mocks.get.mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      }),
    );

    const loadA = loadHistoryCache();
    const loadB = loadHistoryCache();
    resolveGet({ downloadedIds: [] });
    const [cacheA, cacheB] = await Promise.all([loadA, loadB]);

    expect(cacheA).toBe(cacheB);
  });

  it("an explicit flush cancels the pending debounce flush", async () => {
    vi.useFakeTimers();
    mocks.set.mockResolvedValue(undefined);
    resetHistoryCache();

    await addToDownloadHistory("123:mp3-320");
    flushHistory();
    expect(mocks.set).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.set).toHaveBeenCalledTimes(1);
  });

  it("returns null for a release already in history regardless of format", async () => {
    resetHistoryCache();

    const first = await addToDownloadHistory("999:mp3-320");
    const second = await addToDownloadHistory("999:flac");

    expect(first).toBe(1);
    expect(second).toBeNull();
  });

  it("retries the flush once, then reports with the underlying error name when the write keeps failing", async () => {
    vi.useFakeTimers();
    vi.mocked(captureError).mockClear();
    mocks.set.mockClear();
    const failure = Object.assign(new Error("An unexpected error occurred"), {
      name: "QuotaExceededError",
    });
    mocks.set.mockRejectedValue(failure);
    resetHistoryCache();
    await addToDownloadHistory("777:mp3-320");

    expect(() => flushHistory()).not.toThrow();
    expect(mocks.set).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);

    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(captureError).toHaveBeenCalledTimes(1);
    expect(captureError).toHaveBeenCalledWith(
      failure,
      { history: { count: 1 } },
      { operation: "flush_download_history", error_name: "QuotaExceededError" },
    );
  });

  it("recovers silently when the first flush write fails but the retry succeeds", async () => {
    vi.useFakeTimers();
    vi.mocked(captureError).mockClear();
    mocks.set.mockClear();
    mocks.set
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(undefined);
    resetHistoryCache();
    await addToDownloadHistory("888:mp3-320");

    flushHistory();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(captureError).not.toHaveBeenCalled();
  });
});
