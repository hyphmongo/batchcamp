import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/storage", () => ({
  downloadHistoryStore: { get: mocks.get, set: mocks.set },
}));
vi.mock("@/shared/error-handler", () => ({ captureError: vi.fn() }));
vi.mock("@/shared/analytics", () => ({ track: mocks.track }));

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
  it("reports and self-heals a history load failure", async () => {
    mocks.track.mockClear();
    mocks.get.mockRejectedValueOnce(
      Object.assign(new Error("nope"), { name: "StorageError" }),
    );

    await expect(loadHistoryCache()).rejects.toThrow("nope");

    expect(mocks.track).toHaveBeenCalledWith("history_load_failed", {
      error_name: "StorageError",
    });
  });

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
    mocks.track.mockClear();
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
    expect(mocks.track).toHaveBeenCalledWith("history_write_failed", {
      error_name: "QuotaExceededError",
    });
  });

  it("persists periodically during a continuous run instead of waiting for a pause", async () => {
    vi.useFakeTimers();
    mocks.set.mockClear();
    mocks.set.mockResolvedValue(undefined);
    resetHistoryCache();

    for (let i = 0; i < 12; i++) {
      await addToDownloadHistory(`${i}:mp3-320`);
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(mocks.set.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("re-arms the throttle after a flush so a later run is not lost", async () => {
    vi.useFakeTimers();
    mocks.set.mockClear();
    mocks.set.mockResolvedValue(undefined);
    resetHistoryCache();

    for (let i = 0; i < 12; i++) {
      await addToDownloadHistory(`a${i}:mp3-320`);
      await vi.advanceTimersByTimeAsync(1000);
    }
    const afterFirstRun = mocks.set.mock.calls.length;
    expect(afterFirstRun).toBeGreaterThan(0);

    for (let i = 0; i < 12; i++) {
      await addToDownloadHistory(`b${i}:mp3-320`);
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(mocks.set.mock.calls.length).toBeGreaterThan(afterFirstRun);
  });

  it("persists the full accumulated set of release ids, not a stale subset", async () => {
    vi.useFakeTimers();
    mocks.set.mockClear();
    mocks.set.mockResolvedValue(undefined);
    resetHistoryCache();

    await addToDownloadHistory("a:mp3-320");
    await addToDownloadHistory("b:mp3-320");
    await addToDownloadHistory("c:flac");
    flushHistory();
    await vi.advanceTimersByTimeAsync(0);

    const lastCall = mocks.set.mock.calls.at(-1)?.[0] as {
      downloadedIds: string[];
    };
    expect(lastCall.downloadedIds).toEqual(
      expect.arrayContaining(["a", "b", "c"]),
    );
  });

  it("serializes overlapping flushes and re-writes the latest snapshot", async () => {
    vi.useRealTimers();
    mocks.set.mockClear();
    const resolvers: Array<() => void> = [];
    mocks.set.mockImplementation(
      () => new Promise<void>((resolve) => resolvers.push(() => resolve())),
    );
    resetHistoryCache();

    await addToDownloadHistory("x:mp3-320");
    flushHistory();
    await addToDownloadHistory("y:mp3-320");
    flushHistory();
    expect(mocks.set).toHaveBeenCalledTimes(1);

    resolvers[0]?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[0]?.[0]).toEqual({ downloadedIds: ["x"] });
    expect(mocks.set.mock.calls[1]?.[0]).toEqual({ downloadedIds: ["x", "y"] });
    resolvers[1]?.();
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
