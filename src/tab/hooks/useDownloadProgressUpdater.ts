import { useInterval } from "usehooks-ts";

import { currentDownloadsSelector } from "../selectors";
import { useStore } from "../store";

import browser from "webextension-polyfill";

export const useDownloadProgressUpdater = () => {
  const activeDownloads = useStore(currentDownloadsSelector);
  const updateDownloadStatus = useStore((state) => state.updateDownloadStatus);
  const updateDownloadProgress = useStore(
    (state) => state.updateDownloadProgress
  );

  return useInterval(async () => {
    activeDownloads.forEach(async (download) => {
      if (!download.id) {
        return;
      }

      const currentDownload = await browser.downloads.search({
        id: download.id,
      });

      if (currentDownload[0].error) {
        updateDownloadStatus(download.item.id, "failed");
      }

      updateDownloadProgress(
        download.id,
        (currentDownload[0].bytesReceived / currentDownload[0].fileSize) * 100
      );
    });
  }, 100);
};
