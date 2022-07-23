import { DownloadStatus } from "../types";
import { State } from "./store";

const createDownloadStatusSelector =
  (status: DownloadStatus) => (state: State) =>
    Object.values(state.downloads).filter((item) => item.status === status);

export const failedDownloadsSelector = createDownloadStatusSelector("failed");

export const currentDownloadsSelector =
  createDownloadStatusSelector("downloading");

export const pendingDownloadsSelector = createDownloadStatusSelector("pending");

export const completedDownloadsSelector =
  createDownloadStatusSelector("completed");

export const queuedDownloadsSelector = (state: State) =>
  Object.values(state.downloads).filter((item) => item.status !== "completed");
