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
      if (!download.browserId) {
        return;
      }

      const currentDownload = await browser.downloads.search({
        id: download.browserId,
      });

      if (currentDownload[0].error) {
        updateDownloadStatus(download.id, "failed");
      }

      updateDownloadProgress(
        download.id,
        (currentDownload[0].bytesReceived / currentDownload[0].fileSize) * 100
      );
    });
  }, 250);
};
