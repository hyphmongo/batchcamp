import { captureError } from "@/shared/error-handler";
import { releaseIdOf, releaseIdSet } from "@/shared/id";
import { downloadHistoryStore } from "@/storage";

let historyCache: Set<string> | null = null;
let historyCacheLoad: Promise<Set<string>> | null = null;
let historyFlushTimer: ReturnType<typeof setTimeout> | null = null;
const HISTORY_FLUSH_DELAY_MS = 2000;

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

export const flushHistory = () => {
  if (historyFlushTimer) {
    clearTimeout(historyFlushTimer);
    historyFlushTimer = null;
  }
  if (!historyCache) {
    return;
  }
  const ids = Array.from(historyCache);
  downloadHistoryStore.set({ downloadedIds: ids }).catch((error) => {
    captureError(
      error,
      { history: { count: ids.length } },
      { operation: "flush_download_history" },
    );
  });
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
