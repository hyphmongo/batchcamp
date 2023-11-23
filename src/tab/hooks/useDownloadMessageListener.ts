import PQueue from "p-queue";
import { useEffect } from "react";

import { Download, Message } from "../../types";
import { DownloadUseCase } from "../downloader/downloadUseCase";
import { pendingDownloadsSelector } from "../selectors";
import { useStore } from "../store";

import browser from "webextension-polyfill";

const handler = async (
  message: Message,
  _: unknown,
  sendResponse: () => void
) => {
  const addDownloads = useStore.getState().addDownloads;

  if (message.type === "send-downloads-to-tab") {
    addDownloads(
      message.items.map<Download>((item) => ({
        item,
        status: "pending",
        progress: 0,
      }))
    );
  }

  sendResponse();
};

if (!browser.runtime.onMessage.hasListener(handler)) {
  browser.runtime.onMessage.addListener(handler);
}

interface DownloadContext {
  queue: PQueue;
  downloadUseCase: DownloadUseCase;
}

export const useDownloadMessageListener = ({
  queue,
  downloadUseCase,
}: DownloadContext) => {
  const pendingDownloads = useStore(pendingDownloadsSelector);
  const updateDownloadStatus = useStore((state) => state.updateDownloadStatus);

  useEffect(() => {
    pendingDownloads.forEach((download) => {
      updateDownloadStatus(download.item.id, "queued");
      queue.add(() => downloadUseCase.execute(download));
    });
  }, [pendingDownloads]);
};
