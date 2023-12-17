import React, { memo, useCallback, useState } from "react";
import { IoChevronDown, IoChevronUp, IoClose, IoRepeat } from "react-icons/io5";

import { Download, DownloadStatus, Item } from "../../types";
import { useStore } from "../store";

import browser from "webextension-polyfill";
import NestedRow from "./NestedRow";

interface ItemWithDownloads extends Item {
  downloads: Download[];
}

interface DownloadRowProps {
  item: ItemWithDownloads;
}

const toSentenceCase = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

const DownloadRow = ({ item }: DownloadRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const removeItem = useStore((state) => state.removeItem);
  const retryFailedDownload = useStore((state) => state.retryFailedDownload);

  const cancel = useCallback(
    async (item: ItemWithDownloads) => {
      removeItem(item.id);

      for (const download of item.downloads) {
        if (download.browserId) {
          try {
            await browser.downloads.cancel(download.browserId);
          } catch (error) {
            return;
          }
        }
      }
    },
    [item]
  );

  const retry = (item: ItemWithDownloads) => {
    for (const download of item.downloads) {
      if (download.status === "failed") {
        retryFailedDownload(download.id);
      }
    }
  };

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (item.downloads.length <= 1) {
        e.preventDefault();
        return;
      }

      setExpanded(!expanded);
    },
    [item]
  );

  const canExpand =
    item.downloads.length > 1
      ? "inline cursor-pointer"
      : "hidden cursor-default";

  const calculateProgress = () => {
    let progress = 0;

    if (item.downloads.length === 0) {
      return progress;
    }

    item.downloads.forEach((download) => {
      progress += download.progress;
    });

    return progress / item.downloads.length;
  };

  const getStatus = (): DownloadStatus => {
    if (item.downloads.length === 0) {
      return "queued";
    }

    if (item.downloads.every((x) => x.status === "completed")) {
      return "completed";
    }

    if (item.downloads.some((x) => x.status === "downloading")) {
      return "downloading";
    }

    return "queued";
  };

  return (
    <>
      <tr onClick={onClick} key={item.id} className="collapse-title contents">
        <td className="flex align-middle">
          <div className={`${canExpand} mr-2`}>
            {expanded ? <IoChevronUp /> : <IoChevronDown />}
          </div>
        </td>
        <td>{item.title}</td>
        <td>{toSentenceCase(getStatus())}</td>
        <td>
          <progress
            className="progress progress-secondary"
            value={calculateProgress()}
            max="100"
          />
        </td>
        <td>
          <button
            className="btn btn-sm btn-primary btn-square btn-outline mr-1"
            title="Cancel"
            onClick={() => retry(item)}
          >
            <IoRepeat />
          </button>
          <button
            className="btn btn-sm btn-primary btn-square btn-outline"
            title="Cancel"
            onClick={() => cancel(item)}
          >
            <IoClose />
          </button>
        </td>
      </tr>
      {expanded &&
        item.downloads.map((download) => (
          <NestedRow
            key={download.id}
            id={download.id}
            title={download.title}
            download={download}
          />
        ))}
    </>
  );
};

export default memo(DownloadRow);
