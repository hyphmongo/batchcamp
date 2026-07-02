import { track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import { releaseIdOf, releaseIdSet } from "@/shared/id";
import { downloadHistoryStore } from "@/storage";

let historyCache: Set<string> | null = null;
let historyCacheLoad: Promise<Set<string>> | null = null;
let historyFlushTimer: ReturnType<typeof setTimeout> | null = null;
let historyWriteInFlight = false;
let historyWritePending = false;
const HISTORY_FLUSH_INTERVAL_MS = 2000;
const HISTORY_FLUSH_RETRY_DELAY_MS = 1000;

export const countHistoryIds = (ids: string[]): number =>
  releaseIdSet(ids).size;

export const loadHistoryCache = (): Promise<Set<string>> => {
  if (!historyCacheLoad) {
    historyCacheLoad = downloadHistoryStore
      .get()
      .then(({ downloadedIds }) => {
        historyCache = releaseIdSet(downloadedIds);
        return historyCache;
      })
      .catch((error) => {
        historyCacheLoad = null;
        track("history_load_failed", { error_name: errorName(error) });
        throw error;
      });
  }
  return historyCacheLoad;
};

const errorName = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "name" in error) {
    const { name } = error as { name: unknown };
    if (typeof name === "string" && name.length > 0) {
      return name;
    }
  }
  return "unknown";
};

const writeHistory = async (ids: string[]): Promise<void> => {
  try {
    await downloadHistoryStore.set({ downloadedIds: ids });
  } catch {
    await new Promise((resolve) =>
      setTimeout(resolve, HISTORY_FLUSH_RETRY_DELAY_MS),
    );
    try {
      await downloadHistoryStore.set({ downloadedIds: ids });
    } catch (error) {
      captureError(
        error,
        { history: { count: ids.length } },
        { operation: "flush_download_history", error_name: errorName(error) },
      );
      track("history_write_failed", { error_name: errorName(error) });
    }
  }
};

const drainHistoryWrites = async () => {
  historyWriteInFlight = true;
  try {
    do {
      historyWritePending = false;
      await writeHistory(Array.from(historyCache ?? new Set<string>()));
    } while (historyWritePending);
  } finally {
    historyWriteInFlight = false;
  }
};

export const flushHistory = () => {
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
  if (!historyCache) {
    return;
  }
  if (historyWriteInFlight) {
    historyWritePending = true;
    return;
  }
  void drainHistoryWrites();
};

export const addToDownloadHistory = async (
  compositeId: string,
): Promise<number | null> => {
  try {
    const releaseId = releaseIdOf(compositeId);
    const cache = await loadHistoryCache();
    if (cache.has(releaseId)) {
      return null;
    }
    cache.add(releaseId);

    if (!historyFlushTimer) {
      historyFlushTimer = setTimeout(flushHistory, HISTORY_FLUSH_INTERVAL_MS);
    }
    return cache.size;
  } catch (error) {
    captureError(
      error,
      { history: { id: compositeId } },
      { operation: "add_to_download_history" },
    );
    return null;
  }
};

export const resetHistoryCache = () => {
  historyCache = new Set();
  historyCacheLoad = Promise.resolve(historyCache);
  historyWriteInFlight = false;
  historyWritePending = false;
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
};
