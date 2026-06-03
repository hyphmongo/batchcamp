import { useEffect } from "react";

import { captureError } from "@/shared/error-handler";
import { activeDownloadsSelector } from "@/tab/selectors";
import {
  browserAdapter,
  type DownloadDelta,
} from "@/tab/services/browser-adapter";
import { reportBytes } from "@/tab/services/download-progress";
import { useStore } from "@/tab/store";
import { isResolvedItem } from "@/types";

const POLL_INTERVAL_MS = 500;

const hasActiveDownloads = (): boolean =>
  activeDownloadsSelector(useStore.getState()).length > 0;

export const useDownloadProgressUpdater = () => {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const handleDownloadChanged = (_delta: DownloadDelta) => {
      ensurePollingMatchesState();
    };

    const pollProgress = async () => {
      try {
        const { items, browserIdToItemId, updateItemDownloadProgress } =
          useStore.getState();
        if (!hasActiveDownloads()) {
          stopPolling();
          return;
        }
        const results = await browserAdapter.downloads.search({
          state: "in_progress",
        });
        for (const dl of results) {
          const itemId = browserIdToItemId[dl.id];
          if (!itemId) {
            continue;
          }
          const item = items.get(itemId);
          if (!item || !isResolvedItem(item)) {
            continue;
          }
          if (dl.bytesReceived > 0) {
            reportBytes(item.id, dl.bytesReceived);
          }
          if (dl.totalBytes > 0) {
            const progress = Math.round(
              (dl.bytesReceived / dl.totalBytes) * 100,
            );
            updateItemDownloadProgress(item.id, progress);
          }
        }
      } catch (error) {
        captureError(error, {}, { operation: "download_progress_poll" });
      }
    };

    const startPolling = () => {
      if (intervalId !== null) {
        return;
      }
      intervalId = setInterval(pollProgress, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId === null) {
        return;
      }
      clearInterval(intervalId);
      intervalId = null;
    };

    const ensurePollingMatchesState = () => {
      if (hasActiveDownloads()) {
        startPolling();
      } else {
        stopPolling();
      }
    };

    const unsubscribe = useStore.subscribe(
      (state) => state.items,
      ensurePollingMatchesState,
    );

    const unsubscribeChanged =
      browserAdapter.events.onDownloadChanged.subscribe(handleDownloadChanged);
    ensurePollingMatchesState();

    return () => {
      unsubscribeChanged();
      stopPolling();
      unsubscribe();
    };
  }, []);
};
