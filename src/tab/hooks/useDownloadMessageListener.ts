import PQueue from "p-queue";

import { Message } from "../../types";
import { Downloader } from "../downloader";
import { newItemsSelector, pendingDownloadsSelector } from "../selectors";
import { useStore } from "../store";

import browser from "webextension-polyfill";
import { useEffect } from "react";

const handler = async (
  message: Message,
  _: unknown,
  sendResponse: () => void
) => {
  const addItems = useStore.getState().addItems;

  if (message.type === "send-items-to-tab") {
    addItems(message.items);
  }

  sendResponse();
};

if (!browser.runtime.onMessage.hasListener(handler)) {
  browser.runtime.onMessage.addListener(handler);
}

interface DownloadContext {
  queue: PQueue;
  downloadUseCase: Downloader;
}

export const useDownloadMessageListener = ({
  queue,
  downloadUseCase,
}: DownloadContext) => {
  const { updateDownloadStatus, addDownloads, updateItemStatus } =
    useStore.getState();
  const newItems = useStore(newItemsSelector);
  const pendingDownloads = useStore(pendingDownloadsSelector);

  useEffect(() => {
    for (const item of newItems) {
      updateItemStatus(item.id, "queued");

      queue.add(async () => {
        const downloads = await downloadUseCase.parse(item);

        updateItemStatus(item.id, "resolved");

        if (downloads.length > 0) {
          addDownloads(item.id, downloads);
        }
      });
    }
  }, [newItems]);

  useEffect(() => {
    for (const download of pendingDownloads) {
      updateDownloadStatus(download.id, "queued");

      queue.add(async () => {
        const existingDownloads = useStore.getState().downloads;

        if (!existingDownloads[download.id]) {
          return;
        }

        updateDownloadStatus(download.id, "downloading");

        const status = await downloadUseCase.download(download);

        updateDownloadStatus(download.id, status);
      });
    }
  }, [pendingDownloads]);
};
