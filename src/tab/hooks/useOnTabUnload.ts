import { useEffect } from "react";

import { currentDownloadsSelector } from "../selectors";
import { useStore } from "../store";

export const useOnTabUnload = () => {
  const currentDownloads = useStore(currentDownloadsSelector);

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
