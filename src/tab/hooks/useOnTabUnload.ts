import { useEffect } from "react";

import { downloadingItemsSelector } from "../selectors";
import { useStore } from "../store";

export const useOnTabUnload = () => {
  const currentDownloads = useStore(downloadingItemsSelector);

  useEffect(() => {
    const handleTabClose = (event: BeforeUnloadEvent) => {
      if (currentDownloads.length > 0) {
        event.preventDefault();

        event.returnValue =
          "Closing this tab will cancel any further queued downloads";
      }

      return;
    };

    window.addEventListener("beforeunload", handleTabClose);

    return () => {
      window.removeEventListener("beforeunload", handleTabClose);
    };
  }, [currentDownloads]);
};
