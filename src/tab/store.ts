import { produce } from "immer";
import { create } from "zustand";

import { Download, DownloadStatus, Item, ItemStatus } from "../types";
import { subscribeWithSelector } from "zustand/middleware";

import browser from "webextension-polyfill";

interface DownloadItem extends Item {
  downloads: string[];
}

export interface State {
  items: Record<string, DownloadItem>;
  addItems: (items: Item[]) => void;
  removeItem: (id: string) => void;
  downloads: Record<string, Download>;
  addDownloads: (itemId: string, download: Download[]) => void;
  removeDownload: (id: string) => void;
  updateItemStatus: (id: string, status: ItemStatus) => void;
  updateDownloadStatus: (id: string, status: DownloadStatus) => void;
  updateDownloadBrowserId: (id: string, downloadId?: number) => void;
  updateDownloadProgress: (id: string, progress: number) => void;
  removeCompletedDownloads: () => void;
  retryFailedDownload: (id: string) => void;
}

const initialState = {
  items: {},
  downloads: {},
};

export const useStore = create<State>()(
  subscribeWithSelector((set) => ({
    ...initialState,
    addItems: (items) =>
      set(
        produce((draft: State) => {
          const newDownloads = Object.fromEntries(
            items
              .filter((item) => !draft.items[item.id])
              .map((item) => {
                const downloadItem: DownloadItem = {
                  ...item,
                  downloads: [],
                  status: "pending",
                };
                return [item.id, downloadItem];
              })
          );

          draft.items = { ...draft.items, ...newDownloads };
        })
      ),
    addDownloads: (itemId, downloads) =>
      set(
        produce((draft: State) => {
          const item = draft.items[itemId];

          if (!item) {
            return;
          }

          const newDownloads = downloads.filter((x) => !draft.downloads[x.id]);

          const mapped = Object.fromEntries(
            newDownloads.map((download) => [download.id, download])
          );

          item.downloads.push(...newDownloads.map((x) => x.id));
          draft.downloads = { ...draft.downloads, ...mapped };
        })
      ),
    removeItem: (id) =>
      set(
        produce((draft: State) => {
          for (const download of draft.items[id].downloads) {
            delete draft.downloads[download];
          }

          delete draft.items[id];
        })
      ),
    removeDownload: (id) =>
      set(
        produce((draft: State) => {
          const download = draft.downloads[id];

          delete draft.downloads[id];

          draft.items[download.itemId].downloads = draft.items[
            download.itemId
          ].downloads.filter((x) => x !== id);
        })
      ),
    updateItemStatus: (id, status) =>
      set(
        produce((draft: State) => {
          if (!draft.items[id]) {
            return;
          }

          draft.items[id].status = status;
        })
      ),
    updateDownloadStatus: (id, status) =>
      set(
        produce((draft: State) => {
          if (!draft.downloads[id]) {
            return;
          }

          draft.downloads[id].status = status;

          if (status === "completed") {
            draft.downloads[id].progress = 100;

            const item = draft.items[draft.downloads[id].itemId];

            const allAreCompleted = Object.values(item.downloads).every(
              (x) => draft.downloads[x]?.status === "completed"
            );

            if (allAreCompleted) {
              item.status = "completed";
            }
          }
        })
      ),
    updateDownloadBrowserId: (id, browserId) =>
      set(
        produce((draft: State) => {
          if (draft.downloads[id]) {
            draft.downloads[id].browserId = browserId;
          }
        })
      ),
    updateDownloadProgress: (downloadId, progress) =>
      set(
        produce((draft: State) => {
          if (draft.downloads[downloadId]) {
            draft.downloads[downloadId].progress = progress;
          }
        })
      ),
    removeCompletedDownloads: () =>
      set(
        produce((draft: State) => {
          for (const item of Object.values(draft.items)) {
            if (item.status === "completed") {
              delete draft.items[item.id];
            }
          }

          for (const download of Object.values(draft.downloads)) {
            if (download.status === "completed") {
              delete draft.downloads[download.id];
            }
          }
        })
      ),
    retryFailedDownload: (id) =>
      set(
        produce((draft: State) => {
          const download = draft.downloads[id];

          if (download.status !== "failed") {
            return;
          }

          if (download.browserId) {
            browser.downloads.erase({ id: download.browserId });
            draft.downloads[id].browserId = undefined;
          }

          draft.downloads[id].status = "pending";
        })
      ),
  }))
);
