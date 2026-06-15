import type PQueue from "p-queue";
import { useEffect } from "react";
import { parseMessage } from "@/messages";
import { track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import { pendingItemsSelector, resolvedItemsSelector } from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import { download } from "@/tab/services/downloader";
import { parse } from "@/tab/services/parser";
import { useStore } from "@/tab/store";
import { type Item, isResolvedItem } from "@/types";

interface DownloadContext {
  queue: PQueue;
}

const PARSE_PRIORITY = 0;
const DOWNLOAD_PRIORITY = 1;

type QueueableItem = Item & { url: string };

const resolvePendingItem = async (item: QueueableItem) => {
  const {
    updateItemStatus,
    updateItemWithSingleDownload,
    updateItemWithMultipleDownloads,
    scheduleRateLimitRetry,
    setAccountUnverified,
  } = useStore.getState();

  updateItemStatus(item.id, "resolving");

  const result = await parse(item);

  if (result.kind === "rateLimited") {
    scheduleRateLimitRetry(item.id);
    return;
  }

  if (result.kind === "unverified") {
    if (!useStore.getState().accountUnverified) {
      track("account_unverified");
    }
    setAccountUnverified(true);
    updateItemStatus(item.id, "pending");
    return;
  }

  if (result.kind === "failed") {
    updateItemStatus(item.id, "failed");
    return;
  }

  const { downloads } = result;
  if (downloads.length === 1 && downloads[0]) {
    updateItemWithSingleDownload(item.id, downloads[0]);
  } else {
    updateItemWithMultipleDownloads(item.id, downloads);
  }
};

export const useDownloadMessageListener = ({ queue }: DownloadContext) => {
  useEffect(() => {
    const handler = (rawMessage: unknown) => {
      const message = parseMessage(rawMessage);
      if (message?.type !== "send-items-to-tab") {
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
        const toQueue = pendingItems.filter(
          (item): item is QueueableItem => item.url != null,
        );
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
