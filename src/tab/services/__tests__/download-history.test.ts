import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("@/storage", () => ({
  downloadHistoryStore: { get: mocks.get, set: mocks.set },
}));
vi.mock("@/shared/error-handler", () => ({ captureError: vi.fn() }));

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
});
