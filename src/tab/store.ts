import { enableMapSet, produce } from "immer";
import { create } from "zustand";
import { Configuration, configurationStore } from "../storage";

enableMapSet();

import browser from "webextension-polyfill";

import {
  Download,
  Item,
  ItemStatus,
  MultipleItem,
  SingleItem,
  isMultipleItemWithIds,
  isSingleItem,
} from "../types";
import { subscribeWithSelector } from "zustand/middleware";

export interface State {
  config: Configuration;
  items: Map<string, Item>;
  downloads: Record<string, string>;
  setConfig: (config: Configuration) => Promise<void>;
  addPendingItems: (items: Item[]) => void;
  updateItemStatus: (id: string, status: ItemStatus) => void;
  updateItemWithSingleDownload: (id: string, download: Download) => void;
  updateItemWithMultipleDownloads: (id: string, downloads: Download[]) => void;
  updateDownloadBrowserId: (id: string, downloadId?: number) => void;
  updateItemDownloadProgress: (id: string, progress: number) => void;
  retryDownload: (id: string) => void;
  cancelDownload: (id: string) => Promise<void>;
}

export const useStore = create<State>()(
  subscribeWithSelector((set, get) => ({
    config: {
      format: "mp3-320",
      concurrency: 3,
      hasOnboarded: true,
    },
    items: new Map<string, Item>([]),
    downloads: {},
    setConfig: async (config) => {
      await configurationStore.set(config);

      set(
        produce((draft: State) => {
          draft.config = config;
        })
      );
    },
    addPendingItems: (items) =>
      set(
        produce((draft: State) => {
          items
            .filter((item) => !draft.items.has(item.id))
            .forEach((item) => {
              draft.items.set(item.id, { ...item, status: "pending" });
            });
        })
      ),
    updateItemStatus: (id, status) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          item.status = status;

          if (status === "completed" && isSingleItem(item)) {
            item.download.progress = 100;
          }

          const parentId = item.parentId;

          if (parentId) {
            const parent = draft.items.get(parentId);

            if (!parent) {
              return;
            }

            if (!isMultipleItemWithIds(parent)) {
              return;
            }

            if (status === "completed") {
              const completedCount = parent.children.reduce(
                (count, childId) =>
                  draft.items.get(childId)!.status === "completed"
                    ? count + 1
                    : count,
                0
              );

              parent.progress = Math.max(
                (completedCount / parent.children.length) * 100,
                0
              );
            }

            const allChildrenCompleted = parent.children.every(
              (childId) => draft.items.get(childId)!.status === "completed"
            );

            if (allChildrenCompleted) {
              parent.status = "completed";
            }
          }
        })
      ),

    updateItemWithSingleDownload: (id, download) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          const updated: SingleItem = {
            ...item,
            type: "single",
            status: "resolved",
            download: download,
          };

          draft.items.set(id, updated);
          draft.downloads[download.id] = item.id;
        })
      ),
    updateItemWithMultipleDownloads: (id, downloads) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          const newItems = downloads.map<Item>((x) => ({
            id: x.id,
            parentId: item.id,
            title: x.title,
            type: "single",
            status: "resolved",
            download: x,
          }));

          for (const item of newItems) {
            draft.items.set(item.id, item);
          }

          const updated: MultipleItem = {
            ...item,
            type: "multiple",
            status: "resolved",
            progress: 0,
            children: downloads.map((x) => x.id),
          };

          draft.items.set(id, updated);

          for (const download of downloads) {
            draft.downloads[download.id] = download.id;
          }
        })
      ),

    updateDownloadBrowserId: (id, browserId) =>
      set(
        produce((draft: State) => {
          if (draft.downloads[id]) {
            const itemId = draft.downloads[id];
            const item = draft.items.get(itemId);

            if (item && isSingleItem(item)) {
              item.status = "downloading";
              item.download.browserId = browserId;
            }
          }
        })
      ),
    updateItemDownloadProgress: (id, progress) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          if (isSingleItem(item)) {
            item.download.progress = progress;
          }
        })
      ),
    retryDownload: (id) =>
      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item || item.status !== "failed") {
            return;
          }

          item.status = "pending";

          if (isSingleItem(item)) {
            item.download.progress = 0;
          }
        })
      ),
    cancelDownload: async (id) => {
      const cancel = async (id: string) => {
        const item = get().items.get(id);

        if (item && isSingleItem(item) && item.download.browserId) {
          try {
            const existingDownloads = await browser.downloads.search({
              id: item.download.browserId,
              state: "in_progress",
            });

            const download = existingDownloads[0];

            if (download) {
              await browser.downloads.cancel(download.id);
            }

            // eslint-disable-next-line no-empty
          } catch (error) {}
        }
      };

      const item = get().items.get(id);

      if (!item) {
        return;
      }

      if (isSingleItem(item)) {
        await cancel(id);
      }

      if (isMultipleItemWithIds(item)) {
        for (const child of item.children) {
          await cancel(child);
        }
      }

      set(
        produce((draft: State) => {
          const item = draft.items.get(id);

          if (!item) {
            return;
          }

          draft.items.delete(id);

          if (item.parentId) {
            const parent = draft.items.get(item.parentId);

            if (parent && isMultipleItemWithIds(parent)) {
              parent.children = parent.children.filter((x) => x !== id);
            }
          }

          if (isMultipleItemWithIds(item)) {
            for (const child of item.children) {
              const childItem = draft.items.get(child);

              if (childItem && isSingleItem(childItem)) {
                draft.items.delete(child);
                delete draft.downloads[childItem.download.id];
              }
            }
          }
        })
      );
    },
  }))
);
