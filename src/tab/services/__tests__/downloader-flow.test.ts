import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { createTestHarness } from "@/tab/__tests__/test-harness";
import {
  type DownloadItem,
  resetBrowserAdapter,
  setBrowserAdapter,
} from "@/tab/services/browser-adapter";
import {
  browserDownloadClient,
  type DownloadClient,
} from "@/tab/services/download-client";
import {
  dropProgress,
  getProgress,
  resetProgress,
} from "@/tab/services/download-progress";
import {
  type AwaitCompletion,
  createDownloader,
  savedBytesArePlausible,
} from "@/tab/services/downloader";
import { useStore } from "@/tab/store";
import type { Download } from "@/types";

type Call = { url: string; filename?: string };

const makeRecordingClient = (overrides: Partial<DownloadClient> = {}) => {
  const calls: Call[] = [];
  const client: DownloadClient = {
    async startDownload({ url, filename }) {
      calls.push({ url, filename });
      return 1;
    },
    async inferFilenameExtension() {
      return ".zip";
    },
    ...overrides,
  };
  return { client, calls };
};

const immediateCompletion = () =>
  Effect.succeed({ current: "complete", previous: "in_progress" });

const baseConfig: Configuration = { ...onboardedConfig, downloadArtwork: true };

const setConfig = (overrides: Partial<Configuration> = {}) => {
  useStore.setState({ config: { ...baseConfig, ...overrides } });
};

const makeDownload = (overrides: Partial<Download> = {}): Download => ({
  id: "dl-1",
  url: "https://bandcamp.com/download/track?token=abc",
  artist: "Joy Orbison",
  title: "Hyph Mngo",
  artUrl: "https://f4.bcbits.com/img/a123456_10.jpg",
  format: "mp3-320",
  progress: 0,
  ...overrides,
});

const ZIP_URL = "https://bandcamp.com/download/track?token=abc";
const ART_URL = "https://f4.bcbits.com/img/a123456_10.jpg";

const findCallForUrl = (calls: Call[], url: string) =>
  calls.find((c) => c.url === url);

beforeEach(() => {
  setConfig();
  useStore.setState({
    items: new Map(),
    browserIdToItemId: {},
    downloadToItemId: {},
  });
});

describe("download() — zip filename per template", () => {
  it("template enabled: zip is requested with the templated filename", async () => {
    setConfig({ filenameTemplateEnabled: true });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ZIP_URL)?.filename).toBe(
      "Joy Orbison - Hyph Mngo.zip",
    );
  });

  it("template disabled: zip is requested without a filename (server name wins)", async () => {
    setConfig({ filenameTemplateEnabled: false });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ZIP_URL)?.filename).toBeUndefined();
  });

  it("template enabled: zip extension comes from the client's inferFilenameExtension", async () => {
    setConfig({ filenameTemplateEnabled: true });
    const calls: Call[] = [];
    const flacClient: DownloadClient = {
      async startDownload({ url, filename }) {
        calls.push({ url, filename });
        return 1;
      },
      async inferFilenameExtension() {
        return ".flac";
      },
    };
    const download = createDownloader(flacClient, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ZIP_URL)?.filename).toBe(
      "Joy Orbison - Hyph Mngo.flac",
    );
  });
});

describe("download() — art ↔ zip filename matching", () => {
  it("template enabled: zip and art share the same templated base", async () => {
    setConfig({ filenameTemplateEnabled: true, downloadArtwork: true });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ZIP_URL)?.filename).toBe(
      "Joy Orbison - Hyph Mngo.zip",
    );
    expect(findCallForUrl(calls, ART_URL)?.filename).toBe(
      "Joy Orbison - Hyph Mngo.jpg",
    );
  });

  it("does not download art when downloadArtwork is false", async () => {
    setConfig({ filenameTemplateEnabled: true, downloadArtwork: false });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ART_URL)).toBeUndefined();
  });

  it("ignores a custom template for art naming while the template feature is disabled", async () => {
    setConfig({
      filenameTemplateEnabled: false,
      downloadArtwork: true,
      filenameTemplate: "music/{artist}/{title}",
    });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload());

    expect(findCallForUrl(calls, ART_URL)?.filename).toBe(
      "Joy Orbison - Hyph Mngo.jpg",
    );
  });
});

describe("download() — client errors surface as failed status", () => {
  it("client error on zip surfaces as a failed status, not a thrown promise", async () => {
    setConfig({ filenameTemplateEnabled: false });
    const client: DownloadClient = {
      async startDownload() {
        throw new Error("network error");
      },
      async inferFilenameExtension() {
        return ".zip";
      },
    };
    const download = createDownloader(client, immediateCompletion);

    await expect(download(makeDownload())).resolves.toBe("failed");
  });
});

describe("download() — progress keyed by store item id", () => {
  beforeEach(() => {
    resetProgress();
  });
  afterEach(() => {
    resetProgress();
  });

  it("reports completion bytes under the resolved store item id, not the download id", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "track:mp3-320": "item-9" } });
    const { client } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    await download(makeDownload({ id: "track:mp3-320", sizeMb: 10 }));

    expect(getProgress().bytesReceived).toBe(10 * 1024 * 1024);

    dropProgress("item-9");

    expect(getProgress().bytesReceived).toBe(0);
  });
});

describe("download() — completion before the change subscription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetBrowserAdapter();
  });

  it("resolves promptly when the download already completed (no 30s poll wait)", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.resolveDownloadIds([1]);
    harness.setSearchResults([
      {
        id: 1,
        state: "complete",
        bytesReceived: 5 * 1024 * 1024,
        totalBytes: 5 * 1024 * 1024,
        url: "https://x",
        filename: "f",
      } as unknown as DownloadItem,
    ]);
    setBrowserAdapter(harness.adapter);

    const download = createDownloader(browserDownloadClient);
    let settled: string | null = null;
    void download(makeDownload()).then((s) => {
      settled = s;
    });

    await vi.advanceTimersByTimeAsync(50);

    expect(settled).toBe("completed");
  });

  it("tolerates a download missing from search before its first event", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.resolveDownloadIds([5]);
    harness.setSearchResults([]);
    setBrowserAdapter(harness.adapter);

    const download = createDownloader(browserDownloadClient);
    let settled: string | null = null;
    void download(makeDownload()).then((s) => {
      settled = s;
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBeNull();

    harness.emitDownloadChanged({
      id: 5,
      state: { current: "complete", previous: "in_progress" },
    });
    await vi.advanceTimersByTimeAsync(50);

    expect(settled).toBe("completed");
  });

  it("unsubscribes from download events once settled", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.resolveDownloadIds([6]);
    harness.setSearchResults([]);
    setBrowserAdapter(harness.adapter);

    const download = createDownloader(browserDownloadClient);
    let settled: string | null = null;
    void download(makeDownload()).then((s) => {
      settled = s;
    });
    await vi.advanceTimersByTimeAsync(100);
    harness.emitDownloadChanged({
      id: 6,
      state: { current: "complete", previous: "in_progress" },
    });
    await vi.advanceTimersByTimeAsync(50);

    expect(settled).toBe("completed");
    expect(harness.subscriberCounts.onDownloadChanged()).toBe(0);
  });

  it("fails when the browser download disappears before completing", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.resolveDownloadIds([5]);
    harness.setSearchResults([]);
    setBrowserAdapter(harness.adapter);

    const download = createDownloader(browserDownloadClient);
    let settled: string | null = null;
    void download(makeDownload()).then((s) => {
      settled = s;
    });

    await vi.advanceTimersByTimeAsync(31_000);

    expect(settled).toBe("failed");
  });
});

describe("download() — interrupted retry state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetBrowserAdapter();
  });

  const alwaysInterrupted: AwaitCompletion = () =>
    Effect.succeed({ current: "interrupted", previous: "in_progress" });

  it("treats a completed-but-empty file as failed and retries the link (BATCHCAMP-7H)", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.setSearchResults([
      {
        id: 1,
        state: "complete",
        canResume: false,
        bytesReceived: 0,
        totalBytes: 0,
        url: "https://x",
        filename: "weird-uuid",
      } as unknown as DownloadItem,
    ]);
    setBrowserAdapter(harness.adapter);
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });

    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, immediateCompletion);

    const result = download(makeDownload({ sizeMb: 12 }));
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("failed");
    expect(calls.length).toBeGreaterThan(1);
  });

  it("regenerates the link after same-link retries are exhausted, then completes (BATCHCAMP-7H #3)", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });

    let usedFreshUrl = false;
    const client: DownloadClient = {
      async startDownload({ url }) {
        if (url === "https://fresh") {
          usedFreshUrl = true;
        }
        return 1;
      },
      async inferFilenameExtension() {
        return ".zip";
      },
    };
    const completion: AwaitCompletion = () =>
      Effect.succeed({
        current: usedFreshUrl ? "complete" : "interrupted",
        previous: "in_progress",
      });
    const regenerate = vi.fn(async () => "https://fresh");

    const download = createDownloader(client, completion, regenerate);
    const result = download(makeDownload({ sizeMb: 12 }));
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("completed");
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(usedFreshUrl).toBe(true);
  });

  it("stays failed when the link cannot be regenerated", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });
    const { client } = makeRecordingClient();
    const regenerate = vi.fn(async () => null);

    const download = createDownloader(client, alwaysInterrupted, regenerate);
    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("failed");
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it("retries up to MAX_AUTO_RETRIES on interrupted, then returns 'failed'", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, alwaysInterrupted);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("failed");
    expect(calls).toHaveLength(4);
  });

  it("returns 'completed' as soon as a retry attempt succeeds", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });
    let attempt = 0;
    const flakyCompletion: AwaitCompletion = () => {
      attempt += 1;
      if (attempt < 3) {
        return Effect.succeed({
          current: "interrupted",
          previous: "in_progress",
        });
      }
      return Effect.succeed({
        current: "complete",
        previous: "in_progress",
      });
    };
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, flakyCompletion);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("completed");
    expect(calls).toHaveLength(3);
  });

  it("does NOT auto-retry while the user has paused the item; awaits next state change", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      pausedItemIds: new Set(["item-1"]),
    });

    let attempt = 0;
    const pauseThenResumeCompletion: AwaitCompletion = () => {
      attempt += 1;
      if (attempt === 1) {
        return Effect.succeed({
          current: "interrupted",
          previous: "in_progress",
        });
      }
      useStore.setState({ pausedItemIds: new Set() });
      return Effect.succeed({
        current: "complete",
        previous: "in_progress",
      });
    };

    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, pauseThenResumeCompletion);

    const result = download(makeDownload());

    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("completed");
    expect(calls).toHaveLength(1);
    expect(attempt).toBe(2);
  });

  it("attemptResume skips browser resume when the user has paused mid-retry", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    const originalSearch = harness.adapter.downloads.search;
    harness.adapter.downloads.search = async () => {
      useStore.setState({ pausedItemIds: new Set(["item-1"]) });
      return [
        {
          id: 1,
          state: "interrupted" as const,
          canResume: true,
          bytesReceived: 0,
          totalBytes: 0,
          url: "https://x",
          filename: "f",
          startTime: "0",
        } as unknown as Awaited<ReturnType<typeof originalSearch>>[number],
      ];
    };
    setBrowserAdapter(harness.adapter);

    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      browserIdToItemId: { 1: "item-1" },
      pausedItemIds: new Set(),
    });

    const { client } = makeRecordingClient();
    const download = createDownloader(client, alwaysInterrupted);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);
    await result;

    expect(harness.recorded.resume).toEqual([]);

    resetBrowserAdapter();
  });

  it("does not auto-retry once the item has been cancelled (removed from store)", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      pausedItemIds: new Set(),
    });

    let attempt = 0;
    const cancelledThenInterrupted: AwaitCompletion = () => {
      attempt += 1;
      if (attempt === 1) {
        useStore.setState({ downloadToItemId: {} });
      }
      return Effect.succeed({
        current: "interrupted",
        previous: "in_progress",
      });
    };

    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, cancelledThenInterrupted);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("failed");
    expect(calls).toHaveLength(1);
  });

  it("starts a fresh download when the interrupted one cannot resume", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.setSearchResults([
      {
        id: 1,
        state: "interrupted",
        canResume: false,
        bytesReceived: 5 * 1024 * 1024,
        totalBytes: 5 * 1024 * 1024,
        url: "https://x",
        filename: "f",
      } as unknown as DownloadItem,
    ]);
    setBrowserAdapter(harness.adapter);
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      browserIdToItemId: { 1: "item-1" },
      pausedItemIds: new Set(),
    });

    let awaitCalls = 0;
    const interruptedOnce: AwaitCompletion = () => {
      awaitCalls += 1;
      return Effect.succeed({
        current: awaitCalls < 2 ? "interrupted" : "complete",
        previous: "in_progress",
      });
    };
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, interruptedOnce);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("completed");
    expect(harness.recorded.resume).toEqual([]);
    expect(calls).toHaveLength(2);

    resetBrowserAdapter();
  });

  it("waits the full exponential backoff between retries", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });
    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, alwaysInterrupted);

    void download(makeDownload());
    await vi.advanceTimersByTimeAsync(4_000);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toHaveLength(3);
  });

  it("backs off while a paused download stays interrupted instead of re-polling continuously", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      pausedItemIds: new Set(["item-1"]),
    });

    let calls = 0;
    const pausedSnapshot: AwaitCompletion = () => {
      calls += 1;
      const paused = useStore.getState().pausedItemIds.size > 0;
      return Effect.promise(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                current: paused ? "interrupted" : "complete",
                previous: "in_progress",
              });
            }, 10);
          }),
      );
    };

    const { client } = makeRecordingClient();
    const download = createDownloader(client, pausedSnapshot);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBeLessThan(50);

    useStore.setState({ pausedItemIds: new Set() });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(result).resolves.toBe("completed");
  });

  it("registers each retry's browser id so cancel and pause target the live download", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const dl = makeDownload();
    useStore.setState({
      items: new Map([
        [
          "item-1",
          { id: "item-1", status: "downloading", title: "T", download: dl },
        ],
      ]),
      downloadToItemId: { "dl-1": "item-1" },
      browserIdToItemId: {},
      pausedItemIds: new Set(),
    });

    let nextId = 0;
    const calls: Call[] = [];
    const client: DownloadClient = {
      async startDownload({ url, filename }) {
        calls.push({ url, filename });
        nextId += 1;
        return nextId;
      },
      async inferFilenameExtension() {
        return ".zip";
      },
    };
    const download = createDownloader(client, alwaysInterrupted);

    const result = download(dl);
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBe("failed");
    expect(calls).toHaveLength(4);
    expect(useStore.getState().browserIdToItemId).toHaveProperty("4", "item-1");
  });

  it("does not start a new download in the same attempt after a successful resume", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    const harness = createTestHarness();
    harness.setSearchResults([
      {
        id: 1,
        state: "interrupted",
        canResume: true,
        bytesReceived: 0,
        totalBytes: 0,
        url: "https://x",
        filename: "f",
      } as unknown as DownloadItem,
    ]);
    setBrowserAdapter(harness.adapter);
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      browserIdToItemId: { 1: "item-1" },
      pausedItemIds: new Set(),
    });

    let awaitCalls = 0;
    const failingAfterResume: AwaitCompletion = () => {
      awaitCalls += 1;
      if (awaitCalls === 1) {
        return Effect.succeed({
          current: "interrupted",
          previous: "in_progress",
        });
      }
      return Effect.tryPromise({
        try: () => Promise.reject(new Error("await failed")),
        catch: (cause) => cause,
      }) as unknown as ReturnType<AwaitCompletion>;
    };

    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, failingAfterResume);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBe("failed");
    expect(harness.recorded.resume).toEqual([1]);
    expect(calls).toHaveLength(3);

    resetBrowserAdapter();
  });

  it("stops retrying when the item is cancelled between attempts", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({
      downloadToItemId: { "dl-1": "item-1" },
      pausedItemIds: new Set(),
    });

    let awaitCalls = 0;
    const cancelDuringRetry: AwaitCompletion = () => {
      awaitCalls += 1;
      if (awaitCalls === 2) {
        useStore.setState({ downloadToItemId: {} });
      }
      return Effect.succeed({
        current: "interrupted",
        previous: "in_progress",
      });
    };

    const { client, calls } = makeRecordingClient();
    const download = createDownloader(client, cancelDuringRetry);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(result).resolves.toBe("failed");
    expect(calls).toHaveLength(2);
  });

  it("treats a thrown error during retry as an interrupted attempt and keeps retrying", async () => {
    setConfig({ filenameTemplateEnabled: false, downloadArtwork: false });
    useStore.setState({ downloadToItemId: { "dl-1": "item-1" } });
    let attempt = 0;
    const calls: Call[] = [];
    const client: DownloadClient = {
      async startDownload({ url, filename }) {
        attempt += 1;
        calls.push({ url, filename });
        if (attempt === 2) {
          throw new Error("transient network error");
        }
        return attempt;
      },
      async inferFilenameExtension() {
        return ".zip";
      },
    };
    const download = createDownloader(client, alwaysInterrupted);

    const result = download(makeDownload());
    await vi.advanceTimersByTimeAsync(40_000);

    await expect(result).resolves.toBe("failed");
    expect(calls).toHaveLength(4);
  });
});

describe("savedBytesArePlausible (BATCHCAMP-7H)", () => {
  it("rejects a zero-byte file", () => {
    expect(
      savedBytesArePlausible(
        { bytesReceived: 0 } as DownloadItem,
        makeDownload({ sizeMb: 10 }),
      ),
    ).toBe(false);
  });

  it("rejects a file far below the expected size", () => {
    expect(
      savedBytesArePlausible(
        { bytesReceived: 2000 } as DownloadItem,
        makeDownload({ sizeMb: 10 }),
      ),
    ).toBe(false);
  });

  it("accepts a file near the expected size", () => {
    expect(
      savedBytesArePlausible(
        { bytesReceived: 10 * 1024 * 1024 } as DownloadItem,
        makeDownload({ sizeMb: 10 }),
      ),
    ).toBe(true);
  });

  it("uses an absolute floor when the expected size is unknown", () => {
    const dl = makeDownload({ sizeMb: undefined });
    expect(
      savedBytesArePlausible({ bytesReceived: 10 } as DownloadItem, dl),
    ).toBe(false);
    expect(
      savedBytesArePlausible(
        { bytesReceived: 5 * 1024 * 1024 } as DownloadItem,
        dl,
      ),
    ).toBe(true);
  });

  it("assumes plausible when the download cannot be found", () => {
    expect(savedBytesArePlausible(undefined, makeDownload())).toBe(true);
  });
});
