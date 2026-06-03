import { useEffect } from "react";

import { downloadingItemsSelector } from "@/tab/selectors";
import { flushHistory } from "@/tab/services/download-history";
import { useStore } from "@/tab/store";

export const useOnTabUnload = () => {
  useEffect(() => {
    const handleTabClose = (event: BeforeUnloadEvent) => {
      flushHistory();

      if (downloadingItemsSelector(useStore.getState()).length > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const handleHidden = () => {
      if (document.hidden) {
        flushHistory();
      }
    };
    const handlePageHide = () => {
      flushHistory();
    };

    window.addEventListener("beforeunload", handleTabClose);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleHidden);

    return () => {
      window.removeEventListener("beforeunload", handleTabClose);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleHidden);
    };
  }, []);
};
