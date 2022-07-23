import create from "zustand";
import { produce } from "immer";
import { Download, DownloadStatus } from "../types";

export interface State {
  downloads: Record<string, Download>;
  addDownloads: (download: Download[]) => void;
  removeDownload: (id: string) => void;
  updateDownloadStatus: (id: string, status: DownloadStatus) => void;
  updateDownloadId: (id: string, downloadId?: number) => void;
  updateDownloadProgress: (downloadId: number, progress: number) => void;
}

export const useStore = create<State>((set) => ({
  downloads: {},
  addDownloads: (downloads) =>
    set(
      produce((draft: State) => {
        const newDownloads = Object.fromEntries(
          downloads
            .filter((download) => !draft.downloads[download.item.id])
            .map((download) => [download.item.id, download])
        );

        draft.downloads = { ...draft.downloads, ...newDownloads };
      })
    ),
  removeDownload: (id) =>
    set(
      produce((draft: State) => {
        delete draft.downloads[id];
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
        } else {
          draft.downloads[id].progress = 0;
        }
      })
    ),
  updateDownloadId: (id, downloadId) =>
    set(
      produce((draft: State) => {
        draft.downloads[id].id = downloadId;
      })
    ),
  updateDownloadProgress: (downloadId, progress) =>
    set(
      produce((draft: State) => {
        const download = Object.entries(draft.downloads).find(
          ([, download]) => download.id === downloadId
        )?.[1];

        if (!download) {
          return draft;
        }

        draft.downloads[download.item.id].progress = progress;
      })
    ),
}));
