import React, { memo, useState } from "react";
import { IoChevronDown, IoChevronUp, IoClose, IoRepeat } from "react-icons/io5";

import {
  Item,
  ItemStatus,
  isMultipleItem,
  isMultipleItemWithChildren,
  isSingleItem,
} from "../../types";
import { useStore } from "../store";
import { Cell } from "./Table";

interface DownloadRowProps {
  item: Item;
}

const toSentenceCase = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

const calculateProgress = (item: Item) => {
  if (isMultipleItemWithChildren(item)) {
    return item.progress;
  }

  if (isSingleItem(item)) {
    return item.download.progress;
  }

  return 0;
};

const getStatus = (item: Item): ItemStatus => {
  if (isMultipleItemWithChildren(item)) {
    if (item.status === "completed") {
      return "completed";
    }

    if (item.children.some((x) => x.status === "downloading")) {
      return "downloading";
    }

    return "queued";
  }

  return item.status;
};

const DownloadRow = memo(({ item }: DownloadRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const retry = useStore((state) => state.retryDownload);
  const cancel = useStore((state) => state.cancelDownload);

  const canExpand = isMultipleItem(item);

  const onClick = (e: React.MouseEvent) => {
    if (!isMultipleItem(item)) {
      e.preventDefault();
      return;
    }

    setExpanded(!expanded);
  };

  return (
    <>
      <tr
        onClick={onClick}
        key={item.id}
        className={`collapse-title contents ${canExpand && "cursor-pointer"}`}
      >
        <Cell>
          <div className={`${canExpand ? "inline" : "hidden"} mr-2`}>
            {expanded ? <IoChevronUp /> : <IoChevronDown />}
          </div>
        </Cell>
        <Cell>{item.title}</Cell>
        <Cell>{toSentenceCase(getStatus(item))}</Cell>
        <Cell>
          <progress
            className="progress progress-secondary"
            value={calculateProgress(item)}
            max="100"
          />
        </Cell>
        <Cell>
          <button
            className="btn btn-sm btn-primary btn-square btn-outline mr-1"
            title="Retry"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              retry(item.id);
            }}
            disabled={item.status !== "failed"}
          >
            <IoRepeat />
          </button>
          <button
            className="btn btn-sm btn-primary btn-square btn-outline"
            title="Remove"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              cancel(item.id);
            }}
          >
            <IoClose />
          </button>
        </Cell>
      </tr>
      {expanded &&
        isMultipleItemWithChildren(item) &&
        item.children.map((child) => (
          <DownloadRow key={child.id} item={child} />
        ))}
    </>
  );
});

DownloadRow.displayName = "DownloadRow";

export default DownloadRow;
