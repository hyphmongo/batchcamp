import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releaseIdOf } from "@/shared/id";
import { downloadHistoryStore } from "@/storage";
import { resetHistoryCache } from "@/tab/services/download-history";
import { useStore } from "@/tab/store";
import type { Download, Item, ResolvedItem } from "@/types";

vi.mock("../../shared/error-handler", () => ({
  captureError: vi.fn(),
}));

vi.mock("../../storage", () => ({
  DEFAULT_CONFIG: { format: "mp3-320", concurrency: 3, hasOnboarded: false },
  migrateLegacyStorage: vi.fn().mockResolvedValue(undefined),
  configurationStore: {
    get: vi.fn().mockResolvedValue({}),
    watch: vi.fn(() => () => {}),
  },
  downloadHistoryStore: {
    get: vi.fn().mockResolvedValue({ downloadedIds: [] }),
    set: vi.fn().mockResolvedValue(undefined),
    watch: vi.fn(() => () => {}),
  },
}));

const FORMAT = "mp3-320";
const k = (id: string) => `${id}:${FORMAT}`;

const makePending = (id: string, url = "https://bc.com"): Item =>
  ({ id, title: `Item ${id}`, status: "pending", url }) as Item;

const makeDownload = (id: string): Download => ({
  id: k(id),
  title: `Artist - Download ${id}`,
  artist: "Artist",
  progress: 0,
  url: `https://dl.com/${id}`,
  format: FORMAT,
});

beforeEach(() => {
  useStore.setState({
    items: new Map(),
    progress: {},
    downloadToItemId: {},
    browserIdToItemId: {},
    rateLimitRetries: new Map(),
    config: {
      format: FORMAT,
      concurrency: 3,
      hasOnboarded: false,
      downloadArtwork: true,
      filenameTemplate: "{artist} - {title}",
      filenameTemplateEnabled: false,
      analyticsEnabled: true,
      crashReportsEnabled: true,
    },
  });
});

describe("addPendingItems", () => {
  it("adds new items to the store", () => {
    useStore.getState().addPendingItems([makePending("1"), makePending("2")]);

    expect(useStore.getState().items.size).toBe(2);
    expect(useStore.getState().items.get(k("1"))?.status).toBe("pending");
  });

  it("skips duplicate items by id", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.getState().addPendingItems([makePending("1"), makePending("2")]);

    expect(useStore.getState().items.size).toBe(2);
  });

  it("does not reset an in-flight item that is re-sent from the page", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.getState().updateItemStatus(k("1"), "downloading");

    useStore.getState().addPendingItems([makePending("1")]);

    expect(useStore.getState().items.get(k("1"))?.status).toBe("downloading");
  });

  it("forces status to pending regardless of input status", () => {
    const item = { ...makePending("1"), status: "completed" } as Item;
    useStore.getState().addPendingItems([item]);

    expect(useStore.getState().items.get(k("1"))?.status).toBe("pending");
  });

  it("creates separate rows for the same bandcamp id in different formats", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.setState({
      ...useStore.getState(),
      config: { ...useStore.getState().config, format: "flac" },
    });
    useStore.getState().addPendingItems([makePending("1")]);

    expect(useStore.getState().items.size).toBe(2);
    expect(useStore.getState().items.has("1:mp3-320")).toBe(true);
    expect(useStore.getState().items.has("1:flac")).toBe(true);
  });
});

describe("updateItemStatus", () => {
  it("updates the status of an existing item", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.getState().updateItemStatus(k("1"), "queued");

    expect(useStore.getState().items.get(k("1"))?.status).toBe("queued");
  });

  it("records history only when an item completes", async () => {
    useStore.setState({ downloadHistoryCount: 0 });
    useStore.getState().addPendingItems([makePending("1")]);

    useStore.getState().updateItemStatus(k("1"), "queued");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(useStore.getState().downloadHistoryCount).toBe(0);
  });

  it("does nothing for a nonexistent item", () => {
    useStore.getState().updateItemStatus("missing", "queued");

    expect(useStore.getState().items.size).toBe(0);
  });

  it("sets progress to 100 when single item is completed", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "completed");

    const item = useStore.getState().items.get(k("1")) as ResolvedItem;
    expect(item.download.progress).toBe(100);
  });
});

describe("updateItemWithSingleDownload", () => {
  it("transforms pending item to single with download", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    const dl = makeDownload("d1");
    useStore.getState().updateItemWithSingleDownload(k("1"), dl);

    const item = useStore.getState().items.get(k("1")) as ResolvedItem;
    expect(item.status).toBe("resolved");
    expect(item.download.id).toBe(k("d1"));
  });

  it("adds download-to-item mapping", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));

    expect(useStore.getState().downloadToItemId[k("d1")]).toBe(k("1"));
  });

  it("does nothing for a nonexistent item", () => {
    useStore
      .getState()
      .updateItemWithSingleDownload("missing", makeDownload("d1"));

    expect(useStore.getState().items.size).toBe(0);
    expect(useStore.getState().downloadToItemId[k("d1")]).toBeUndefined();
  });
});

describe("updateItemWithMultipleDownloads", () => {
  it("replaces the pending item with one resolved item per download", () => {
    useStore.getState().addPendingItems([makePending("album")]);
    useStore
      .getState()
      .updateItemWithMultipleDownloads(k("album"), [
        makeDownload("t1"),
        makeDownload("t2"),
        makeDownload("t3"),
      ]);

    const items = useStore.getState().items;
    expect(items.has(k("album"))).toBe(false);
    expect(items.size).toBe(3);
    const map = useStore.getState().downloadToItemId;
    const t1 = items.get(map[k("t1")]!) as ResolvedItem;
    const t3 = items.get(map[k("t3")]!) as ResolvedItem;
    expect(t1.download.id).toBe(k("t1"));
    expect(t3.status).toBe("resolved");
  });

  it("creates download-to-item mappings for each release", () => {
    useStore.getState().addPendingItems([makePending("album")]);
    useStore
      .getState()
      .updateItemWithMultipleDownloads(k("album"), [
        makeDownload("t1"),
        makeDownload("t2"),
      ]);

    const items = useStore.getState().items;
    const map = useStore.getState().downloadToItemId;
    expect(items.has(map[k("t1")]!)).toBe(true);
    expect(items.has(map[k("t2")]!)).toBe(true);
    expect(map[k("t1")]).not.toBe(map[k("t2")]);
  });

  it("collapses duplicate downloads sharing one download id into a single item", () => {
    useStore.getState().addPendingItems([makePending("album")]);
    useStore
      .getState()
      .updateItemWithMultipleDownloads(k("album"), [
        makeDownload("t1"),
        makeDownload("t1"),
        makeDownload("t2"),
      ]);

    expect(useStore.getState().items.size).toBe(2);
  });

  it("keeps the purchase's release id on every split item so history matches the page", () => {
    useStore.getState().addPendingItems([makePending("album")]);
    useStore
      .getState()
      .updateItemWithMultipleDownloads(k("album"), [
        makeDownload("t1"),
        makeDownload("t2"),
      ]);

    const ids = [...useStore.getState().items.keys()];
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(releaseIdOf(id)).toBe("album");
    }
  });

  it("does nothing for a nonexistent item", () => {
    useStore
      .getState()
      .updateItemWithMultipleDownloads("missing", [makeDownload("t1")]);

    expect(useStore.getState().items.size).toBe(0);
  });
});

describe("updateDownloadBrowserId", () => {
  it("sets item status to downloading and records browser id", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);

    const item = useStore.getState().items.get(k("1")) as ResolvedItem;
    expect(item.status).toBe("downloading");
    expect(item.download.browserId).toBe(42);
  });

  it("adds browser-id-to-item mapping", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);

    expect(useStore.getState().browserIdToItemId[42]).toBe(k("1"));
  });

  it("does not write browser-id mapping when browserId is undefined", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), undefined);

    const item = useStore.getState().items.get(k("1")) as ResolvedItem;
    expect(item.status).toBe("downloading");
    expect(item.download.browserId).toBeUndefined();
    expect(Object.keys(useStore.getState().browserIdToItemId)).toHaveLength(0);
  });
});

describe("retryDownload", () => {
  it("re-queues a parse-stage failure (no download) back to pending", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.getState().updateItemStatus(k("1"), "failed");

    useStore.getState().retryDownload(k("1"));

    expect(useStore.getState().items.get(k("1"))?.status).toBe("pending");
  });

  it("clears the item from pausedItemIds on retry", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "failed");
    useStore.getState().setItemPaused(k("1"), true);

    useStore.getState().retryDownload(k("1"));

    expect(useStore.getState().pausedItemIds.has(k("1"))).toBe(false);
  });

  it("resets a failed single item to pending with cleared progress", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);
    useStore.getState().updateItemStatus(k("1"), "failed");

    useStore.getState().retryDownload(k("1"));

    const item = useStore.getState().items.get(k("1")) as ResolvedItem;
    expect(item.status).toBe("pending");
    expect(item.download.progress).toBe(0);
    expect(item.download.browserId).toBeUndefined();
  });

  it("cleans up browser id mapping on retry", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);
    useStore.getState().updateItemStatus(k("1"), "failed");

    useStore.getState().retryDownload(k("1"));

    expect(useStore.getState().browserIdToItemId[42]).toBeUndefined();
  });

  it("cleans up download-to-item mapping on single retry", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "failed");

    useStore.getState().retryDownload(k("1"));

    expect(useStore.getState().downloadToItemId[k("d1")]).toBeUndefined();
  });

  it("does nothing for non-failed items", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "completed");

    useStore.getState().retryDownload(k("1"));

    expect(useStore.getState().items.get(k("1"))?.status).toBe("completed");
  });

  it("re-queues a failed flattened release to resolved (no re-parse)", () => {
    useStore.getState().addPendingItems([makePending("album")]);
    useStore
      .getState()
      .updateItemWithMultipleDownloads(k("album"), [
        makeDownload("c1"),
        makeDownload("c2"),
      ]);
    const childId = useStore.getState().downloadToItemId[k("c1")]!;
    useStore.getState().updateDownloadBrowserId(k("c1"), 99);
    useStore.getState().updateItemStatus(childId, "failed");

    useStore.getState().retryDownload(childId);

    const child = useStore.getState().items.get(childId) as ResolvedItem;
    expect(child.status).toBe("resolved");
    expect(child.download.progress).toBe(0);
    expect(child.download.browserId).toBeUndefined();
    expect(useStore.getState().browserIdToItemId[99]).toBeUndefined();
  });
});

describe("updateItemDownloadProgress", () => {
  it("records live progress in the overlay", () => {
    useStore.getState().updateItemDownloadProgress(k("1"), 75);

    expect(useStore.getState().progress[k("1")]).toBe(75);
  });

  it("keeps the items Map reference stable across progress updates", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    const itemsRef = useStore.getState().items;

    useStore.getState().updateItemDownloadProgress(k("1"), 40);
    useStore.getState().updateItemDownloadProgress(k("1"), 80);

    expect(useStore.getState().items).toBe(itemsRef);
  });

  it("does not churn state when the progress value is unchanged", () => {
    useStore.getState().updateItemDownloadProgress(k("1"), 50);
    const stateRef = useStore.getState();

    useStore.getState().updateItemDownloadProgress(k("1"), 50);

    expect(useStore.getState()).toBe(stateRef);
  });
});

describe("cancelDownload", () => {
  it("removes a single item from the store", async () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));

    await useStore.getState().cancelDownload(k("1"));

    expect(useStore.getState().items.has(k("1"))).toBe(false);
  });

  it("removes the cancelled id from pausedItemIds", async () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().setItemPaused(k("1"), true);

    await useStore.getState().cancelDownload(k("1"));

    expect(useStore.getState().pausedItemIds.has(k("1"))).toBe(false);
  });

  it("cleans up download mappings on cancel", async () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);

    await useStore.getState().cancelDownload(k("1"));

    expect(useStore.getState().downloadToItemId[k("d1")]).toBeUndefined();
    expect(useStore.getState().browserIdToItemId[42]).toBeUndefined();
  });

  it("cancels a pending item before download is attached", async () => {
    useStore.getState().addPendingItems([makePending("1")]);

    await useStore.getState().cancelDownload(k("1"));

    expect(useStore.getState().items.has(k("1"))).toBe(false);
  });

  it("does nothing for a nonexistent item", async () => {
    await useStore.getState().cancelDownload("missing");

    expect(useStore.getState().items.size).toBe(0);
  });
});

describe("clearAllCompleted", () => {
  it("removes cleared ids from pausedItemIds", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "completed");
    useStore.getState().setItemPaused(k("1"), true);

    useStore.getState().clearAllCompleted();

    expect(useStore.getState().pausedItemIds.has(k("1"))).toBe(false);
  });

  it("removes a completed single item and cleans its index maps", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateDownloadBrowserId(k("d1"), 42);
    useStore.getState().updateItemStatus(k("1"), "completed");

    useStore.getState().clearAllCompleted();

    expect(useStore.getState().items.has(k("1"))).toBe(false);
    expect(useStore.getState().downloadToItemId[k("d1")]).toBeUndefined();
    expect(useStore.getState().browserIdToItemId[42]).toBeUndefined();
  });

  it("keeps items that are not completed", () => {
    useStore
      .getState()
      .addPendingItems([makePending("done"), makePending("busy")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("done"), makeDownload("d-done"));
    useStore.getState().updateItemStatus(k("done"), "completed");
    useStore.getState().updateItemStatus(k("busy"), "downloading");

    useStore.getState().clearAllCompleted();

    expect(useStore.getState().items.has(k("done"))).toBe(false);
    expect(useStore.getState().items.has(k("busy"))).toBe(true);
  });

  it("does nothing when there are no completed items", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore.getState().updateItemStatus(k("1"), "downloading");

    useStore.getState().clearAllCompleted();

    expect(useStore.getState().items.has(k("1"))).toBe(true);
  });
});

describe("download history flow", () => {
  beforeEach(() => {
    resetHistoryCache();
    useStore.setState({ historyCleared: false, downloadHistoryCount: 0 });
  });

  it("bumps downloadHistoryCount when a top-level item completes", async () => {
    const id = "hist-bump";
    useStore.getState().addPendingItems([makePending(id)]);
    useStore.getState().updateItemWithSingleDownload(k(id), makeDownload(id));

    useStore.getState().updateItemStatus(k(id), "completed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useStore.getState().downloadHistoryCount).toBe(1);
  });

  it("dedupes the same release downloaded in two different formats", async () => {
    const id = "hist-dedupe";
    useStore.getState().addPendingItems([
      {
        id,
        title: `Item ${id}`,
        status: "pending",
        url: "https://x",
        format: "mp3-320",
      },
    ]);
    useStore
      .getState()
      .updateItemWithSingleDownload(`${id}:mp3-320`, makeDownload("dl1"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    const before = useStore.getState().downloadHistoryCount;

    useStore.getState().updateItemStatus(`${id}:mp3-320`, "completed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    useStore.getState().addPendingItems([
      {
        id,
        title: `Item ${id}`,
        status: "pending",
        url: "https://x",
        format: "flac",
      },
    ]);
    useStore
      .getState()
      .updateItemWithSingleDownload(`${id}:flac`, makeDownload("dl2"));
    useStore.getState().updateItemStatus(`${id}:flac`, "completed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useStore.getState().downloadHistoryCount).toBe(before + 1);
  });

  it("clears historyCleared when a new completion arrives after a clear", async () => {
    const id = `hist-clear-${Math.random()}`;
    useStore.setState({ historyCleared: true });
    useStore.getState().addPendingItems([makePending(id)]);
    useStore.getState().updateItemWithSingleDownload(k(id), makeDownload(id));

    useStore.getState().updateItemStatus(k(id), "completed");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useStore.getState().historyCleared).toBe(false);
  });

  it("clearDownloadHistory resets the count and sets historyCleared", () => {
    useStore.setState({ downloadHistoryCount: 5, historyCleared: false });

    useStore.getState().clearDownloadHistory();

    expect(useStore.getState().downloadHistoryCount).toBe(0);
    expect(useStore.getState().historyCleared).toBe(true);
  });

  it("counts history by bandcampId, collapsing per-format duplicates", () => {
    const unsubscribe = useStore.getState().initializeDownloadHistory();

    const watch = downloadHistoryStore.watch as ReturnType<typeof vi.fn>;
    const listener = watch.mock.calls.at(-1)?.[0] as (value: {
      downloadedIds: string[];
    }) => void;
    listener({ downloadedIds: ["123:mp3-320", "123:flac", "456:mp3-320"] });

    expect(useStore.getState().downloadHistoryCount).toBe(2);

    unsubscribe();
  });
});

describe("scheduleRateLimitRetry (BATCHCAMP-7H)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("flips an item to rate_limited and re-queues it after the backoff", () => {
    useStore.getState().addPendingItems([makePending("a")]);
    const id = k("a");
    useStore.getState().updateItemStatus(id, "resolving");

    useStore.getState().scheduleRateLimitRetry(id);

    expect(useStore.getState().items.get(id)?.status).toBe("rate_limited");
    expect(useStore.getState().rateLimitRetries.get(id)?.attempt).toBe(1);

    vi.advanceTimersByTime(10_000);
    expect(useStore.getState().items.get(id)?.status).toBe("pending");
  });

  it("does not re-queue before the backoff elapses", () => {
    useStore.getState().addPendingItems([makePending("a")]);
    const id = k("a");
    useStore.getState().scheduleRateLimitRetry(id);

    vi.advanceTimersByTime(9_000);

    expect(useStore.getState().items.get(id)?.status).toBe("rate_limited");
  });

  it("lengthens the backoff on repeated rate limits", () => {
    useStore.getState().addPendingItems([makePending("a")]);
    const id = k("a");

    useStore.getState().scheduleRateLimitRetry(id);
    vi.advanceTimersByTime(10_000);
    useStore.getState().scheduleRateLimitRetry(id);

    expect(useStore.getState().rateLimitRetries.get(id)?.attempt).toBe(2);
    vi.advanceTimersByTime(14_000);
    expect(useStore.getState().items.get(id)?.status).toBe("rate_limited");
    vi.advanceTimersByTime(1_000);
    expect(useStore.getState().items.get(id)?.status).toBe("pending");
  });

  it("gives up and fails the item after the 5-minute window", () => {
    useStore.getState().addPendingItems([makePending("a")]);
    const id = k("a");

    useStore.getState().scheduleRateLimitRetry(id);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    useStore.getState().scheduleRateLimitRetry(id);

    expect(useStore.getState().items.get(id)?.status).toBe("failed");
    expect(useStore.getState().rateLimitRetries.has(id)).toBe(false);
  });
});

describe("applyFormatToPending (onboarding format fix)", () => {
  it("re-keys pending items to the chosen format", () => {
    useStore.getState().addPendingItems([makePending("1"), makePending("2")]);

    useStore.getState().applyFormatToPending("aiff-lossless");

    const items = useStore.getState().items;
    expect(items.has("1:aiff-lossless")).toBe(true);
    expect(items.has("2:aiff-lossless")).toBe(true);
    expect(items.has(k("1"))).toBe(false);
    expect(items.get("1:aiff-lossless")?.format).toBe("aiff-lossless");
    expect(items.get("1:aiff-lossless")?.status).toBe("pending");
  });

  it("leaves already-completed items untouched", () => {
    useStore.getState().addPendingItems([makePending("1")]);
    useStore
      .getState()
      .updateItemWithSingleDownload(k("1"), makeDownload("d1"));
    useStore.getState().updateItemStatus(k("1"), "completed");

    useStore.getState().applyFormatToPending("aiff-lossless");

    expect(useStore.getState().items.has(k("1"))).toBe(true);
    expect(useStore.getState().items.has("1:aiff-lossless")).toBe(false);
  });
});
