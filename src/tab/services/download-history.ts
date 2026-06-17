import { captureError } from "@/shared/error-handler";
import { releaseIdOf, releaseIdSet } from "@/shared/id";
import { downloadHistoryStore } from "@/storage";

let historyCache: Set<string> | null = null;
let historyCacheLoad: Promise<Set<string>> | null = null;
let historyFlushTimer: ReturnType<typeof setTimeout> | null = null;
const HISTORY_FLUSH_DELAY_MS = 2000;
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
    }
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
  void writeHistory(Array.from(historyCache));
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

    if (historyFlushTimer) {
      clearTimeout(historyFlushTimer);
    }
    historyFlushTimer = setTimeout(flushHistory, HISTORY_FLUSH_DELAY_MS);
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
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
};
