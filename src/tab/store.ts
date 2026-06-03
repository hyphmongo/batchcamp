import { enableMapSet, produce } from "immer";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import { captureError } from "@/shared/error-handler";
import { makeItemId } from "@/shared/id";
import {
  type Configuration,
  configurationStore,
  DEFAULT_CONFIG,
  downloadHistoryStore,
  migrateLegacyStorage,
} from "@/storage";
import { browserAdapter } from "@/tab/services/browser-adapter";
import {
  addToDownloadHistory,
  countHistoryIds,
  loadHistoryCache,
  resetHistoryCache,
} from "@/tab/services/download-history";
import { dropProgress } from "@/tab/services/download-progress";
import {
  type Download,
  type Item,
  type ItemStatus,
  isResolvedItem,
  type ResolvedItem,
} from "@/types";

enableMapSet();

export interface State {
  config: Configuration;
  configInitialized: boolean;
  initializeConfig: () => Promise<void>;
  setConfig: (config: Configuration) => void;

  items: Map<string, Item>;
  addPendingItems: (items: Item[]) => void;
  batchUpdateItemStatuses: (ids: string[], status: ItemStatus) => void;
  updateItemStatus: (id: string, status: ItemStatus) => void;
  updateItemWithSingleDownload: (id: string, download: Download) => void;
  updateItemWithMultipleDownloads: (id: string, downloads: Download[]) => void;
  updateDownloadBrowserId: (id: string, downloadId?: number) => void;
  updateItemDownloadProgress: (id: string, progress: number) => void;

  progress: Record<string, number>;

  downloadToItemId: Record<string, string>;
  browserIdToItemId: Record<number, string>;
  pausedItemIds: Set<string>;
  setItemPaused: (id: string, paused: boolean) => void;
  downloadsPaused: boolean;
  setDownloadsPaused: (paused: boolean) => void;
  retryDownload: (id: string) => void;
  retryAllFailed: () => void;
  cancelDownload: (id: string) => Promise<void>;
  clearAllCompleted: () => void;

  downloadHistoryCount: number;
  historyCleared: boolean;
  initializeDownloadHistory: () => () => void;
  clearDownloadHistory: () => void;
}

const recordDownloadHistory = (id: string) => {
  void addToDownloadHistory(id).then((count) => {
    if (count != null) {
      useStore.setState({ downloadHistoryCount: count, historyCleared: false });
    }
  });
};

const detachDownloadIndexes = (draft: State, item: ResolvedItem) => {
  delete draft.downloadToItemId[item.download.id];
  delete draft.progress[item.id];
  if (item.download.browserId != null) {
    delete draft.browserIdToItemId[item.download.browserId];
  }
};

export const useStore = create<State>()(
  subscribeWithSelector((set, get) => ({
    config: DEFAULT_CONFIG,
    configInitialized: false,
    downloadHistoryCount: 0,
    historyCleared: false,
    initializeDownloadHistory: () => {
      loadHistoryCache()
        .then((cache) => set({ downloadHistoryCount: cache.size }))
        .catch((error) => {
          captureError(error, {}, { operation: "load_history_count" });
        });

      const unwatch = downloadHistoryStore.watch(({ downloadedIds }) => {
        const count = countHistoryIds(downloadedIds ?? []);
        set((state) => ({
          downloadHistoryCount: count,
          historyCleared: count > 0 ? false : state.historyCleared,
        }));
      });

      return () => unwatch();
    },
    clearDownloadHistory: () => {
      resetHistoryCache();
      downloadHistoryStore.set({ downloadedIds: [] }).catch((error) => {
        captureError(error, {}, { operation: "clear_history" });
      });
      set({ downloadHistoryCount: 0, historyCleared: true });
    },
    items: new Map<string, Item>([]),
    progress: {},
    downloadToItemId: {},
    browserIdToItemId: {},
    pausedItemIds: new Set<string>(),
    downloadsPaused: false,
    setDownloadsPaused: (paused) => set({ downloadsPaused: paused }),
    setItemPaused: (id, paused) =>
      set(
        produce((draft: State) => {
          if (paused) {
            draft.pausedItemIds.add(id);
          } else {
            draft.pausedItemIds.delete(id);
          }
        }),
      ),
    initializeConfig: async () => {
      if (!get().configInitialized) {
        try {
          await migrateLegacyStorage();
          const savedConfig = await configurationStore.get();

          set(
            produce((draft: State) => {
              draft.config = { ...DEFAULT_CONFIG, ...savedConfig };
              draft.configInitialized = true;
            }),
          );

          configurationStore.watch((updated) => {
            get().setConfig({ ...DEFAULT_CONFIG, ...updated });
          });
        } catch (error) {
          captureError(error, {}, { operation: "initialize_config" });
          set(
            produce((draft: State) => {
              draft.configInitialized = true;
            }),
          );
        }
      }
    },
    setConfig: (config) =>
      set(
        produce((draft: State) => {
          draft.config = config;
        }),
      ),
    addPendingItems: (items) =>
      set(
        produce((draft: State) => {
          const fallbackFormat = get().config.format;
          for (const item of items) {
            const format = item.format ?? fallbackFormat;
            const compositeId = makeItemId(item.id, format);
            if (draft.items.has(compositeId)) {
              continue;
            }
            draft.items.set(compositeId, {
              ...item,
              id: compositeId,
              status: "pending",
              format,
            });
          }
        }),
      ),
    batchUpdateItemStatuses: (ids, status) =>
      set(
        produce((draft: State) => {
          for (const id of ids) {
            const item = draft.items.get(id);
            if (item) {
              item.status = status;
            }
          }
        }),
      ),
    updateItemStatus: (id, status) => {
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          item.status = status;

          if (status === "completed" && isResolvedItem(item)) {
            item.download.progress = 100;
            detachDownloadIndexes(draft, item);
          }
        }),
      );

      if (status === "completed" && get().items.has(id)) {
        recordDownloadHistory(id);
      }
    },

    updateItemWithSingleDownload: (id, download) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          const updated: ResolvedItem = {
            ...item,
            status: "resolved",
            download: download,
          };

          draft.items.set(id, updated);
          draft.downloadToItemId[download.id] = item.id;
        }),
      ),
    updateItemWithMultipleDownloads: (id, downloads) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          draft.items.delete(id);
          draft.pausedItemIds.delete(id);
          delete draft.progress[id];

          const uniqueDownloads = downloads.filter(
            (download, index) =>
              downloads.findIndex((d) => d.id === download.id) === index,
          );
          for (const [index, download] of uniqueDownloads.entries()) {
            const splitId = `${id}:${index}`;
            draft.items.set(splitId, {
              id: splitId,
              title: download.title,
              status: "resolved",
              format: download.format,
              download,
            });
            draft.downloadToItemId[download.id] = splitId;
          }
        }),
      ),

    updateDownloadBrowserId: (id, browserId) =>
      set(
        produce((draft: State) => {
          if (draft.downloadToItemId[id]) {
            const itemId = draft.downloadToItemId[id];
            const item = draft.items.get(itemId);

            if (item && isResolvedItem(item)) {
              item.status = "downloading";
              item.download.browserId = browserId;
              if (browserId != null) {
                draft.browserIdToItemId[browserId] = itemId;
              }
            }
          }
        }),
      ),
    updateItemDownloadProgress: (id, progress) =>
      set((state) => {
        if (state.progress[id] === progress) {
          return state;
        }
        return { progress: { ...state.progress, [id]: progress } };
      }),
    retryDownload: (id) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item || item.status !== "failed") {
            return;
          }

          draft.pausedItemIds.delete(id);

          if (isResolvedItem(item)) {
            if (item.download.browserId != null) {
              delete draft.browserIdToItemId[item.download.browserId];
            }
            item.download.progress = 0;
            item.download.browserId = undefined;
            delete draft.progress[id];
            if (item.url) {
              delete draft.downloadToItemId[item.download.id];
              item.status = "pending";
            } else {
              item.status = "resolved";
            }
          }
        }),
      ),
    retryAllFailed: () => {
      const failedIds = Array.from(get().items.values())
        .filter((item) => item.status === "failed")
        .map((item) => item.id);
      for (const id of failedIds) {
        get().retryDownload(id);
      }
    },
    clearAllCompleted: () => {
      const toDelete: string[] = [];
      set(
        produce((draft: State) => {
          for (const [id, item] of draft.items.entries()) {
            if (item.status === "completed") {
              toDelete.push(id);
              if (isResolvedItem(item)) {
                detachDownloadIndexes(draft, item);
              }
            }
          }
          for (const id of toDelete) {
            draft.items.delete(id);
            draft.pausedItemIds.delete(id);
          }
        }),
      );
      for (const id of toDelete) {
        dropProgress(id);
      }
    },
    cancelDownload: async (id) => {
      const cancel = async (id: string) => {
        const item = get().items.get(id);

        if (item && isResolvedItem(item) && item.download.browserId != null) {
          try {
            const existingDownloads = await browserAdapter.downloads.search({
              id: item.download.browserId,
              state: "in_progress",
            });

            const download = existingDownloads[0];

            if (download) {
              await browserAdapter.downloads.cancel(download.id);
            }
          } catch (error) {
            captureError(
              error,
              { download: { id: item.download.browserId } },
              { operation: "download_cancellation" },
            );
          }
        }
      };

      const item = get().items.get(id);

      if (!item) {
        return;
      }

      if (isResolvedItem(item)) {
        await cancel(id);
      }

      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          draft.items.delete(id);
          draft.pausedItemIds.delete(id);

          if (isResolvedItem(item)) {
            detachDownloadIndexes(draft, item);
          }
        }),
      );

      if (isResolvedItem(item)) {
        dropProgress(id);
      }
    },
  })),
);
