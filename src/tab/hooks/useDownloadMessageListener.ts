import PQueue from "p-queue";
import { useEffect, useState } from "react";

import { track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import { pendingItemsSelector, resolvedItemsSelector } from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import { download } from "@/tab/services/downloader";
import { parse } from "@/tab/services/parser";
import { useStore } from "@/tab/store";
import { isMessage, isPendingItem, isResolvedItem } from "@/types";

interface DownloadContext {
  queue: PQueue;
}

const PARSE_CONCURRENCY = 8;

export const useDownloadMessageListener = ({ queue }: DownloadContext) => {
  const [parseQueue] = useState(
    () => new PQueue({ concurrency: PARSE_CONCURRENCY }),
  );

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

  useEffect(
    () => () => {
      parseQueue.clear();
    },
    [parseQueue],
  );

  useEffect(() => {
    const unsubscribePending = useStore.subscribe(
      pendingItemsSelector,
      (pendingItems) => {
        const toQueue = pendingItems.filter(isPendingItem);
        if (toQueue.length === 0) {
          return;
        }

        const {
          batchUpdateItemStatuses,
          updateItemStatus,
          updateItemWithSingleDownload,
          updateItemWithMultipleDownloads,
        } = useStore.getState();

        batchUpdateItemStatuses(
          toQueue.map((item) => item.id),
          "resolving",
        );

        for (const item of toQueue) {
          parseQueue.add(async () => {
            const downloads = await parse(item);

            if (downloads.length === 0) {
              updateItemStatus(item.id, "failed");
            }

            if (downloads.length === 1 && downloads[0]) {
              updateItemWithSingleDownload(item.id, downloads[0]);
            }

            if (downloads.length > 1) {
              updateItemWithMultipleDownloads(item.id, downloads);
            }
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

        const { batchUpdateItemStatuses, updateItemStatus } =
          useStore.getState();

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
                track("download_completed", { status });
                updateItemStatus(item.id, status);
              },
              { priority: 1 },
            );
          }
        }
      },
    );

    return () => {
      unsubscribePending();
      unsubscribeResolved();
    };
  }, [queue, parseQueue]);
};
