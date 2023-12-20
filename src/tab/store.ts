import { produce } from "immer";
import { create } from "zustand";

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
  items: Record<string, Item>;
  itemIds: string[];
  downloads: Record<string, string>;
  addPendingItems: (items: Item[]) => void;
  updateItemStatus: (id: string, status: ItemStatus) => void;
  updateItemWithSingleDownload: (id: string, download: Download) => void;
  updateItemWithMultipleDownloads: (id: string, downloads: Download[]) => void;
  updateDownloadBrowserId: (id: string, downloadId?: number) => void;
  updateItemDownloadProgress: (id: string, progress: number) => void;
  retryDownload: (id: string) => void;
  cancelDownload: (id: string) => Promise<void>;
}

const initialState = {
  items: {},
  downloads: {},
  itemIds: [],
};

export const useStore = create<State>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    addPendingItems: (items) =>
      set(
        produce((draft: State) => {
          items
            .filter((item) => !draft.items[item.id])
            .forEach((item) => {
              draft.items[item.id] = {
                ...item,
                status: "pending",
              };
            });
        })
      ),
    updateItemWithSingleDownload: (id, download) =>
      set(
        produce((draft: State) => {
          const item = draft.items[id];

          if (!item) {
            return;
          }

          const updated: SingleItem = {
            ...item,
            type: "single",
            status: "resolved",
            download: download,
          };

          draft.items[id] = updated;
          draft.downloads[download.id] = item.id;
        })
      ),
    updateItemWithMultipleDownloads: (id, downloads) =>
      set(
        produce((draft: State) => {
          const item = draft.items[id];

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
            draft.items[item.id] = item;
          }

          const updated: MultipleItem = {
            ...item,
            type: "multiple",
            status: "resolved",
            progress: 0,
            children: downloads.map((x) => x.id),
          };

          draft.items[id] = updated;

          for (const download of downloads) {
            draft.downloads[download.id] = download.id;
          }
        })
      ),
    updateItemStatus: (id, status) =>
      set(
        produce((draft: State) => {
          const item = draft.items[id];

          if (!item) {
            return;
          }

          item.status = status;

          if (status === "completed" && isSingleItem(item)) {
            item.download.progress = 100;
          }

          draft.items[id] = item;

          const parentId = item.parentId;

          if (parentId) {
            const parent = draft.items[parentId];

            if (!isMultipleItemWithIds(parent)) {
              return;
            }

            if (status === "completed") {
              const completedCount = parent.children.reduce(
                (count, childId) =>
                  draft.items[childId].status === "completed"
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
              (childId) => draft.items[childId].status === "completed"
            );

            if (allChildrenCompleted) {
              parent.status = "completed";
            }

            draft.items[parentId] = parent;
          }
        })
      ),
    updateDownloadBrowserId: (id, browserId) =>
      set(
        produce((draft: State) => {
          if (draft.downloads[id]) {
            const itemId = draft.downloads[id];
            const item = draft.items[itemId];

            if (isSingleItem(item)) {
              item.download.browserId = browserId;
              draft.items[itemId] = item;
            }
          }
        })
      ),
    updateItemDownloadProgress: (id, progress) =>
      set(
        produce((draft: State) => {
          const item = draft.items[id];

          if (!item) {
            return;
          }

          if (isSingleItem(item)) {
            item.download.progress = progress;
            draft.items[id] = item;
          }
        })
      ),
    retryDownload: (id) =>
      set(
        produce((draft: State) => {
          const item = draft.items[id];

          if (item.status !== "failed") {
            return;
          }

          if (isSingleItem(item)) {
            item.download.progress = 0;
            item.status = "pending";
            draft.items[id] = item;
          }

          if (isMultipleItemWithIds(item)) {
            draft.items[id].status = "queued";

            for (const child of item.children) {
              const childItem = draft.items[child];

              if (isSingleItem(childItem)) {
                draft.items[child].status = "pending";
              }
            }
          }
        })
      ),
    cancelDownload: async (id) => {
      const cancel = async (id: string) => {
        const item = get().items[id];

        if (isSingleItem(item) && item.download.browserId) {
          const existingDownloads = await browser.downloads.search({
            id: item.download.browserId,
          });

          if (existingDownloads.length === 1) {
            await browser.downloads.cancel(existingDownloads[0].id);
          }
        }
      };

      const item = get().items[id];

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
          const item = draft.items[id];

          delete draft.items[id];

          if (item.parentId) {
            const parent = draft.items[item.parentId];

            if (isMultipleItemWithIds(parent)) {
              parent.children = parent.children.filter((x) => x !== id);
              draft.items[item.parentId] = parent;
            }
          }

          if (isMultipleItemWithIds(item)) {
            for (const child of item.children) {
              const childItem = draft.items[child];

              if (isSingleItem(childItem)) {
                delete draft.items[child];
                delete draft.downloads[childItem.download.id];
              }
            }
          }
        })
      );
    },
  }))
);
