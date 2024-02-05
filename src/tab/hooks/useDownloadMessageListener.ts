import PQueue from "p-queue";
import { useEffect } from "react";
import browser from "webextension-polyfill";

import { isPendingItem,Message } from "../../types";
import { pendingItemsSelector, resolvedItemsSelector } from "../selectors";
import { download } from "../services/downloader";
import { parse } from "../services/parser";
import { useStore } from "../store";

const handler = async (
  message: Message,
  _: unknown,
  sendResponse: () => void
) => {
  if (message.type === "send-items-to-tab") {
    useStore.getState().addPendingItems(message.items);
  }

  sendResponse();
};

if (!browser.runtime.onMessage.hasListener(handler)) {
  browser.runtime.onMessage.addListener(handler);
}

interface DownloadContext {
  queue: PQueue;
}

export const useDownloadMessageListener = ({ queue }: DownloadContext) => {
  const {
    updateItemStatus,
    updateItemWithSingleDownload,
    updateItemWithMultipleDownloads,
  } = useStore.getState();
  const pendingItems = useStore(pendingItemsSelector);
  const resolvedItems = useStore(resolvedItemsSelector);

  useEffect(() => {
    for (const item of pendingItems) {
      if (!isPendingItem(item)) {
        return;
      }

      updateItemStatus(item.id, "queued");

      queue.add(async () => {
        updateItemStatus(item.id, "resolving");

        const downloads = await parse(item);

        if (downloads.length === 0) {
          updateItemStatus(item.id, "failed");
        }

        if (downloads.length === 1) {
          updateItemWithSingleDownload(item.id, downloads[0]);
        }

        if (downloads.length > 1) {
          updateItemWithMultipleDownloads(item.id, downloads);
        }
      });
    }
  }, [pendingItems]);

  useEffect(() => {
    for (const item of resolvedItems) {
      updateItemStatus(item.id, "queued");

      if (item.status !== "resolved") {
        return;
      }

      if (item.type === "single") {
        queue.add(
          async () => {
            // When removing parents need to cancel any children
            // TODO: Would be better handled by an AbortController to cancel instead of skipping
            const storeItem = useStore.getState().items.get(item.id);

            if (!storeItem) {
              return;
            }

            const status = await download(item.download);
            updateItemStatus(item.id, status);
          },
          { priority: 1 }
        );
      }
    }
  }, [resolvedItems]);
};
