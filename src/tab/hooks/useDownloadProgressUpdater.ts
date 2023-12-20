import { useInterval } from "usehooks-ts";

import { downloadingItemsSelector } from "../selectors";
import { useStore } from "../store";

import browser from "webextension-polyfill";
import { isSingleItem } from "../../types";

export const useDownloadProgressUpdater = () => {
  const activeDownloads = useStore(downloadingItemsSelector);
  const { updateItemStatus, updateItemDownloadProgress } = useStore.getState();

  return useInterval(async () => {
    activeDownloads.forEach(async (item) => {
      if (!isSingleItem(item)) {
        return;
      }

      const download = item.download;

      if (!download.browserId) {
        return;
      }

      const currentDownload = await browser.downloads.search({
        id: download.browserId,
      });

      if (currentDownload[0].error) {
        updateItemStatus(item.id, "failed");
      }

      updateItemDownloadProgress(
        item.id,
        (currentDownload[0].bytesReceived / currentDownload[0].fileSize) * 100
      );
    });
  }, 250);
};
