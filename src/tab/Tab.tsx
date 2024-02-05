import "../styles.css";

import * as Sentry from "@sentry/browser";
import PQueue from "p-queue";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IoOptions } from "react-icons/io5";
import browser from "webextension-polyfill";

import { configurationStore } from "../storage";
import DownloadRow from "./components/DownloadRow";
import { OptionsModal } from "./components/OptionsModal";
import { Header } from "./components/Table";
import { useDownloadMessageListener } from "./hooks/useDownloadMessageListener";
import { useDownloadProgressUpdater } from "./hooks/useDownloadProgressUpdater";
import { useKeyPress } from "./hooks/useKeyPressed";
import { useOnTabUnload } from "./hooks/useOnTabUnload";
import {
  derivedItemsSelector,
  failedItemsSelector,
  queuedItemsSelector,
} from "./selectors";
import { useStore } from "./store";

Sentry.init({
  dsn: "https://e745cbdff7424075b8bbb1bd27a480cf@o1332246.ingest.sentry.io/6596634",
  integrations: [new Sentry.BrowserTracing()],
});

interface TabProps {
  queue: PQueue;
}

const Tab = ({ queue }: TabProps) => {
  const { failedDownloads, queuedDownloads, items, retryDownload, config } =
    useStore((state) => ({
      failedDownloads: failedItemsSelector(state),
      queuedDownloads: queuedItemsSelector(state),
      items: derivedItemsSelector(state),
      retryDownload: state.retryDownload,
      config: state.config,
    }));

  const [showModal, toggleModal] = useState(!config.hasOnboarded);
  const isEscapePressed = useKeyPress("Escape");

  useEffect(() => {
    if (!config.hasOnboarded) {
      queue.pause();
      toggleModal(true);
    } else {
      queue.concurrency = config.concurrency;
      queue.start();
    }
  }, [config.hasOnboarded, config.concurrency]);

  useEffect(() => {
    if (isEscapePressed) {
      toggleModal(!config.hasOnboarded);
    }
  }, [isEscapePressed]);

  useDownloadMessageListener({ queue });
  useDownloadProgressUpdater();
  useOnTabUnload();

  const retryFailed = () => {
    for (const item of failedDownloads) {
      retryDownload(item.id);
    }
  };

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
            <span className="mr-2 font-bold">Remaining</span>
            <div className="badge badge-primary">{queuedDownloads.length}</div>
          </div>
          <div className="flex justify-end">
            <button
              className="btn mr-2"
              type="button"
              aria-label="Open options"
              title="Options"
              onClick={() => toggleModal(true)}
            >
              <IoOptions />
            </button>
            <button className="btn" type="button" onClick={retryFailed}>
              Retry Failed
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-8">
          <table className="grid grid-cols-downloads">
            <thead className="contents">
              <tr className="contents">
                <Header></Header>
                <Header>Title</Header>
                <Header>Status</Header>
                <Header>Progress</Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody className="contents">
              {items.map((item) => (
                <DownloadRow key={item.id} item={item} />
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
      <OptionsModal showModal={showModal} onClose={() => toggleModal(false)} />
    </div>
  );
};

(async () => {
  const config = await configurationStore.get({
    format: "mp3-320",
    concurrency: 3,
  });

  configurationStore.valueStream.subscribe((updated) => {
    useStore.getState().setConfig({ ...config, ...updated });
  });

  const queue = new PQueue();

  browser.runtime.sendMessage({
    type: "tab-opened",
  });

  const app = document.getElementById("root") as Element;
  const root = createRoot(app);

  root.render(
    <React.StrictMode>
      <Tab queue={queue} />
    </React.StrictMode>
  );
})();
