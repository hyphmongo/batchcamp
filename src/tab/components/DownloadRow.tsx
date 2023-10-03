import React, { memo, useCallback } from "react";
import { IoClose, IoRepeat } from "react-icons/io5";

import { Download } from "../../types";
import { useStore } from "../store";

import browser from "webextension-polyfill";

interface DownloadRowProps {
  download: Download;
  retry: (download: Download) => Promise<void>;
}

const DownloadRow = ({ download, retry }: DownloadRowProps) => {
  const removeDownload = useStore((state) => state.removeDownload);

  const cancel = useCallback(async (download: Download) => {
    removeDownload(download.item.id);
    if (download.id) {
      try {
        await browser.downloads.cancel(download.id);
      }
      catch (error) {
        return
      }
    }
  }, []);

  const item = download.item;

  return (
    <tr key={item.id}>
      <td>{item.title}</td>
      <td>
        {download.status.charAt(0).toUpperCase() + download.status.slice(1)}
      </td>
      <td>
        <progress
          className="progress progress-secondary w-56"
          value={download.progress}
          max="100"
        />
      </td>
      <td>
        <button
          disabled={download.status !== "failed"}
          className="btn btn-primary btn-square btn-outline mr-2"
          title="Retry"
          onClick={() => retry(download)}
        >
          <IoRepeat />
        </button>
        <button
          className="btn btn-primary btn-square btn-outline"
          title="Cancel"
          onClick={() => cancel(download)}
        >
          <IoClose />
        </button>
      </td>
    </tr>
  );
};

export default memo(DownloadRow);
