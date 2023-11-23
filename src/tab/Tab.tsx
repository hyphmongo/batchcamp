import "../styles.css";

import * as Sentry from "@sentry/browser";
import PQueue from "p-queue";
import React, { useCallback } from "react";
import ReactDOM from "react-dom/client";

import { configurationStore } from "../storage";
import { Download, Message } from "../types";
import DownloadRow from "./components/DownloadRow";
import { ConfigManager } from "./configManager";
import { DownloadUseCase } from "./downloader/downloadUseCase";
import { useDownloadMessageListener } from "./hooks/useDownloadMessageListener";
import { useDownloadProgressUpdater } from "./hooks/useDownloadProgressUpdater";
import { useOnTabUnload } from "./hooks/useOnTabUnload";
import {
  completedDownloadsSelector,
  failedDownloadsSelector,
  queuedDownloadsSelector,
} from "./selectors";
import { useStore } from "./store";

import browser from "webextension-polyfill";

Sentry.init({
  dsn: "https://e745cbdff7424075b8bbb1bd27a480cf@o1332246.ingest.sentry.io/6596634",
  integrations: [new Sentry.BrowserTracing()],
});

interface TabProps {
  config: ConfigManager;
  queue: PQueue;
}

const Tab = ({ config, queue }: TabProps) => {
  const downloads = useStore((state) => state.downloads);
  const updateDownloadStatus = useStore((state) => state.updateDownloadStatus);
  const removeDownload = useStore((state) => state.removeDownload);
  const updateDownloadId = useStore((state) => state.updateDownloadId);

  const failedDownloads = useStore(failedDownloadsSelector);
  const completedDownloads = useStore(completedDownloadsSelector);
  const queuedDownloads = useStore(queuedDownloadsSelector);

  const downloadUseCase = new DownloadUseCase(updateDownloadStatus, config);

  useDownloadProgressUpdater();
  useDownloadMessageListener({ downloadUseCase, queue });
  useOnTabUnload();

  const retry = useCallback(async (download: Download) => {
    if (download.status === "queued") {
      return;
    }

    if (download.id) {
      updateDownloadId(download.item.id, undefined);
      await browser.downloads.erase({ id: download.id });
    }

    updateDownloadStatus(download.item.id, "queued");
    queue.add(() => downloadUseCase.execute(download), { priority: 1 });
  }, []);

  const retryFailed = useCallback(async () => {
    for (const item of failedDownloads) {
      await retry(item);
    }
  }, [failedDownloads]);

  const clearCompleted = useCallback(
    () =>
      completedDownloads.forEach((download) =>
        removeDownload(download.item.id)
      ),
    [completedDownloads]
  );

  return (
    <div>
      <div className="container mx-auto px-4 py-4">
        <h1 className="text-4xl font-bold leading-tight">Downloads</h1>

        <p className="mt-3 text-lg">
          Please keep this page open or your downloads will not complete
          correctly
        </p>

        <div className="divider" />

        <div className="flex my-4">
          <div className="flex grow items-center">
            <span className="pr-2 font-bold">Remaining</span>
            <div className="badge badge-primary">{queuedDownloads.length}</div>
          </div>
          <div className="flex justify-end">
            <button className="btn mr-2" onClick={clearCompleted}>
              Remove Completed
            </button>
            <button className="btn" onClick={retryFailed}>
              Retry Failed
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-8">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(downloads).map((download) => (
                <DownloadRow
                  key={download.item.id}
                  download={download}
                  retry={retry}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="footer footer-center p-4 bg-base-300 text-base-content fixed bottom-0 left-0">
        <div>
          <p>
            Made by{" "}
            <a
              className="link link-primary"
              href="https://twitter.com/hurfyd"
              rel="noreferrer"
              target="_blank"
            >
              hurfyd
            </a>{" "}
            🐻‍❄️
          </p>
        </div>
      </footer>
    </div>
  );
};

(async () => {
  const config = await configurationStore.get();

  if (!config.concurrency) {
    config.concurrency = 3;
  }

  if (!config.format) {
    config.format = "mp3-320";
  }

  const configManager = new ConfigManager(config);
  const queue = new PQueue({ concurrency: configManager.concurrency });

  browser.runtime.sendMessage({
    type: "tab-opened",
  });

  browser.runtime.onMessage.addListener(
    (message: Message, _, sendResponse: () => void) => {
      if (message.type === "configuration-updated") {
        configManager.config = message.configuration;
        queue.concurrency = configManager.concurrency;
      }

      sendResponse();
    }
  );

  ReactDOM.createRoot(document.getElementById("root") as Element).render(
    <React.StrictMode>
      <Tab config={configManager} queue={queue} />
    </React.StrictMode>
  );
})();
