import { useEffect } from "react";
import browser from "webextension-polyfill";

import { isSingleItem } from "../../types";
import { useStore } from "../store";

export const useDownloadProgressUpdater = () => {
  const { updateItemStatus, updateItemDownloadProgress } = useStore.getState();

  useEffect(() => {
    const handleDownloadChanged = async (delta: browser.Downloads.OnChangedDownloadDeltaType) => {
      const { items } = useStore.getState();
      
      const item = Array.from(items.values()).find(
        (item) => isSingleItem(item) && item.download.browserId === delta.id
      );

      if (!item || !isSingleItem(item)) {
        return;
      }

      if (delta.state) {
        if (delta.state.current === "interrupted") {
          updateItemStatus(item.id, "failed");
          return;
        }
      }

      if (delta.error) {
        updateItemStatus(item.id, "failed");
        return;
      }

      if (delta.bytesReceived && delta.totalBytes) {
        const progress = (delta.bytesReceived.current / delta.totalBytes.current) * 100;
        updateItemDownloadProgress(item.id, progress);
      }
    };

    browser.downloads.onChanged.addListener(handleDownloadChanged);

    return () => {
      browser.downloads.onChanged.removeListener(handleDownloadChanged);
    };
  }, [updateItemStatus, updateItemDownloadProgress]);
};
