import React, { useCallback } from "react";
import { IoRepeat, IoClose } from "react-icons/io5";
import { useStore } from "../store";
import { Download } from "../../types";
import browser from "webextension-polyfill";

interface Props {
  id: string;
  title: string;
  download: Download;
}

const toSentenceCase = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

const NestedRow = ({ id, title, download }: Props) => {
  const removeDownload = useStore((state) => state.removeDownload);
  const retryFailedDownload = useStore((state) => state.retryFailedDownload);

  const cancel = useCallback(async (download: Download) => {
    removeDownload(download.id);

    if (download.browserId) {
      try {
        await browser.downloads.cancel(download.browserId);
      } catch (error) {
        return;
      }
    }
  }, []);

  return (
    <tr key={id} className="contents">
      <td></td>
      <td>{title}</td>
      <td>{toSentenceCase(download.status)}</td>
      <td>
        <progress
          className="progress progress-secondary"
          value={download.progress}
          max="100"
        />
      </td>
      <td>
        <button
          disabled={download.status !== "failed"}
          className="btn btn-sm btn-primary btn-square btn-outline mr-1"
          title="Retry"
          onClick={() => retryFailedDownload(download.id)}
        >
          <IoRepeat />
        </button>
        <button
          className="btn btn-sm btn-primary btn-square btn-outline"
          title="Cancel"
          onClick={() => cancel(download)}
        >
          <IoClose />
        </button>
      </td>
    </tr>
  );
};

export default NestedRow;
