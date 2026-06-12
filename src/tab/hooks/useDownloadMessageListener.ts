import type PQueue from "p-queue";
import { useEffect } from "react";

import { track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import { pendingItemsSelector, resolvedItemsSelector } from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import { download } from "@/tab/services/downloader";
import { parse } from "@/tab/services/parser";
import { useStore } from "@/tab/store";
import {
  isMessage,
  isPendingItem,
  isResolvedItem,
  type PendingItem,
} from "@/types";

interface DownloadContext {
  queue: PQueue;
}

const PARSE_PRIORITY = 0;
const DOWNLOAD_PRIORITY = 1;

const resolvePendingItem = async (item: PendingItem) => {
  const {
    updateItemStatus,
    updateItemWithSingleDownload,
    updateItemWithMultipleDownloads,
    scheduleRateLimitRetry,
    setAccountUnverified,
  } = useStore.getState();

  updateItemStatus(item.id, "resolving");

  const { downloads, rateLimited, unverified } = await parse(item);

  if (rateLimited) {
    scheduleRateLimitRetry(item.id);
    return;
  }

  if (unverified) {
    if (!useStore.getState().accountUnverified) {
      track("account_unverified");
    }
    setAccountUnverified(true);
    updateItemStatus(item.id, "pending");
    return;
  }

  if (downloads.length === 0) {
    updateItemStatus(item.id, "failed");
  }

  if (downloads.length === 1 && downloads[0]) {
    updateItemWithSingleDownload(item.id, downloads[0]);
  }

  if (downloads.length > 1) {
    updateItemWithMultipleDownloads(item.id, downloads);
  }
};

export const useDownloadMessageListener = ({ queue }: DownloadContext) => {
  useEffect(() => {
    const handler = (message: unknown) => {
      if (!isMessage(message) || message.type !== "send-items-to-tab") {
        return;
      }
      void (async () => {
        try {
          const state = useStore.getState();
          const pickedFormat = message.items.find(
            (item) => item.format,
          )?.format;
          if (
            pickedFormat &&
            !state.config.hasOnboarded &&
            pickedFormat !== state.config.format
          ) {
            state.setConfig({ ...state.config, format: pickedFormat });
          }
          track("download_batch_started", {
            count: message.items.length,
            format: useStore.getState().config.format,
          });
          useStore.getState().addPendingItems(message.items);
          await browserAdapter.runtime.sendMessage({
            type: "items-delivered",
          });
        } catch (error) {
          captureError(
            error,
            {},
            { operation: "receive_items_from_background" },
          );
        }
      })();
    };

    const unsubscribe = browserAdapter.events.onMessage.subscribe(handler);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribePending = useStore.subscribe(
      pendingItemsSelector,
      (pendingItems) => {
        if (!useStore.getState().config.hasOnboarded) {
          return;
        }
        const toQueue = pendingItems.filter(isPendingItem);
        if (toQueue.length === 0) {
          return;
        }

        const { batchUpdateItemStatuses } = useStore.getState();

        batchUpdateItemStatuses(
          toQueue.map((item) => item.id),
          "queued",
        );

        for (const item of toQueue) {
          queue.add(() => resolvePendingItem(item), {
            priority: PARSE_PRIORITY,
          });
        }
      },
    );

    const unsubscribeResolved = useStore.subscribe(
      resolvedItemsSelector,
      (resolvedItems) => {
        const toQueue = resolvedItems.filter(
          (item) => item.status === "resolved",
        );
        if (toQueue.length === 0) {
          return;
        }

        const {
          batchUpdateItemStatuses,
          updateItemStatus,
          scheduleRateLimitRetry,
        } = useStore.getState();

        batchUpdateItemStatuses(
          toQueue.map((item) => item.id),
          "queued",
        );

        for (const item of toQueue) {
          if (isResolvedItem(item)) {
            queue.add(
              async () => {
                const storeItem = useStore.getState().items.get(item.id);

                if (!storeItem) {
                  return;
                }

                const status = await download(item.download);
                if (status === "rate_limited") {
                  scheduleRateLimitRetry(item.id);
                  return;
                }
                track("download_completed", { status });
                updateItemStatus(item.id, status);
              },
              { priority: DOWNLOAD_PRIORITY },
            );
          }
        }
      },
    );

    return () => {
      unsubscribePending();
      unsubscribeResolved();
    };
  }, [queue]);
};
