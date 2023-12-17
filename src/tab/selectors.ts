import { DownloadStatus } from "../types";
import { State } from "./store";

const selectDownloads = (state: State) => Object.values(state.downloads);
const selectItems = (state: State) => Object.values(state.items);

const createDownloadStatusSelector =
  (status: DownloadStatus) => (state: State) =>
    selectDownloads(state).filter((item) => item.status === status);

export const failedDownloadsSelector = createDownloadStatusSelector("failed");
export const currentDownloadsSelector =
  createDownloadStatusSelector("downloading");
export const pendingDownloadsSelector = createDownloadStatusSelector("pending");

export const queuedDownloadsSelector = (state: State) =>
  selectDownloads(state).filter((item) => item.status !== "completed");

export const newItemsSelector = (state: State) =>
  selectItems(state).filter((item) => item.status === "pending");

export const derivedItemsSelector = (state: State) =>
  selectItems(state).map((item) => ({
    ...item,
    downloads: item.downloads?.map((x) => state.downloads[x]),
  }));
