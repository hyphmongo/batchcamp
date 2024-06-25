import PQueue from "p-queue";
import React from "react";
import { useCallback, useEffect, useState } from "react";
import { IoOptions } from "react-icons/io5";
import browser from "webextension-polyfill";

import { type Configuration } from "../../storage";
import { useDownloadMessageListener } from "../hooks/useDownloadMessageListener";
import { useDownloadProgressUpdater } from "../hooks/useDownloadProgressUpdater";
import { useKeyPress } from "../hooks/useKeyPressed";
import { useOnTabUnload } from "../hooks/useOnTabUnload";
import {
  derivedItemsSelector,
  failedItemsSelector,
  queuedItemsSelector,
} from "../selectors";
import { useStore } from "../store";
import DownloadRow from "./DownloadRow";
import { OptionsModal } from "./OptionsModal";
import { Header } from "./Table";

interface TabProps {
  config: Configuration;
  queue: PQueue;
}

const Downloads = ({ config, queue }: TabProps) => {
  const { failedDownloads, queuedDownloads, items, retryDownload } = useStore(
    (state) => ({
      failedDownloads: failedItemsSelector(state),
      queuedDownloads: queuedItemsSelector(state),
      items: derivedItemsSelector(state),
      retryDownload: state.retryDownload,
    })
  );

  const [showModal, toggleModal] = useState(!config.hasOnboarded);
  const isEscapePressed = useKeyPress("Escape");

  useEffect(() => {
    browser.runtime.sendMessage({
      type: "tab-opened",
    });
  }, []);

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

  const retryFailed = useCallback(() => {
    for (const item of failedDownloads) {
      retryDownload(item.id);
    }
  }, [failedDownloads, retryDownload]);

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
            Bored waiting? Discover new tracks with my music similarity search
            engine{" "}
            <a
              className="link link-primary"
              href="https://cosine.club"
              rel="noreferrer"
              target="_blank"
            >
              cosine.club
            </a>
          </p>
        </div>
      </footer>
      <OptionsModal showModal={showModal} onClose={() => toggleModal(false)} />
    </div>
  );
};

export default Downloads;
